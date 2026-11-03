/* Invite & Pour (working name): invitations from the host's own Gmail, RSVP links, bar drink coupons, Robot Crew-style tokens.
   PREVIEW BUILD: never sends email (PREVIEW_NO_SEND), never charges (no payment code at all), no AI calls. No backend. (c) Makerman Services. */
(function () {
'use strict';
const PREVIEW_NO_SEND = true;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'; // the ONLY scope requested
const KEY = 'invitePour.v1', WKEY = 'invitePour.wallet.v1';
const CFG = window.IE_CONFIG, C = window.IE_COPY, T = CFG.tokens;
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const code = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => ALPH[x % 32]).join('');
const uid = () => code(8);
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const fillT = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)); // unknown placeholders stay as-is (e.g. {privacy_link})
const validEmail = e => /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(String(e || '').trim());
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); };
const copyTxt = t => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied'), () => toast('Copy failed'));

// ---------- state (event + guests on this device only) ----------
function blank() { return { ev: { id: code(10), name: '', host: '', hostEmail: '', date: '', time: '19:00', venue: '', note: '', rsvpBy: '', alcohol: true, kids: false, child: '', age: '', endTime: '', dropOff: '', plusOnes: false, ent: {}, entOther: '', design: CFG.art.invites[0].id }, bar: { mode: 'mock2', m: 2, c: 1 }, guests: [], tab: 'event' }; }
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.ev) return s; } catch (e) {} return blank(); }
function fixEv() { if (!S.ev.ent || Array.isArray(S.ev.ent)) S.ev.ent = {}; S.ev.id = S.ev.id || code(10); if (S.ev.kids) { S.ev.alcohol = false; if (!['mock2', 'custom', 'none'].includes(S.bar.mode)) S.bar.mode = 'mock2'; } }
function save() { fixEv(); localStorage.setItem(KEY, JSON.stringify(S)); }
function deleteDate(ev) { if (!ev.date) return null; const d = new Date(ev.date + 'T00:00:00'); d.setDate(d.getDate() + CFG.deleteAfterDays); return d; }
const fmtD = d => d ? d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); };
// Legal: delete guest data automatically after the event (deleteAfterDays after the event date)
function autoPurge() { const d = deleteDate(S.ev); if (d && Date.now() >= d.getTime() && S.guests.length) { S.guests = []; save(); return true; } return false; }

// ---------- coupons: exactly ONE set per guest, unique codes, under-18 = mocktails only ----------
function entitlement(g) {
  const b = S.bar; let m = 2, c = 0, choice = false;
  if (b.mode === 'cock1') { m = 0; c = 1; } else if (b.mode === 'choice') { m = 2; c = 1; choice = true; } else if (b.mode === 'custom') { m = clamp(b.m); c = clamp(b.c); }
  if (g.under18 || !S.ev.alcohol || S.ev.kids) { // ENFORCED HERE: kids' party mode, under-18 guest or alcohol-free event: no cocktail coupon is ever issued to an under-18 guest (or at an alcohol-free event)
    if (choice) return { m: 2, c: 0, choice: false };
    return { m: m + 2 * c, c: 0, choice: false }; // each cocktail is swapped for 2 mocktails
  }
  return { m, c, choice };
}
const clamp = n => Math.max(0, Math.min(10, Math.round(+n || 0)));
function ensureCodes() { // one set code + one RSVP token per guest, generated once, never duplicated
  const sets = new Set(), toks = new Set();
  S.guests.forEach(g => { if (g.set && !sets.has(g.set)) sets.add(g.set); else delete g.set; if (g.token && !toks.has(g.token)) toks.add(g.token); else delete g.token; });
  S.guests.forEach(g => {
    if (!g.set) { let c; do { c = code(4) + '-' + code(4); } while (sets.has(c)); sets.add(c); g.set = c; g.redeemed = []; }
    if (!g.token) { let t; do { t = code(12); } while (toks.has(t)); toks.add(t); g.token = t; }
    g.redeemed = g.redeemed || [];
  });
}
function coupons(g) { // the individual one-use coupons in this guest's single set
  const e = entitlement(g), out = [];
  for (let i = 1; i <= e.m; i++) out.push({ kind: 'mocktail', code: g.set + '-M' + i });
  if (!S.ev.kids && !g.under18 && S.ev.alcohol) for (let i = 1; i <= e.c; i++) out.push({ kind: 'cocktail', code: g.set + '-C' + i }); // belt and braces
  return { e, list: out };
}
function couponText(g, cp) { return fillT(S.ev.kids ? C.kids.mocktail : C.coupon[cp.kind], { event_name: S.ev.kids ? (S.ev.name || (S.ev.child || 'our birthday star') + "'s party") : (S.ev.name || 'our party'), guest_name: g.name, code: cp.code, host_name: S.ev.host || 'your host' }); }
function describe(e) { if (e.choice) return '2 mocktails or 1 cocktail'; const a = []; if (e.m) a.push(e.m + ' mocktail' + (e.m === 1 ? '' : 's')); if (e.c) a.push(e.c + ' cocktail' + (e.c === 1 ? '' : 's') + ' (18+)'); return a.join(' + ') || 'no drink coupons'; }

// ---------- tokens: Robot Crew model (total balance + paid part; free spent first; bought kept separately) ----------
function wallet() { try { const w = JSON.parse(localStorage.getItem(WKEY)); if (w && w.v === 1) return w; } catch (e) {} const w = { v: 1, balance: T.welcome, paid: 0, ledger: [{ at: Date.now(), kind: 'grant', amount: T.welcome, note: 'welcome' }] }; localStorage.setItem(WKEY, JSON.stringify(w)); return w; }
function setWallet(w) { if (w.paid > w.balance) w.paid = w.balance; localStorage.setItem(WKEY, JSON.stringify(w)); $('#tokBal').textContent = w.balance; }
function spend_unused(n, note) { const w = wallet(); if (w.balance < n) return false; const free = w.balance - w.paid, fromFree = Math.min(free, n); w.balance -= n; w.paid -= (n - fromFree); w.ledger.unshift({ at: Date.now(), kind: 'spend', amount: -n, note: note + (fromFree ? ' (' + fromFree + ' free)' : '') }); setWallet(w); return true; }
function buyStub(pk) { const w = wallet(); w.balance += pk.n; w.paid += pk.n; w.ledger.unshift({ at: Date.now(), kind: 'purchase', amount: pk.n, note: 'TEST pack ' + pk.id + ' (stub, nothing charged)' }); setWallet(w); }
// 1 token per UNIQUE guest per event. The charge key is eventId:guestId, stored in the wallet, so resends and edits never charge again.
const chargeKey = g => S.ev.id + ':' + g.id;
const isCharged = g => !!(wallet().charged || {})[chargeKey(g)];
function chargeGuests(list) { // all or nothing
  const w = wallet(); w.charged = w.charged || {}; const todo = list.filter(g => !w.charged[chargeKey(g)]), n = todo.length * T.perInvite;
  if (n === 0) return { ok: true, n: 0 };
  if (w.balance < n) return { ok: false, n };
  const free = w.balance - w.paid, fromFree = Math.min(free, n); w.balance -= n; w.paid -= (n - fromFree);
  todo.forEach(g => w.charged[chargeKey(g)] = Date.now());
  w.ledger.unshift({ at: Date.now(), kind: 'spend', amount: -n, note: todo.length + ' new guest invite' + (todo.length === 1 ? '' : 's') + (PREVIEW_NO_SEND ? ' (preview, not sent)' : '') + (fromFree ? ' (' + fromFree + ' free)' : '') });
  setWallet(w); return { ok: true, n };
}
const aud = c => 'A$' + (c / 100).toFixed(2) + ' (AUD)';
function openWallet() {
  const w = wallet();
  $('#modalBody').innerHTML = `<h2>Tokens</h2><p><b data-testid="w-bal">${w.balance}</b> tokens (<span data-testid="w-free">${w.balance - w.paid}</span> free, <span data-testid="w-paid">${w.paid}</span> bought). Free tokens are used first.</p>
    <div class="note warm">${esc(C.ui.stub)}</div><div class="row">${T.packs.map(p => `<button class="btn small alt" data-pack="${p.id}" data-testid="pack-${p.id}">Test pack: ${p.n} tokens, ${aud(p.cents)}</button>`).join('')}</div>
    <p class="hint" data-testid="unit-price">1 token = ${esc(T.whatOne)} = ${aud(T.unitCents)}. Built-in designs, RSVPs and coupons: free.</p>
    <div class="note safe" data-testid="token-terms">${C.tokens.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <h3>History</h3><table>${w.ledger.slice(0, 15).map(l => `<tr><td>${new Date(l.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td><td>${l.amount > 0 ? '+' : ''}${l.amount}</td><td>${esc(l.note)}</td></tr>`).join('')}</table>`;
  $('#modal').hidden = false;
  $$('[data-pack]').forEach(b => b.onclick = () => { buyStub(T.packs.find(p => p.id === b.dataset.pack)); openWallet(); toast('Test tokens added. Nothing charged.'); });
}

// ---------- Google sign-in: gmail.send only, token in memory for this session only, revoked after use ----------
let gToken = null; // never written to localStorage/sessionStorage/cookies
function signIn() {
  return new Promise(res => {
    if (!CFG.googleClientId) return res({ ok: false, why: 'Preview: Google sign-in isn\'t connected, so nothing can be sent. You can still build and check every invite.' });
    const go = () => window.google.accounts.oauth2.initTokenClient({ client_id: CFG.googleClientId, scope: GMAIL_SCOPE, callback: r => { if (r && r.access_token) { gToken = r.access_token; res({ ok: true }); } else res({ ok: false, why: 'Google sign-in was cancelled.' }); } }).requestAccessToken();
    if (window.google && window.google.accounts) return go();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = go; s.onerror = () => res({ ok: false, why: 'Couldn\'t reach Google sign-in.' }); document.head.appendChild(s);
  });
}
function discardToken() { if (gToken && window.google && window.google.accounts) try { window.google.accounts.oauth2.revoke(gToken, () => {}); } catch (e) {} gToken = null; }
window.addEventListener('pagehide', discardToken);
async function gmailSend(raw) {
  if (PREVIEW_NO_SEND || !gToken) return { sent: false };
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + gToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64u(raw) }) });
  return { sent: r.ok };
}

// ---------- links + email ----------
function vars(g) { const ev = S.ev; return { kids: !!ev.kids, event_name: ev.name || 'our party', host_name: ev.host || 'your host', guest_name: g ? g.name : '', date: ev.date ? fmtD(new Date(ev.date + 'T00:00:00')) : 'Date to be confirmed', time: fmtTime(ev.time), venue: ev.venue || 'Venue to be confirmed', host_note: ev.note || '', rsvp_deadline: ev.rsvpBy ? fmtD(new Date(ev.rsvpBy + 'T00:00:00')) : 'soon', delete_date: fmtD(deleteDate(ev)) || '30 days after the event', entertainment_line: entLine(), child_name: ev.child || 'our birthday star', age: ev.age || '', start_time: fmtTime(ev.time), end_time: fmtTime(ev.endTime) || 'late', drop_off_note: ev.dropOff || '' }; }
// {entertainment_line}: only entertainers the host has ticked "I've booked this entertainer" for
function entLine() { const ev = S.ev; return C.ent.items.filter(it => ev.ent[it.id] && ev.ent[it.id].booked).map(it => it.id === 'other' ? String(ev.entOther || '').trim() : it.line).filter(Boolean).join(' '); }
function payload(g) { const cp = coupons(g); cp.list.forEach(c => c.txt = couponText(g, c)); return { v: 1, t: g.token, gid: g.id, ...vars(g), he: S.ev.hostEmail, d: S.ev.design, k: S.ev.kids ? 1 : 0, po: S.ev.plusOnes ? 1 : 0, ch: cp.e.choice ? 1 : 0, cp: cp.list }; }
const base = () => location.origin + location.pathname;
const rsvpLink = g => base() + '#rsvp=' + b64u(JSON.stringify(payload(g)));
function emailHtml(g) {
  const v = Object.assign(vars(g), { rsvp_link: rsvpLink(g) }), cp = coupons(g), has = cp.list.length > 0;
  const L0 = S.ev.kids ? C.kids.lines.slice() : C.email.lines.slice(); if (!S.ev.kids && v.entertainment_line) L0.splice(L0.indexOf('📍 {venue}') + 1, 0, '{entertainment_line}');
  const lines = L0.filter(l => !(l === '{entertainment_line}' && !v.entertainment_line)).filter(l => !(l.startsWith('@coupon:') && !has)).filter(l => !(l === '{host_note}' && !v.host_note)).map(l => l.replace(/^@coupon:/, ''));
  let html = lines.map(l => { const t = esc(fillT(l, v)); return t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, a, h) => `<a href="${h}">${a}</a>`); }).join('<br>\n').replace(/ (<br>|$)/g, '$1');
  if (has) { const anchor = esc(fillT(S.ev.kids ? 'Let us know about any allergies or dietary needs.' : 'Drinks are offered by {host_name}, not Makerman Services.', v)), i = html.indexOf(anchor); const block = (cp.e.choice && !S.ev.kids ? '<br>\n' + esc(C.coupon.choiceLine) : '') + cp.list.map(c => '<br>\n' + esc(couponText(g, c))).join('') + (S.ev.kids ? '<br>\n' + esc(fillT(C.kids.ingredients, v)) : '') + '<br>\n<small>' + esc(C.coupon.smallPrint) + '</small>'; if (i >= 0) { const end = i + anchor.length; html = html.slice(0, end) + block + html.slice(end); } }
  return html;
}
function mime(g) {
  const enc = s => '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(s))) + '?=';
  return ['From: ' + enc(S.ev.host || 'Host') + ' <' + (S.ev.hostEmail || 'me') + '>', 'To: ' + g.email, 'Subject: ' + enc(fillT(S.ev.kids ? C.kids.subject : C.email.subject, vars(g))), 'MIME-Version: 1.0', 'Content-Type: text/html; charset="UTF-8"', '', emailHtml(g)].join('\r\n');
}

// ---------- invite + coupon visuals (text drawn live over the art) ----------
const art = id => CFG.art.invites.find(a => a.id === id) || CFG.art.invites[0];
function inviteCard(v, design) { const a = art(design); return `<div class="inv" style="${a.src ? `background-image:url('${esc(a.src)}')` : `background:${a.css}`};color:${a.ink}" data-testid="invite-card">${a.emoji ? `<div class="emo">${a.emoji}</div>` : ''}<div class="pane" style="background:${a.pane}">${v.kids ? `<p>${esc(fillT("You're invited to {child_name}'s birthday party, turning {age}!", v))}</p><h1>${esc(v.child_name)}</h1><p>📅 ${esc(v.date)} · ⏰ ${esc(v.start_time)} to ${esc(v.end_time)}</p>` : `<p>${esc(v.host_name)} would love you to join</p><h1>${esc(v.event_name)}</h1><p>📅 ${esc(v.date)} · ⏰ ${esc(v.time)}</p>`}<p>📍 ${esc(v.venue)}</p>${v.entertainment_line ? `<p data-testid="card-ent">${esc(v.entertainment_line)}</p>` : ''}${v.host_note ? `<p><i>${esc(v.host_note)}</i></p>` : ''}</div>${a.ai ? `<small class="artlabel" data-testid="art-label">${esc(C.artLabel)}</small>` : ''}</div>`; }
function couponCard(text, kind) { return `<div class="cpn" style="background-image:url('${esc(CFG.art[kind])}')" data-testid="coupon-${kind}"><div class="cpt">${esc(text)}</div>${CFG.art.couponAi ? `<small class="artlabel">${esc(C.artLabel)}</small>` : ''}</div>`; }

// ---------- host screens ----------
function render() {
  autoPurge(); ensureCodes(); save();
  $('#tokBal').textContent = wallet().balance;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  ({ event: rEvent, guests: rGuests, drinks: rDrinks, send: rSend, bar: rBar })[S.tab]();
}
function rEvent() {
  const ev = S.ev, f = (k, l, t = 'text', x = '') => `<label>${l}<input data-ev="${k}" type="${t}" value="${esc(ev[k])}" ${x} data-testid="ev-${k}"></label>`;
  $('#app').innerHTML = `<section class="card"><h2>Your event</h2>${f('name', 'Event name', 'text', 'maxlength="80"')}<div class="grid2">${f('host', 'Your name (host)', 'text', 'maxlength="60"')}${f('hostEmail', 'Your Gmail address', 'email', 'maxlength="120"')}${f('date', 'Date', 'date')}${f('time', 'Start time', 'time')}${f('rsvpBy', 'RSVP by', 'date')}${f('venue', 'Venue', 'text', 'maxlength="120"')}</div>
    <label>Note for guests (optional)<textarea data-ev="note" maxlength="240" data-testid="ev-note">${esc(ev.note)}</textarea></label>
    <label class="row"><input type="checkbox" data-evc="kids" ${ev.kids ? 'checked' : ''} style="width:auto" data-testid="kids-mode"> Kids' party</label>${ev.kids ? `<p class="note" data-testid="kids-note">${esc(C.kids.hostNote)}</p><div class="grid2">${f('child', "Birthday child's first name", 'text', 'maxlength="40"')}${f('age', 'Turning (age)', 'number', 'min="1" max="17"')}${f('endTime', 'Finish time', 'time')}${f('dropOff', 'Drop-off note (optional)', 'text', 'maxlength="120"')}</div>` : ''}
    <label class="row"><input type="checkbox" data-evc="plusOnes" ${ev.plusOnes ? 'checked' : ''} style="width:auto"> Guests can bring plus-ones</label>
    <p class="hint">Guest details are deleted automatically ${CFG.deleteAfterDays} days after the event${deleteDate(ev) ? ' (on ' + esc(fmtD(deleteDate(ev))) + ')' : ''}.</p></section>
    <section class="card"><h2>Design</h2><div class="designs">${designs().map(a => `<button data-design="${a.id}" class="${ev.design === a.id ? 'on' : ''}" data-testid="design-${a.id}"><div class="sw" style="${a.src ? `background-image:url('${esc(a.src)}')` : `background:${a.css}`}">${a.emoji ? a.emoji.split(' ')[0] : ''}</div>${esc(a.name)}</button>`).join('')}</div>
    <h3>Preview</h3>${inviteCard(vars(null), ev.design)}</section>
    <section class="card"><h2>Entertainment</h2><p class="note warm" data-testid="ent-disclaimer">${esc(C.ent.hostNote)}</p>
    ${C.ent.items.map(it => { const s = ev.ent[it.id]; return `<div class="g"><label class="row"><input type="checkbox" data-ent="${it.id}" ${s ? 'checked' : ''} style="width:auto" data-testid="ent-${it.id}"> ${it.emoji} <b>${esc(it.name)}</b></label>${it.line ? `<small>"${esc(it.line)}"</small>` : ''}${it.note ? `<br><small><i>${esc(it.note)}</i></small>` : ''}
      ${s ? `${it.id === 'other' ? `<input data-entother maxlength="160" value="${esc(ev.entOther)}" placeholder="Your own line for the invite" data-testid="ent-other-text"><p class="hint" data-testid="ent-other-terms">${esc(C.ent.otherTerms)}</p>` : ''}<label class="row"><input type="checkbox" data-booked="${it.id}" ${s.booked ? 'checked' : ''} style="width:auto" data-testid="booked-${it.id}"> ${esc(C.ent.booked)}</label>` : ''}</div>`; }).join('')}
    ${Object.keys(ev.ent).length ? `<p class="note safe" data-testid="ent-tip">${esc(C.ent.tip)}</p>` : ''}</section>`;
  $$('[data-ev]').forEach(i => i.onchange = () => { ev[i.dataset.ev] = i.value.trim(); save(); render(); });
  $$('[data-evc]').forEach(i => i.onchange = () => { ev[i.dataset.evc] = i.checked; if (i.dataset.evc === 'kids' && !designs().some(d => d.id === ev.design)) ev.design = designs()[0].id; save(); render(); });
  $$('[data-ent]').forEach(i => i.onchange = () => { const k = i.dataset.ent; if (i.checked) ev.ent[k] = { booked: false }; else delete ev.ent[k]; save(); render(); });
  $$('[data-booked]').forEach(i => i.onchange = () => { ev.ent[i.dataset.booked].booked = i.checked; save(); render(); });
  const eo = $('[data-entother]'); if (eo) eo.onchange = () => { ev.entOther = eo.value.trim(); save(); render(); };
  $$('[data-design]').forEach(b => b.onclick = () => { ev.design = b.dataset.design; save(); render(); });
}
function designs() { return CFG.art.invites.filter(a => S.ev.kids ? a.kids : a.adults !== false); }
function rGuests() {
  const g = S.guests;
  let h = `<section class="card"><h2>Guests <small class="hint">${g.length}</small></h2><p class="hint">One line per guest: Name, email</p><textarea id="gAdd" data-testid="g-add" placeholder="Sam Lee, sam@example.com"></textarea><div class="row mt"><button class="btn small" id="gAddBtn" data-testid="g-add-btn">Add guests</button></div>
    <p class="hint">${esc(C.ui.gmail)}</p>`;
  h += g.map(x => { const cp = coupons(x); return `<div class="g" data-testid="g-${x.id}"><div class="top2"><b>${esc(x.name)}</b><small data-testid="rsvp-${x.id}">RSVP: ${esc(x.rsvp || 'not sent')}${x.plus ? ' +' + x.plus : ''}</small></div>
    <input type="email" data-email="${x.id}" value="${esc(x.email || '')}" placeholder="Guest email" maxlength="120" data-testid="email-${x.id}">
    ${S.ev.kids ? `<small>Adults staying: ${+x.adultsStaying || 0}</small><br><small data-testid="set-${x.id}">Coupon set ${esc(x.set)}: ${esc(describe(cp.e))}</small>` : `<label class="row"><input type="checkbox" data-u18="${x.id}" ${x.under18 ? 'checked' : ''} style="width:auto" data-testid="u18-${x.id}"> ${esc(C.under18Toggle)}</label>
    <small data-testid="set-${x.id}">Coupon set ${esc(x.set)}: ${esc(describe(cp.e))}</small>`}${x.diet ? `<br><small>Dietary: ${esc(x.diet)}</small>` : ''}${x.allergy ? `<br><small data-testid="allergy-${x.id}">⚠ Allergies (host only): ${esc(x.allergy)}</small>` : ''}${x.msg ? `<br><small>Message: ${esc(x.msg)}</small>` : ''}
    <div class="row mt"><button class="btn small alt" data-link="${x.id}">🔗 Copy RSVP link</button><a class="linkb" href="${esc(rsvpLink(x))}" target="_blank" rel="noopener" data-testid="open-${x.id}">open</a><button class="linkb" data-del="${x.id}">remove</button></div></div>`; }).join('');
  h += `<h3>RSVP replies by email</h3><p class="hint">Paste replies that contain a line like RSVP:XXXXXXXXXXXX:yes</p><div class="row"><input id="rPaste" data-testid="r-paste"><button class="btn small alt" id="rApply" data-testid="r-apply">Update</button></div>`;
  h += g.length ? `<div class="row mt"><button class="btn small alt" id="delAll" data-testid="del-all">Delete all guest data now</button></div>` : '';
  $('#app').innerHTML = h + '</section>';
  $('#gAddBtn').onclick = () => { $('#gAdd').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { const [n, e] = l.split(/\s*[,;\t]\s*/); if (e && g.some(x => (x.email || '').toLowerCase() === e.trim().toLowerCase())) return toast('Already on the list: ' + e); if (n) g.push({ id: uid(), name: n.slice(0, 60), email: validEmail(e) ? e.trim() : '', under18: false, rsvp: '' }); }); save(); render(); };
  $$('[data-email]').forEach(i => i.onchange = () => { g.find(x => x.id === i.dataset.email).email = i.value.trim(); save(); });
  $$('[data-u18]').forEach(i => i.onchange = () => { g.find(x => x.id === i.dataset.u18).under18 = i.checked; save(); render(); });
  $$('[data-link]').forEach(b => b.onclick = () => copyTxt(rsvpLink(g.find(x => x.id === b.dataset.link))));
  $$('[data-del]').forEach(b => b.onclick = () => { if (!confirm('Remove this guest and their details?')) return; S.guests = g.filter(x => x.id !== b.dataset.del); save(); render(); });
  $('#rApply').onclick = () => { let n = 0; $('#rPaste').value.replace(/RSVP:([A-Z2-9]{12}):(yes|no|maybe)/gi, (m, t, k) => { const x = g.find(y => y.token === t.toUpperCase()); if (x) { x.rsvp = k.toLowerCase(); n++; } }); save(); render(); toast(n ? 'Updated ' + n : 'No RSVP lines found'); };
  const da = $('#delAll'); if (da) da.onclick = () => { if (!confirm('Delete every guest\'s details from this device?')) return; S.guests = []; save(); render(); };
}
function rDrinks() {
  const b = S.bar, alc = S.ev.alcohol, modes = S.ev.kids ? [['mock2', '2 mocktails each'], ['custom', 'Custom'], ['none', 'Coupons off']] : [['mock2', '2 mocktails each'], ['cock1', '1 cocktail each'], ['choice', '2 mocktails or 1 cocktail'], ['custom', 'Custom'], ['none', 'No coupons']];
  const sample = { name: 'Sample guest', set: 'ABCD-EFGH', under18: false }, s18 = Object.assign({}, sample, { under18: true });
  $('#app').innerHTML = `<section class="card"><h2>${S.ev.kids ? 'Mocktail coupons' : 'Bar drink coupons'}</h2><p class="hint">Each guest gets exactly one coupon set. Change the mix any time: codes stay the same.</p>
    ${S.ev.kids ? `<p class="note" data-testid="kids-drinks">${esc(C.kids.hostNote)}</p>` : `<label class="row"><input type="checkbox" id="alc" ${alc ? 'checked' : ''} style="width:auto" data-testid="alc"> Alcohol is served at this event</label>`}
    ${alc ? `<p class="note warm" data-testid="host-resp">${esc(C.hostResponsibility)}</p>` : ''}
    <div class="seg" id="mode">${modes.map(([k, l]) => `<button data-v="${k}" class="${b.mode === k ? 'on' : ''}" data-testid="mode-${k}" ${!alc && ['cock1', 'choice'].includes(k) ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    ${b.mode === 'custom' ? `<div class="grid2 mt"><label>Mocktails per guest<input id="cm" type="number" min="0" max="10" value="${b.m}" data-testid="cm"></label>${alc ? `<label>Cocktails per guest (18+)<input id="cc" type="number" min="0" max="10" value="${b.c}" data-testid="cc"></label>` : ''}</div>` : ''}
    <p class="hint" data-testid="rule">Each guest: ${esc(describe(entitlement(sample)))}.${S.ev.kids ? '' : ` Guests marked under 18: ${esc(describe(entitlement(s18)))}.`}</p>
    <h3>What a guest sees</h3>${entitlement(sample).choice ? `<p>${esc(C.coupon.choiceLine)}</p>` : ''}${coupons(sample).list.filter((c, i, l) => l.findIndex(x => x.kind === c.kind) === i).map(c => couponCard(couponText(sample, c), c.kind)).join('')}${S.ev.kids && coupons(sample).list.length ? `<p class="hint" data-testid="kids-ingredients">${esc(fillT(C.kids.ingredients, vars(null)))}</p>` : ''}<p class="hint">${esc(C.coupon.smallPrint)}</p></section>`;
  if ($('#alc')) $('#alc').onchange = e => { S.ev.alcohol = e.target.checked; if (!S.ev.alcohol && ['cock1', 'choice'].includes(b.mode)) b.mode = 'mock2'; save(); render(); };
  $$('#mode button').forEach(x => x.onclick = () => { if (x.disabled) return; b.mode = x.dataset.v; save(); render(); });
  const cm = $('#cm'), cc = $('#cc'); if (cm) cm.onchange = () => { b.m = clamp(cm.value); save(); render(); }; if (cc) cc.onchange = () => { b.c = clamp(cc.value); save(); render(); };
}
// 'none' mode: no coupons at all
const _ent = entitlement; entitlement = function (g) { if (S.bar.mode === 'none') return { m: 0, c: 0, choice: false }; if (S.ev.kids) return { m: S.bar.mode === 'custom' ? clamp(S.bar.m) : 2, c: 0, choice: false }; // kids: mocktails only, never a cocktail or the choice line
  const e = _ent(g); if (S.ev.kids || g.under18) { e.c = 0; e.choice = false; } return e; }; // eslint-disable-line no-func-assign

function rSend() {
  const ready = S.guests.filter(x => validEmail(x.email)), fresh = ready.filter(x => !isCharged(x)), cost = fresh.length * T.perInvite;
  $('#app').innerHTML = `<section class="card"><h2>Send invites</h2><p class="hint">${esc(C.ui.gmail)}</p>
    <div class="row"><button class="btn small alt" id="gIn" data-testid="g-signin">Sign in with Google</button><span class="hint" id="gState" data-testid="g-state">${gToken ? 'Signed in for this session' : 'Not signed in'}</span></div>
    <p data-testid="batch">${ready.length} of ${S.guests.length} guests have an email. ${fresh.length} new, ${ready.length - fresh.length} already paid (resends are free). This send uses <b data-testid="cost">${cost}</b> token${cost === 1 ? '' : 's'} (1 token per guest, ${aud(T.unitCents)} each; you have ${wallet().balance}).</p>
    <div class="row"><button class="btn" id="sendAll" data-testid="send-all" ${ready.length ? '' : 'disabled'}>✉ Send ${ready.length} invite${ready.length === 1 ? '' : 's'}</button><button class="btn small alt" id="wal">Tokens</button></div>
    <div id="sendOut" data-testid="send-out"></div></section>`;
  $('#gIn').onclick = async () => { const r = await signIn(); $('#gState').textContent = r.ok ? 'Signed in for this session' : r.why; };
  $('#wal').onclick = openWallet;
  $('#sendAll').onclick = async () => {
    if (!ready.length) return;
    if (!chargeGuests(ready).ok) { $('#sendOut').innerHTML = `<p class="note warm" data-testid="no-tokens">You need ${cost} tokens for this batch. Open Tokens to add a test pack.</p>`; return; }
    const res = []; for (const g of ready) { const raw = mime(g); const r = await gmailSend(raw); g.rsvp = g.rsvp || 'invited'; g.sentAt = Date.now(); res.push({ g, raw, r }); }
    discardToken(); save();
    $('#sendOut').innerHTML = `<div class="note warm" data-testid="preview-not-sent"><b>${esc(C.ui.preview)}</b> ${res.length} built, ${res.filter(x => x.r.sent).length} sent. ${cost} preview token${cost === 1 ? '' : 's'} used.</div>` + res.slice(0, 3).map(x => `<details><summary>${esc(x.g.name)}: what would be sent</summary><pre data-testid="mime-${x.g.id}">${esc(x.raw)}</pre></details>`).join('');
    $('#tokBal').textContent = wallet().balance;
  };
}
function rBar() {
  $('#app').innerHTML = `<section class="card"><h2>Bar check</h2><p class="hint">Type or scan a coupon code. Each coupon works once.</p><div class="row"><input id="bc" placeholder="ABCD-EFGH-M1" data-testid="bc"><button class="btn small" id="bcBtn" data-testid="bc-btn">Check and use</button></div><p id="bcOut" data-testid="bc-out"></p>
    <table><tr><th>Guest</th><th>Set</th><th>Coupons</th><th>Used</th></tr>${S.guests.map(g => { const c = coupons(g); return `<tr><td>${esc(g.name)}${g.under18 ? ' (under 18)' : ''}</td><td>${esc(g.set)}</td><td>${esc(describe(c.e))}</td><td>${g.redeemed.length}</td></tr>`; }).join('')}</table></section>`;
  $('#bcBtn').onclick = () => {
    const v = $('#bc').value.trim().toUpperCase(), g = S.guests.find(x => v.startsWith(x.set + '-')), o = $('#bcOut');
    if (!g) { o.textContent = 'Not a coupon for this event.'; return; }
    const c = coupons(g), cp = c.list.find(x => x.code === v);
    if (S.ev.kids && /-C\d+$/.test(v)) { o.textContent = "No cocktails at kids' parties."; return; }
    if (!cp) { o.textContent = 'Not a valid coupon for ' + g.name + '.'; return; }
    if (g.redeemed.includes(v)) { o.textContent = 'Already used.'; return; }
    if (c.e.choice) { const usedC = g.redeemed.some(x => /-C\d+$/.test(x)), usedM = g.redeemed.some(x => /-M\d+$/.test(x)); if ((cp.kind === 'cocktail' && usedM) || (cp.kind === 'mocktail' && usedC)) { o.textContent = g.name + ' already chose ' + (usedC ? 'the cocktail' : 'mocktails') + '.'; return; } }
    g.redeemed.push(v); save(); o.textContent = 'OK: 1 ' + cp.kind + ' for ' + g.name + '.' + (cp.kind === 'cocktail' ? ' 18+ only: check ID.' : ''); rBarTableOnly();
  };
}
function rBarTableOnly() { const keep = $('#bcOut').textContent; rBar(); $('#bcOut').textContent = keep; }

// ---------- guest RSVP page (#rsvp=...) ----------
function guestView() {
  let d; try { d = JSON.parse(unb64u(location.hash.slice(6))); } catch (e) { d = null; }
  $('#tabs').hidden = true; $('#walletBtn').hidden = true;
  if (!d || !d.t) { $('#app').innerHTML = '<section class="card"><h2>This invite link isn\'t recognised</h2><p class="hint">Ask your host to send it again.</p></section>'; return; }
  const R = C.rsvp, K = C.kids, kids = !!d.kids;
  const form = { name: d.guest_name, plus: 1, adults: 1, diet: '', dietOk: false, allergy: '', parentOk: false, msg: '' };
  const read = () => { const v = id => ($('#' + id) || {}).value, ck = id => !!($('#' + id) || {}).checked; form.name = v('rn') || ''; form.msg = v('rm') || ''; if (kids) { form.adults = Math.max(0, +v('rad') || 0); form.parentOk = ck('rpc'); form.allergy = form.parentOk ? (v('ra') || '').trim() : ''; } else { form.plus = Math.max(1, +v('rp') || 1); form.dietOk = ck('rdc'); form.diet = form.dietOk ? (v('rd') || '').trim() : ''; } };
  const draw = st => {
    const fields = kids
      ? `<label>${esc(K.fChild)}<input id="rn" value="${esc(form.name)}" maxlength="40" data-testid="rn"></label>
        <label>${esc(K.fAdults)}<input id="rad" type="number" min="0" max="10" value="${form.adults}" data-testid="rad"></label>
        <label class="row"><input type="checkbox" id="rpc" ${form.parentOk ? 'checked' : ''} style="width:auto" data-testid="rpc"> ${esc(fillT(C.ui.parentConsent, d))}</label>
        <label>${esc(K.fAllergy)}<input id="ra" maxlength="160" value="${esc(form.allergy)}" ${form.parentOk ? '' : 'disabled'} data-testid="ra"></label>
        <label>${esc(K.fMsg)}<textarea id="rm" maxlength="240" data-testid="rm">${esc(form.msg)}</textarea></label>
        <p class="hint" style="margin-bottom:2px">${esc(K.fComing)}</p>`
      : `<label>${esc(R.fName)}<input id="rn" value="${esc(form.name)}" maxlength="60" data-testid="rn"></label>
        ${d.po ? `<label>${esc(R.fPlus)}<input id="rp" type="number" min="1" max="10" value="${form.plus}" data-testid="rp"></label>` : ''}
        <label>${esc(R.fDiet)}<input id="rd" maxlength="120" value="${esc(form.diet)}" data-testid="rd"></label><label class="row"><input type="checkbox" id="rdc" ${form.dietOk ? 'checked' : ''} style="width:auto" data-testid="rdc"> ${esc(fillT(C.ui.dietConsent, d))}</label>
        <label>${esc(R.fMsg)}<textarea id="rm" maxlength="240" data-testid="rm">${esc(form.msg)}</textarea></label>`;
    const btns = kids ? [['yes', K.yes], ['no', K.no], ['maybe', K.maybe]] : [['yes', R.yes], ['no', R.no], ['maybe', R.maybe]];
    $('#app').innerHTML = `${inviteCard(d, d.d)}<section class="card" data-testid="rsvp-page"><h2>${esc(R.heading)}</h2>${fields}
      <div class="seg mt" id="rb">${btns.map(([k, l]) => `<button data-r="${k}" class="${st === k ? 'on ' + k : ''}" data-testid="r-${k}">${esc(l)}</button>`).join('')}</div>
      <div id="ro" data-testid="ro"></div>
      ${d.cp && d.cp.length ? `<h3>${kids ? 'Your mocktail coupons' : 'Your drink coupons'}</h3>${d.ch && !kids ? `<p>${esc(C.coupon.choiceLine)}</p>` : ''}${d.cp.filter(c => !kids || c.kind === 'mocktail').map(c => couponCard(c.txt || fillT(C.coupon[c.kind], Object.assign({}, d, { code: c.code })), c.kind)).join('')}${kids ? `<p class="hint" data-testid="kids-ingredients">${esc(fillT(C.kids.ingredients, d))}</p>` : ''}<p class="hint">${esc(C.coupon.smallPrint)}</p>` : ''}
      <p class="hint small" data-testid="privacy">${esc(fillT(C.privacy, d))}${kids ? ' ' + esc(K.privacyExtra) : ''}</p></section>`;
    const pc = $('#rpc'); if (pc) pc.onchange = () => { read(); draw(st); }; // allergies field stays locked until the parent/carer tick
    $$('#rb button').forEach(b => b.onclick = () => {
      read(); const k = b.dataset.r, line = 'RSVP:' + d.t + ':' + k, plus = kids ? 0 : (d.po ? form.plus - 1 : 0);
      let local = false; // same device as the host (preview demo): update the host's list directly
      try { const H = JSON.parse(localStorage.getItem(KEY)); const g = H && H.guests.find(x => x.id === d.gid && x.token === d.t); if (g) { g.rsvp = k; g.plus = plus; g.diet = form.diet; g.allergy = form.allergy; g.adultsStaying = form.adults; g.msg = form.msg; localStorage.setItem(KEY, JSON.stringify(H)); local = true; } } catch (e) {}
      const body = (d.host_name ? 'Hi ' + d.host_name + ',\n\n' : '') + form.name + ': ' + k + (plus ? ' (+' + plus + ')' : '') + (kids ? '\nAdults staying: ' + form.adults : '') + (form.diet ? '\nDietary: ' + form.diet : '') + (form.allergy ? '\nAllergies or dietary needs: ' + form.allergy : '') + (form.msg ? '\nMessage: ' + form.msg : '') + '\n\n' + line;
      const txt = k === 'yes' ? (kids ? C.ui.kidsConfirmYes : R.confirmYes) : k === 'no' ? fillT(R.confirmNo, d) : '';
      draw(k);
      $('#ro').innerHTML = `${txt ? `<p class="note" data-testid="r-thanks">${esc(txt)}</p>` : ''}${d.he ? `<a class="btn small" href="mailto:${encodeURIComponent(d.he)}?subject=${encodeURIComponent('RSVP ' + k + ': ' + (kids ? d.child_name : d.event_name))}&body=${encodeURIComponent(body)}" data-testid="r-mail">✉ Send my reply to ${esc(d.host_name)}</a>` : ''}<p class="hint small">Reply code: <b>${esc(line)}</b>${local ? ' · saved on this device' : ''}</p>`;
    });
  };
  draw(null);
}

// ---------- boot ----------
document.title = CFG.appName + ' ' + CFG.brand; $('#appName').textContent = CFG.appName; $('#appBrand').textContent = CFG.brand;
$('#modal').onclick = e => { if (e.target.id === 'modal' || e.target.hasAttribute('data-close')) $('#modal').hidden = true; };
$('#walletBtn').onclick = openWallet;
$$('#tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); });
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); render(); } });
window.addEventListener('hashchange', () => location.reload());
window.IE = { state: () => S, isCharged, chargeGuests, entitlement: g => entitlement(g), coupons, wallet, mime, autoPurge, hasToken: () => gToken !== null };
if (/^#rsvp=/.test(location.hash)) guestView(); else render();
})();
