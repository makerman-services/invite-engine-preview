/* Invite & Pour (working name): invitations from the host's own Gmail, RSVP links, bar drink coupons, Robot Crew-style tokens.
   PREVIEW BUILD: never sends email (no Gmail sign-in at all: hosts copy or share invite links), never charges (no payment code at all),
   no AI calls, no backend. Coupons are created only when a guest RSVPs yes, and open from a QR code (generated in the browser). (c) Makerman Services. */
(function () {
'use strict';
const PREVIEW_NO_SEND = true; // email sending is "coming soon": no Gmail sign-in, no send code in this build
const KEY = 'invitePour.v1', WKEY = 'invitePour.wallet.v1', UKEY = 'invitePour.used.v1';
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
function blank() { return { ev: { id: code(10), name: '', host: '', hostEmail: '', date: '', time: '19:00', venue: '', note: '', rsvpBy: '', alcohol: true, kids: false, child: '', age: '', endTime: '', dropOff: '', plusOnes: false, pageBg: '', design: CFG.art.invites[0].id }, bar: { mode: 'choice', mc: 2, cc: 1, m: 2, c: 1 }, guests: [], tab: 'event' }; }
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.ev) return s; } catch (e) {} return blank(); }
function fixEv() { S.ev.id = S.ev.id || code(10); if (!S.ev.kids && !S.ev.alcohol && ['cock1', 'choice'].includes(S.bar.mode)) S.bar.mode = 'mock2'; if (S.ev.kids) { S.ev.alcohol = false; if (!['mock2', 'custom', 'none'].includes(S.bar.mode)) S.bar.mode = 'mock2'; } }
function save() { fixEv(); localStorage.setItem(KEY, JSON.stringify(S)); }
function deleteDate(ev) { if (!ev.date) return null; const d = new Date(ev.date + 'T00:00:00'); d.setDate(d.getDate() + CFG.deleteAfterDays); return d; }
const fmtD = d => d ? d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); };
// Legal: delete guest data automatically after the event (deleteAfterDays after the event date)
function autoPurge() { const d = deleteDate(S.ev); if (d && Date.now() >= d.getTime() && S.guests.length) { S.guests = []; const u = usedAll(); Object.keys(u).forEach(k => { if (k.startsWith(S.ev.id + ':')) delete u[k]; }); localStorage.setItem(UKEY, JSON.stringify(u)); save(); return true; } return false; }

// ---------- coupons: exactly ONE set per guest, unique codes, under-18 = mocktails only ----------
function entitlement(g) {
  const b = S.bar; let m = 2, c = 0, choice = false;
  if (b.mode === 'mock2') { m = clamp(b.mc == null ? 2 : b.mc); } else if (b.mode === 'cock1') { m = 0; c = clamp(b.cc == null ? 1 : b.cc); } else if (b.mode === 'choice') { m = 2; c = 1; choice = true; } else if (b.mode === 'custom') { m = clamp(b.m); c = clamp(b.c); }
  if (g.under18 || !S.ev.alcohol || S.ev.kids) { // ENFORCED HERE: kids' party mode, under-18 guest or alcohol-free event: no cocktail coupon is ever issued to an under-18 guest (or at an alcohol-free event)
    if (choice) return { m: 2, c: 0, choice: false };
    return { m: m + 2 * c, c: 0, choice: false }; // each cocktail is swapped for 2 mocktails
  }
  return { m, c, choice };
}
const clamp = n => Math.max(0, Math.min(10, Math.round(+n || 0)));
function h53(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0); }
// The coupon set ID for one guest at one event. PREVIEW ONLY: derived from the event ID + the guest's secret RSVP token so the
// host's Bar check and the guest's QR page agree without a server. The real app creates random IDs on the server (see SERVER.md).
function setFor(eid, tok, em) { let n = h53('set:' + eid + ':' + tok + ':' + String(em || '').trim().toLowerCase()), s = ''; for (let i = 0; i < 8; i++) { s += ALPH[n % 32]; n = Math.floor(n / 32); } return s.slice(0, 4) + '-' + s.slice(4); }
function ensureCodes() { // one RSVP token per guest; the coupon set exists ONLY once the guest has RSVPed yes
  const toks = new Set();
  S.guests.forEach(g => { if (g.token && !toks.has(g.token)) toks.add(g.token); else delete g.token; });
  S.guests.forEach(g => {
    if (!g.token) { let t; do { t = code(12); } while (toks.has(t)); toks.add(t); g.token = t; }
    if (g.rsvp === 'yes' && g.rsvpEmail) g.set = setFor(S.ev.id, g.token, g.rsvpEmail); else delete g.set;
    g.redeemed = g.redeemed || [];
  });
}
// Pure generator: the one-use coupons in one set. Cocktails only for an adult guest at an adults' event with alcohol (belt and braces).
function couponsFor(set, e, adultOk) { const out = []; if (!set) return out; for (let i = 1; i <= e.m; i++) out.push({ kind: 'mocktail', code: set + '-M' + i }); if (adultOk) for (let i = 1; i <= e.c; i++) out.push({ kind: 'cocktail', code: set + '-C' + i }); return out; }
function coupons(g) { // NONE until this guest RSVPs yes
  const e = entitlement(g);
  return { e, list: g.rsvp === 'yes' ? couponsFor(g.set || setFor(S.ev.id, g.token || '', g.rsvpEmail || ''), e, !S.ev.kids && !g.under18 && S.ev.alcohol) : [] };
}
const hasCoupons = e => e.m + e.c > 0;
// 'used' is remembered on THIS device only (localStorage). The real app checks each coupon once on the server.
// Partly masked email for coupons and the bar: first 2 letters, then •••, then the domain (jo•••@gmail.com). Only the host's list shows it in full.
function maskEmail(e) { e = String(e || '').trim(); const i = e.lastIndexOf('@'); if (i < 1) return ''; const L = e.slice(0, i); return L.slice(0, L.length > 2 ? 2 : 1) + '•••' + e.slice(i); }
// 30-day auto-delete for this device's 'used' records too: each record carries the event's delete date
const usedAll = () => { let u; try { u = JSON.parse(localStorage.getItem(UKEY)) || {}; } catch (e) { u = {}; } let ch = false; Object.keys(u).forEach(k => { const r = u[k]; if (r && r.del && Date.now() >= r.del) { delete u[k]; ch = true; } }); if (ch) localStorage.setItem(UKEY, JSON.stringify(u)); return u; };
const isUsed = (eid, c) => !!usedAll()[eid + ':' + c];
function markUsed(eid, c, del) { const u = usedAll(), k = eid + ':' + c; if (u[k]) return false; u[k] = { at: Date.now(), del: del || null }; localStorage.setItem(UKEY, JSON.stringify(u)); return true; }
const couponEvent = () => S.ev.kids ? (S.ev.name || (S.ev.child || 'our birthday star') + "'s party") : (S.ev.name || 'our party');
function couponTextFrom(kids, kind, v) { return fillT(kids ? C.kids.mocktail : C.coupon[kind], v); }
function couponText(g, cp) { return couponTextFrom(S.ev.kids, cp.kind, { event_name: couponEvent(), guest_name: g.name, code: cp.code, host_name: S.ev.host || 'your host' }); }
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
  w.ledger.unshift({ at: Date.now(), kind: 'spend', amount: -n, note: todo.length + ' new guest invite link' + (todo.length === 1 ? '' : 's') + (PREVIEW_NO_SEND ? ' (preview)' : '') + (fromFree ? ' (' + fromFree + ' free)' : '') });
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

// ---------- no Gmail sign-in in this build: "Email sending coming soon" (hosts copy or share links) ----------

// ---------- links + email ----------
function vars(g) { const ev = S.ev; return { kids: !!ev.kids, event_name: ev.name || 'our party', host_name: ev.host || 'your host', guest_name: g ? g.name : '', date: ev.date ? fmtD(new Date(ev.date + 'T00:00:00')) : 'Date to be confirmed', time: fmtTime(ev.time), venue: ev.venue || 'Venue to be confirmed', host_note: ev.note || '', rsvp_deadline: ev.rsvpBy ? fmtD(new Date(ev.rsvpBy + 'T00:00:00')) : 'soon', delete_date: fmtD(deleteDate(ev)) || '30 days after the event', child_name: ev.child || 'our birthday star', age: ev.age || '', start_time: fmtTime(ev.time), end_time: fmtTime(ev.endTime) || 'late', drop_off_note: ev.dropOff || '' }; }
function payload(g) { const e = entitlement(g); return { v: 2, t: g.token, gid: g.id, eid: S.ev.id, ...vars(g), he: S.ev.hostEmail, d: S.ev.design, pb: S.ev.pageBg, k: S.ev.kids ? 1 : 0, po: S.ev.plusOnes ? 1 : 0, u18: g.under18 ? 1 : 0, alc: S.ev.alcohol ? 1 : 0, ch: e.choice ? 1 : 0, m: e.m, c: e.c, cen: couponEvent(), del: deleteDate(S.ev) ? deleteDate(S.ev).getTime() : 0 }; } // entitlement only: NO coupons in the invite
const base = () => location.origin + location.pathname.replace(/coupon\.html$/, '');
const dir = () => location.origin + location.pathname.replace(/[^/]*$/, '');
const rsvpLink = g => base() + '#rsvp=' + b64u(JSON.stringify(payload(g)));
// The text a host copies or shares (from the Legal email copy). No coupons in it: they're created on RSVP yes.
function inviteText(g) {
  const v = Object.assign(vars(g), { rsvp_link: rsvpLink(g) }), has = hasCoupons(entitlement(g));
  const L0 = (S.ev.kids ? C.kids.lines : C.email.lines).slice();
  const out = [];
  L0.forEach(l => {
    if (l === '{host_note}' && !v.host_note) return;
    if (l.startsWith('@coupon:')) { if (has && !/included below/.test(l)) out.push(l.slice(8)); return; } // "included below" no longer true: coupons come after RSVP yes
    out.push(l);
    if (has && /\{rsvp_link\}/.test(l)) out.push(S.ev.kids ? C.ui.kidsCouponAfterYes : C.ui.couponAfterYes);
  });
  return out.map(l => fillT(l, v).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2').replace(/\s+$/, '')).join('\n');
}
const shareTitle = g => fillT(S.ev.kids ? C.kids.subject : C.email.subject, vars(g));

// ---------- invite + coupon visuals (text drawn live over the art) ----------
const art = id => CFG.art.invites.find(a => a.id === id) || CFG.art.invites[0];
function inviteCard(v, design) { const a = art(design); return `<div class="inv" style="${a.src ? `background-image:url('${esc(a.src)}')` : `background:${a.css}`};color:${a.ink}" data-testid="invite-card">${a.emoji ? `<div class="emo">${a.emoji}</div>` : ''}<div class="pane" style="background:${a.pane}">${v.kids ? `<p>${esc(fillT("You're invited to {child_name}'s birthday party, turning {age}!", v))}</p><h1>${esc(v.child_name)}</h1><p>📅 ${esc(v.date)} · ⏰ ${esc(v.start_time)} to ${esc(v.end_time)}</p>` : `<p>${esc(v.host_name)} would love you to join</p><h1>${esc(v.event_name)}</h1><p>📅 ${esc(v.date)} · ⏰ ${esc(v.time)}</p>`}<p>📍 ${esc(v.venue)}</p>${v.host_note ? `<p><i>${esc(v.host_note)}</i></p>` : ''}</div>${a.ai ? `<small class="artlabel" data-testid="art-label">${esc(C.artLabel)}</small>` : ''}</div>`; }
function couponCard(text, kind) { return `<div class="cpn" style="background-image:url('${esc(CFG.art[kind])}')" data-testid="coupon-${kind}"><div class="cpt">${esc(text)}</div>${CFG.art.couponAi ? `<small class="artlabel">${esc(C.artLabel)}</small>` : ''}</div>`; }

// ---------- host screens ----------
const pageList = kids => ((CFG.art.page || {})[kids ? 'kids' : 'adult'] || []);
function pageArt(kids, id) { const L = pageList(kids); return id === 'none' ? null : (L.find(x => x.id === id) || L[0] || null); }
function setPage(kids, id) { // full-page art from config; falls back to plain colour
  const P = CFG.art.page || {}, art = pageArt(kids, id), src = art && art.src, ai = art && art.ai, bg = $('#pageBg'), lab = $('#pageArtLabel'); if (!bg) return;
  bg.style.backgroundColor = P.colour || ''; bg.style.backgroundImage = src ? `url('${src}')` : 'none';
  document.querySelector('.page-fade').style.display = src ? '' : 'none';
  lab.hidden = !(src && ai); lab.textContent = 'Background: ' + C.artLabel;
  const cap = $('#pageCap'); if (cap) { cap.hidden = !(src && ai); cap.textContent = C.artLabel + (art && art.notice ? ' · ' + art.notice : ''); }
  const no = $('#pageArtNotice'); if (no) { no.hidden = !(src && art.notice); no.textContent = (art && art.notice) || ''; }
}
function render() {
  setPage(!!S.ev.kids, S.ev.pageBg);
  autoPurge(); ensureCodes(); save();
  $('#tokBal').textContent = wallet().balance;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  ({ event: rEvent, guests: rGuests, drinks: rDrinks, send: rSend, bar: rBar })[S.tab]();
}
function rEvent() {
  const ev = S.ev, f = (k, l, t = 'text', x = '') => `<label>${l}<input data-ev="${k}" type="${t}" value="${esc(ev[k])}" ${x} data-testid="ev-${k}"></label>`;
  $('#app').innerHTML = `<section class="card"><h2>Your event</h2>${f('name', 'Event name', 'text', 'maxlength="80"')}<div class="grid2">${f('host', 'Your name (host)', 'text', 'maxlength="60"')}${f('hostEmail', 'Your email (optional, for RSVP replies)', 'email', 'maxlength="120"')}${f('date', 'Date', 'date')}${f('time', 'Start time', 'time')}${f('rsvpBy', 'RSVP by', 'date')}${f('venue', 'Venue', 'text', 'maxlength="120"')}</div>
    <label>Note for guests (optional)<textarea data-ev="note" maxlength="240" data-testid="ev-note">${esc(ev.note)}</textarea></label>
    <label class="row"><input type="checkbox" data-evc="kids" ${ev.kids ? 'checked' : ''} style="width:auto" data-testid="kids-mode"> Kids' party</label>${ev.kids ? `<p class="note" data-testid="kids-note">${esc(C.kids.hostNote)}</p><div class="grid2">${f('child', "Birthday child's first name", 'text', 'maxlength="40"')}${f('age', 'Turning (age)', 'number', 'min="1" max="17"')}${f('endTime', 'Finish time', 'time')}${f('dropOff', 'Drop-off note (optional)', 'text', 'maxlength="120"')}</div>` : ''}
    <label class="row"><input type="checkbox" data-evc="plusOnes" ${ev.plusOnes ? 'checked' : ''} style="width:auto"> Guests can bring plus-ones</label>
    <p class="hint">Guest details are deleted automatically ${CFG.deleteAfterDays} days after the event${deleteDate(ev) ? ' (on ' + esc(fmtD(deleteDate(ev))) + ')' : ''}.</p></section>
    <section class="card"><h2>Design</h2><div class="designs">${designs().map(a => `<button data-design="${a.id}" class="${ev.design === a.id ? 'on' : ''}" data-testid="design-${a.id}"><div class="sw" style="${a.src ? `background-image:url('${esc(a.src)}')` : `background:${a.css}`}">${a.emoji ? a.emoji.split(' ')[0] : ''}</div>${esc(a.name)}</button>`).join('')}</div>
    <h3>Page background</h3><select id="pageBgSel" data-testid="page-bg">${pageList(ev.kids).map(p => `<option value="${p.id}" ${(pageArt(ev.kids, ev.pageBg) || {}).id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="none" ${ev.pageBg === 'none' ? 'selected' : ''}>Plain colour</option></select>${(pageArt(ev.kids, ev.pageBg) || {}).notice ? `<p class="hint" id="pageBgNotice" data-testid="page-bg-notice">${esc(pageArt(ev.kids, ev.pageBg).notice)}</p>` : ''}
    <h3>Preview</h3>${inviteCard(vars(null), ev.design)}</section>`;
  $$('[data-ev]').forEach(i => i.onchange = () => { ev[i.dataset.ev] = i.value.trim(); save(); render(); });
  $$('[data-evc]').forEach(i => i.onchange = () => { ev[i.dataset.evc] = i.checked; if (i.dataset.evc === 'kids') { if (!designs().some(d => d.id === ev.design)) ev.design = designs()[0].id; ev.pageBg = ''; S.bar.mode = ev.kids ? 'mock2' : 'choice'; S.bar.mc = 2; S.bar.cc = 1; } save(); render(); });
  $('#pageBgSel').onchange = e => { ev.pageBg = e.target.value; save(); render(); };
  $$('[data-design]').forEach(b => b.onclick = () => { ev.design = b.dataset.design; save(); render(); });
}
function track(x, cp) { const em = x.rsvpEmail || x.email, used = cp.list.filter(c => isUsed(S.ev.id, c.code)).length; return `<br><small data-testid="track-${x.id}">${em ? esc(em) : 'No email yet'} · RSVP: ${esc(x.rsvp || 'not yet')} · Coupons issued: <b data-testid="issued-${x.id}">${cp.list.length}</b> · Used: <b data-testid="used-${x.id}">${used}</b></small>`; }
function couponStatus(x, cp) { const d = esc(describe(cp.e)); if (!hasCoupons(cp.e)) return 'No drink coupons'; return x.rsvp === 'yes' ? `Coupon set ${esc(x.set)}: ${d} (created on RSVP yes)` : `Coupons: ${d}, created when they RSVP yes`; }
function designs() { return CFG.art.invites.filter(a => S.ev.kids ? a.kids : a.adults !== false); }
function rGuests() {
  const g = S.guests;
  let h = `<section class="card"><h2>Guests <small class="hint">${g.length}</small></h2><p class="hint">One line per guest: Name, email</p><textarea id="gAdd" data-testid="g-add" placeholder="Sam Lee, sam@example.com"></textarea><div class="row mt"><button class="btn small" id="gAddBtn" data-testid="g-add-btn">Add guests</button></div>
    <p class="hint">Email is optional. You'll copy or share each guest's invite link in step 4.</p>`;
  h += g.map(x => { const cp = coupons(x); return `<div class="g" data-testid="g-${x.id}"><div class="top2"><b>${esc(x.name)}</b><small data-testid="rsvp-${x.id}">RSVP: ${esc(x.rsvp || 'not sent')}${x.plus ? ' +' + x.plus : ''}</small></div>
    <input type="email" data-email="${x.id}" value="${esc(x.email || '')}" placeholder="Guest email" maxlength="120" data-testid="email-${x.id}">
    ${S.ev.kids ? `<small>Adults staying: ${+x.adultsStaying || 0}</small><br><small data-testid="set-${x.id}">${couponStatus(x, cp)}</small>${track(x, cp)}` : `<label class="row"><input type="checkbox" data-u18="${x.id}" ${x.under18 ? 'checked' : ''} style="width:auto" data-testid="u18-${x.id}"> ${esc(C.under18Toggle)}</label>
    <small data-testid="set-${x.id}">${couponStatus(x, cp)}</small>${track(x, cp)}`}${x.diet ? `<br><small>Dietary: ${esc(x.diet)}</small>` : ''}${x.allergy ? `<br><small data-testid="allergy-${x.id}">⚠ Allergies (host only): ${esc(x.allergy)}</small>` : ''}${x.msg ? `<br><small>Message: ${esc(x.msg)}</small>` : ''}
    <div class="row mt"><a class="linkb" href="${esc(rsvpLink(x))}" target="_blank" rel="noopener" data-testid="open-${x.id}">preview their invite</a><button class="linkb" data-del="${x.id}">remove</button></div></div>`; }).join('');
  h += `<h3>RSVP replies by email</h3><p class="hint">Paste replies that contain a line like RSVP:XXXXXXXXXXXX:yes:guest@example.com</p><div class="row"><input id="rPaste" data-testid="r-paste"><button class="btn small alt" id="rApply" data-testid="r-apply">Update</button></div>`;
  h += g.length ? `<div class="row mt"><button class="btn small alt" id="delAll" data-testid="del-all">Delete all guest data now</button></div>` : '';
  $('#app').innerHTML = h + '</section>';
  $('#gAddBtn').onclick = () => { $('#gAdd').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { const [n, e] = l.split(/\s*[,;\t]\s*/); if (e && g.some(x => (x.email || '').toLowerCase() === e.trim().toLowerCase())) return toast('Already on the list: ' + e); if (n) g.push({ id: uid(), name: n.slice(0, 60), email: validEmail(e) ? e.trim() : '', under18: false, rsvp: '' }); }); save(); render(); };
  $$('[data-email]').forEach(i => i.onchange = () => { g.find(x => x.id === i.dataset.email).email = i.value.trim(); save(); });
  $$('[data-u18]').forEach(i => i.onchange = () => { g.find(x => x.id === i.dataset.u18).under18 = i.checked; save(); render(); });
  $$('[data-del]').forEach(b => b.onclick = () => { if (!confirm('Remove this guest and their details?')) return; S.guests = g.filter(x => x.id !== b.dataset.del); save(); render(); });
  $('#rApply').onclick = () => { let n = 0; $('#rPaste').value.replace(/RSVP:([A-Z2-9]{12}):(yes|no|maybe)(?::([^\s:]+@[^\s:]+))?/gi, (m, t, k, em) => { const x = g.find(y => y.token === t.toUpperCase()); if (x && !(k.toLowerCase() === 'yes' && !validEmail(em))) { x.rsvp = k.toLowerCase(); if (validEmail(em)) { x.rsvpEmail = em.trim(); if (!x.email) x.email = x.rsvpEmail; } n++; } }); save(); render(); toast(n ? 'Updated ' + n : 'No RSVP lines found'); };
  const da = $('#delAll'); if (da) da.onclick = () => { if (!confirm('Delete every guest\'s details from this device?')) return; S.guests = []; save(); render(); };
}
function rDrinks() {
  const b = S.bar, alc = S.ev.alcohol, modes = S.ev.kids ? [['mock2', '2 mocktails'], ['custom', 'Custom'], ['none', 'None']] : [['mock2', '2 mocktails'], ['cock1', '1 cocktail'], ['choice', '2 mocktails or 1 cocktail'], ['custom', 'Custom'], ['none', 'None']];
  const sample = { name: 'Sample guest', set: 'ABCD-EFGH', token: '', rsvp: 'yes', under18: false }, s18 = Object.assign({}, sample, { under18: true });
  $('#app').innerHTML = `<section class="card"><h2>${S.ev.kids ? 'Mocktail coupons' : 'Bar drink coupons'}</h2><p class="hint">Each guest gets exactly one coupon set, created when they RSVP yes. Change the mix any time: codes stay the same.</p>
    ${S.ev.kids ? `<p class="note" data-testid="kids-drinks">${esc(C.kids.hostNote)}</p>` : `<label class="row"><input type="checkbox" id="alc" ${alc ? 'checked' : ''} style="width:auto" data-testid="alc"> Alcohol is served at this event</label>`}
    ${alc ? `<p class="note warm" data-testid="host-resp">${esc(C.hostResponsibility)}</p>` : ''}
    <label>Coupons per guest<select id="mode" data-testid="mode">${modes.map(([k, l]) => `<option value="${k}" ${b.mode === k ? 'selected' : ''} ${!alc && ['cock1', 'choice'].includes(k) ? 'disabled' : ''}>${l}</option>`).join('')}</select></label>
    ${b.mode === 'mock2' ? `<label>Mocktails per guest<input id="cmc" type="number" min="1" max="10" value="${b.mc == null ? 2 : b.mc}" data-testid="count"></label>` : ''}${b.mode === 'cock1' ? `<label>Cocktails per guest (18+)<input id="ccc" type="number" min="1" max="10" value="${b.cc == null ? 1 : b.cc}" data-testid="count"></label>` : ''}
    ${b.mode === 'custom' ? `<div class="grid2 mt"><label>Mocktails per guest<input id="cm" type="number" min="0" max="10" value="${b.m}" data-testid="cm"></label>${alc ? `<label>Cocktails per guest (18+)<input id="cc" type="number" min="0" max="10" value="${b.c}" data-testid="cc"></label>` : ''}</div>` : ''}
    <p class="hint" data-testid="rule">Each guest: ${esc(describe(entitlement(sample)))}.${S.ev.kids ? '' : ` Guests marked under 18: ${esc(describe(entitlement(s18)))}.`}</p>
    <h3>What a guest sees</h3>${entitlement(sample).choice ? `<p>${esc(C.coupon.choiceLine)}</p>` : ''}${coupons(sample).list.filter((c, i, l) => l.findIndex(x => x.kind === c.kind) === i).map(c => couponCard(couponText(sample, c), c.kind)).join('')}${S.ev.kids && coupons(sample).list.length ? `<p class="hint" data-testid="kids-ingredients">${esc(fillT(C.kids.ingredients, vars(null)))}</p>` : ''}<p class="hint">${esc(C.coupon.smallPrint)}</p></section>`;
  if ($('#alc')) $('#alc').onchange = e => { S.ev.alcohol = e.target.checked; if (!S.ev.alcohol && ['cock1', 'choice'].includes(b.mode)) b.mode = 'mock2'; save(); render(); };
  $('#mode').onchange = e => { b.mode = e.target.value; save(); render(); };
  const cmc = $('#cmc'), ccc = $('#ccc'); if (cmc) cmc.onchange = () => { b.mc = Math.max(1, clamp(cmc.value)); save(); render(); }; if (ccc) ccc.onchange = () => { b.cc = Math.max(1, clamp(ccc.value)); save(); render(); };
  const cm = $('#cm'), cc = $('#cc'); if (cm) cm.onchange = () => { b.m = clamp(cm.value); save(); render(); }; if (cc) cc.onchange = () => { b.c = clamp(cc.value); save(); render(); };
}
// 'none' mode: no coupons at all
const _ent = entitlement; entitlement = function (g) { if (S.bar.mode === 'none') return { m: 0, c: 0, choice: false }; if (S.ev.kids) return { m: S.bar.mode === 'custom' ? clamp(S.bar.m) : clamp(S.bar.mc == null ? 2 : S.bar.mc), c: 0, choice: false }; // kids: mocktails only, never a cocktail or the choice line
  const e = _ent(g); if (S.ev.kids || g.under18) { e.c = 0; e.choice = false; } return e; }; // eslint-disable-line no-func-assign

function rSend() {
  const all = S.guests, fresh = all.filter(x => !isCharged(x)), cost = fresh.length * T.perInvite, paid = all.filter(isCharged);
  $('#app').innerHTML = `<section class="card"><h2>Send invites</h2>
    <div class="note" data-testid="email-soon"><b>${esc(C.ui.emailSoonHead)}</b> ${esc(C.ui.emailSoon)}</div>
    <p data-testid="batch">${all.length} guest${all.length === 1 ? '' : 's'}. ${fresh.length} new, ${all.length - fresh.length} already paid (copying or sharing again is free). Getting links uses <b data-testid="cost">${cost}</b> token${cost === 1 ? '' : 's'} (1 token per guest, ${aud(T.unitCents)} each; you have ${wallet().balance}).</p>
    <div class="row"><button class="btn" id="prep" data-testid="prep-links" ${all.length ? '' : 'disabled'}>🔗 Get ${all.length} invite link${all.length === 1 ? '' : 's'}</button><button class="btn small alt" id="wal">Tokens</button></div>
    <div id="sendOut" data-testid="send-out"></div>
    ${paid.length ? `<h3>Invite links</h3>${paid.map(g => `<div class="g" data-testid="inv-${g.id}"><div class="top2"><b>${esc(g.name)}</b><small>RSVP: ${esc(g.rsvp || 'waiting')}</small></div>
      <input readonly value="${esc(rsvpLink(g))}" data-testid="link-${g.id}" aria-label="Invite link for ${esc(g.name)}" onclick="this.select()">
      <div class="row mt"><button class="btn small" data-copy="${g.id}" data-testid="copy-${g.id}">📋 Copy invite link</button><button class="btn small alt" data-share="${g.id}" data-testid="share-${g.id}">📤 Share</button></div></div>`).join('')}` : ''}</section>`;
  $('#wal').onclick = openWallet;
  $('#prep').onclick = () => {
    if (!all.length) return;
    if (!chargeGuests(all).ok) { $('#sendOut').innerHTML = `<p class="note warm" data-testid="no-tokens">You need ${cost} tokens for these links. Open Tokens to add a test pack.</p>`; return; }
    all.forEach(g => { g.rsvp = g.rsvp || 'invited'; g.linkAt = g.linkAt || Date.now(); }); save(); rSend();
    $('#sendOut').innerHTML = `<div class="note warm" data-testid="links-ready">${all.length} invite link${all.length === 1 ? '' : 's'} ready. ${cost} preview token${cost === 1 ? '' : 's'} used. Nothing was sent: copy or share each link below.</div>`;
    $('#tokBal').textContent = wallet().balance;
  };
  $$('[data-copy]').forEach(b => b.onclick = () => { const g = S.guests.find(x => x.id === b.dataset.copy); IE.last = { how: 'copy', url: rsvpLink(g) }; copyTxt(rsvpLink(g)); });
  $$('[data-share]').forEach(b => b.onclick = async () => {
    const g = S.guests.find(x => x.id === b.dataset.share), url = rsvpLink(g), data = { title: shareTitle(g), text: inviteText(g), url };
    if (navigator.share) { try { await navigator.share(data); IE.last = { how: 'share', url }; toast('Shared'); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    IE.last = { how: 'copy', url, fallback: true }; copyTxt(inviteText(g)); toast("Sharing isn't available here, so the invite was copied");
  });
}
function rBar() {
  $('#app').innerHTML = `<section class="card"><h2>Bar check</h2><p class="hint">Scan the guest's QR code with any phone camera, or type a coupon code here. Each coupon works once.</p>
    <p class="note warm" data-testid="single-use-note">${esc(C.ui.singleUse)}</p><div class="row"><input id="bc" placeholder="ABCD-EFGH-M1" data-testid="bc"><button class="btn small" id="bcBtn" data-testid="bc-btn">Check and use</button></div><p id="bcOut" data-testid="bc-out"></p>
    <table><tr><th>Guest</th><th>RSVP</th><th>Coupons</th><th>Used</th></tr>${S.guests.map(g => { const c = coupons(g); return `<tr><td>${esc(g.name)}${g.under18 ? ' (under 18)' : ''}${g.rsvpEmail ? `<br><small data-testid="bar-em-${g.id}">${esc(maskEmail(g.rsvpEmail))}</small>` : ''}</td><td>${esc(g.rsvp || '-')}</td><td>${g.rsvp === 'yes' ? esc(g.set) + ': ' + esc(describe(c.e)) : 'none yet'}</td><td>${c.list.filter(x => isUsed(S.ev.id, x.code)).length}</td></tr>`; }).join('')}</table></section>`;
  $('#bcBtn').onclick = () => {
    const v = $('#bc').value.trim().toUpperCase(), o = $('#bcOut');
    const g = S.guests.find(x => x.rsvp === 'yes' && v.startsWith(x.set + '-')), pending = !g && S.guests.find(x => x.rsvp !== 'yes' && x.token && (v.startsWith(setFor(S.ev.id, x.token) + '-') || (x.rsvpEmail && v.startsWith(setFor(S.ev.id, x.token, x.rsvpEmail) + '-'))));
    if (pending) { o.textContent = fillT(C.ui.notYes, { guest_name: pending.name }); return; }
    if (!g) { o.textContent = 'Not a coupon for this event.'; return; }
    if (S.ev.kids && /-C\d+$/.test(v)) { o.textContent = "No cocktails at kids' parties."; return; }
    const c = coupons(g), cp = c.list.find(x => x.code === v);
    if (!cp) { o.textContent = 'Not a valid coupon for ' + g.name + '.'; return; }
    if (isUsed(S.ev.id, v)) { o.textContent = 'Already used.'; return; }
    const block = choiceBlock(c.e.choice, c.list, cp, S.ev.id); if (block) { o.textContent = g.name + ' already chose ' + block + '.'; return; }
    if (!markUsed(S.ev.id, v, deleteDate(S.ev) ? deleteDate(S.ev).getTime() : null)) { o.textContent = 'Already used.'; return; }
    g.redeemed.push(v); save(); o.textContent = 'OK: 1 ' + cp.kind + ' for ' + g.name + (g.rsvpEmail ? ' (' + maskEmail(g.rsvpEmail) + ')' : '') + '.' + (cp.kind === 'cocktail' ? ' 18+ only: check ID.' : ''); rBarTableOnly();
  };
}
// "2 mocktails or 1 cocktail": once one kind is used, the other kind is gone
function choiceBlock(choice, list, cp, eid) { if (!choice) return ''; const usedC = list.some(x => x.kind === 'cocktail' && isUsed(eid, x.code)), usedM = list.some(x => x.kind === 'mocktail' && isUsed(eid, x.code)); if (cp.kind === 'cocktail' && usedM) return 'mocktails'; if (cp.kind === 'mocktail' && usedC) return 'the cocktail'; return ''; }
function rBarTableOnly() { const keep = $('#bcOut').textContent; rBar(); $('#bcOut').textContent = keep; }

// ---------- guest RSVP page (#rsvp=...) ----------
function guestView() {
  let d; try { d = JSON.parse(unb64u(location.hash.slice(6))); } catch (e) { d = null; }
  $('#tabs').hidden = true; $('#walletBtn').hidden = true;
  if (!d || !d.t) { $('#app').innerHTML = '<section class="card"><h2>This invite link isn\'t recognised</h2><p class="hint">Ask your host to send it again.</p></section>'; return; }
  const R = C.rsvp, K = C.kids, kids = !!d.kids;
  // Guest-side guard too: kids' parties and under-18 guests never get a cocktail or the choice line
  const adultOk = !kids && !d.u18 && !!d.alc, E = { m: clamp(d.m), c: adultOk ? clamp(d.c) : 0, choice: adultOk && !!d.ch }, hasC = hasCoupons(E);
  setPage(kids, d.pb);
  const form = { name: d.guest_name, email: '', plus: 1, adults: 1, diet: '', dietOk: false, allergy: '', parentOk: false, msg: '' };
  const read = () => { const v = id => ($('#' + id) || {}).value, ck = id => !!($('#' + id) || {}).checked; form.name = v('rn') || ''; form.email = (v('re') || '').trim(); form.msg = v('rm') || ''; if (kids) { form.adults = Math.max(0, +v('rad') || 0); form.parentOk = ck('rpc'); form.allergy = form.parentOk ? (v('ra') || '').trim() : ''; } else { form.plus = Math.max(1, +v('rp') || 1); form.dietOk = ck('rdc'); form.diet = form.dietOk ? (v('rd') || '').trim() : ''; } };
  const draw = st => {
    const fields = kids
      ? `<label>${esc(K.fChild)}<input id="rn" value="${esc(form.name)}" maxlength="40" data-testid="rn"></label>
        <label>${esc(kids ? C.ui.fEmailKids : C.ui.fEmail)}<input id="re" type="email" inputmode="email" autocomplete="email" value="${esc(form.email)}" maxlength="120" data-testid="re" aria-describedby="reConsent"></label><p class="hint small" id="reConsent" data-testid="email-consent">${esc(C.ui.emailConsent)}</p><p class="err" id="reErr" data-testid="email-err" hidden></p>
        <label>${esc(K.fAdults)}<input id="rad" type="number" min="0" max="10" value="${form.adults}" data-testid="rad"></label>
        <label class="row"><input type="checkbox" id="rpc" ${form.parentOk ? 'checked' : ''} style="width:auto" data-testid="rpc"> ${esc(fillT(C.ui.parentConsent, d))}</label>
        <label>${esc(K.fAllergy)}<input id="ra" maxlength="160" value="${esc(form.allergy)}" ${form.parentOk ? '' : 'disabled'} data-testid="ra"></label>
        <label>${esc(K.fMsg)}<textarea id="rm" maxlength="240" data-testid="rm">${esc(form.msg)}</textarea></label>
        <p class="hint" style="margin-bottom:2px">${esc(K.fComing)}</p>`
      : `<label>${esc(R.fName)}<input id="rn" value="${esc(form.name)}" maxlength="60" data-testid="rn"></label>
        <label>${esc(kids ? C.ui.fEmailKids : C.ui.fEmail)}<input id="re" type="email" inputmode="email" autocomplete="email" value="${esc(form.email)}" maxlength="120" data-testid="re" aria-describedby="reConsent"></label><p class="hint small" id="reConsent" data-testid="email-consent">${esc(C.ui.emailConsent)}</p><p class="err" id="reErr" data-testid="email-err" hidden></p>
        ${d.po ? `<label>${esc(R.fPlus)}<input id="rp" type="number" min="1" max="10" value="${form.plus}" data-testid="rp"></label>` : ''}
        <label>${esc(R.fDiet)}<input id="rd" maxlength="120" value="${esc(form.diet)}" data-testid="rd"></label><label class="row"><input type="checkbox" id="rdc" ${form.dietOk ? 'checked' : ''} style="width:auto" data-testid="rdc"> ${esc(fillT(C.ui.dietConsent, d))}</label>
        <label>${esc(R.fMsg)}<textarea id="rm" maxlength="240" data-testid="rm">${esc(form.msg)}</textarea></label>`;
    const btns = kids ? [['yes', K.yes], ['no', K.no], ['maybe', K.maybe]] : [['yes', R.yes], ['no', R.no], ['maybe', R.maybe]];
    $('#app').innerHTML = `${inviteCard(d, d.d)}<section class="card" data-testid="rsvp-page"><h2>${esc(R.heading)}</h2>${fields}
      <div class="seg mt" id="rb">${btns.map(([k, l]) => `<button data-r="${k}" class="${st === k ? 'on ' + k : ''}" data-testid="r-${k}">${esc(l)}</button>`).join('')}</div>
      <div id="ro" data-testid="ro"></div>
      ${hasC && st !== 'yes' ? `<p class="hint" data-testid="coupons-after-yes">${esc(kids ? C.ui.kidsCouponAfterYes : C.ui.couponAfterYes)}</p>` : ''}
      <p class="hint small" data-testid="privacy">${esc(fillT(C.privacy, d))}${kids ? ' ' + esc(K.privacyExtra) : ''}</p></section>`;
    const pc = $('#rpc'); if (pc) pc.onchange = () => { read(); draw(st); }; // allergies field stays locked until the parent/carer tick
    $$('#rb button').forEach(b => b.onclick = () => {
      read(); const k = b.dataset.r, plus = kids ? 0 : (d.po ? form.plus - 1 : 0);
      if ((form.email && !validEmail(form.email)) || (k === 'yes' && !validEmail(form.email))) { const er = $('#reErr'); er.textContent = form.email ? C.ui.emailBad : C.ui.emailNeeded; er.hidden = false; $('#re').focus(); return; } // email required on Yes; format checked
      const line = 'RSVP:' + d.t + ':' + k + (validEmail(form.email) ? ':' + form.email : '');
      let local = false; // same device as the host (preview demo): update the host's list directly
      try { const H = JSON.parse(localStorage.getItem(KEY)); const g = H && H.guests.find(x => x.id === d.gid && x.token === d.t); if (g) { g.rsvp = k; if (validEmail(form.email)) { g.rsvpEmail = form.email; if (!g.email) g.email = form.email; } g.plus = plus; g.diet = form.diet; g.allergy = form.allergy; g.adultsStaying = form.adults; g.msg = form.msg; localStorage.setItem(KEY, JSON.stringify(H)); local = true; } } catch (e) {}
      const body = (d.host_name ? 'Hi ' + d.host_name + ',\n\n' : '') + form.name + (form.email ? ' <' + form.email + '>' : '') + ': ' + k + (plus ? ' (+' + plus + ')' : '') + (kids ? '\nAdults staying: ' + form.adults : '') + (form.diet ? '\nDietary: ' + form.diet : '') + (form.allergy ? '\nAllergies or dietary needs: ' + form.allergy : '') + (form.msg ? '\nMessage: ' + form.msg : '') + '\n\n' + line;
      const txt = k === 'yes' ? (kids ? C.ui.kidsConfirmYes : R.confirmYes) : k === 'no' ? fillT(R.confirmNo, d) : '';
      draw(k);
      $('#ro').innerHTML = `${txt ? `<p class="note" data-testid="r-thanks">${esc(txt)}</p>` : ''}${k === 'yes' && hasC ? qrBlock(d, E, kids, form.email) : ''}${d.he ? `<a class="btn small" href="mailto:${encodeURIComponent(d.he)}?subject=${encodeURIComponent('RSVP ' + k + ': ' + (kids ? d.child_name : d.event_name))}&body=${encodeURIComponent(body)}" data-testid="r-mail">✉ Send my reply to ${esc(d.host_name)}</a>` : ''}<p class="hint small">Reply code: <b>${esc(line)}</b>${local ? ' · saved on this device' : ''}</p>`;
      wirePng();
    });
  };
  draw(null);
}

// Created on RSVP yes: the guest's coupon set + a QR code that opens a plain https coupon page (no app needed).
// The QR is drawn in the browser by the vendored qrcode-generator (MIT); no guest data goes to any outside QR service.
// The QR link carries an opaque coupon-set ID (a one-way hash of event + invite token + email), the MASKED email and what to
// display. The full email is never in the link.
function couponLink(d, E, em) { return dir() + 'coupon.html#c=' + b64u(JSON.stringify({ v: 1, eid: d.eid, s: setFor(d.eid, d.t, em), n: d.guest_name, me: maskEmail(em), en: d.cen || d.event_name, hn: d.host_name, k: d.kids ? 1 : 0, ch: E.choice ? 1 : 0, m: E.m, c: E.c, pb: d.pb, del: d.del || 0 })); }
function qrImg(url, alt) { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); return q.createImgTag(5, 16, alt); }
function qrBlock(d, E, kids, em) {
  const url = couponLink(d, E, em), n = couponsFor(setFor(d.eid, d.t, em), E, !kids && E.c > 0).length, safe = String(d.guest_name || 'guest').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
  return `<div class="qrbox" data-testid="qr-box"><h3>${esc(C.ui.qrHead)}</h3><p class="hint" data-testid="qr-email">${esc(maskEmail(em))}</p><div class="qr" data-testid="qr">${qrImg(url, 'QR code for your coupons')}</div>
    <p data-testid="qr-help">${esc(kids ? C.ui.kidsQrHelp : C.ui.qrHelp)}</p><p class="hint" data-testid="qr-count">${n} coupon${n === 1 ? '' : 's'}: ${esc(describe(E) + (E.choice ? ' (your pick at the bar)' : ''))}</p>
    <div class="row" style="justify-content:center"><a class="btn small" href="${esc(url)}" target="_blank" rel="noopener" data-testid="coupon-link">${esc(C.ui.openCoupons)}</a><a class="btn small alt" id="qrDl" download="coupons-${esc(safe)}.png" data-testid="qr-download" aria-disabled="true">${esc(C.ui.downloadQr)}</a></div>
    <p class="note warm" data-testid="email-stub">${esc(fillT(C.ui.emailStub, { email: em }))}</p></div>`;
}
// Downloadable PNG of the QR, drawn on a canvas in the browser (scaled up, crisp, white border)
function wirePng() { const im = $('[data-testid=qr] img'), a = $('#qrDl'); if (!im || !a) return; const go = () => { const s = 4, c = document.createElement('canvas'); c.width = im.naturalWidth * s; c.height = im.naturalHeight * s; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); a.href = c.toDataURL('image/png'); a.removeAttribute('aria-disabled'); }; if (im.complete && im.naturalWidth) go(); else im.onload = go; }

// ---------- coupon page (coupon.html#c=...): opened by scanning the guest's QR ----------
function couponView() {
  let d; try { d = JSON.parse(unb64u(location.hash.replace(/^#c=/, ''))); } catch (e) { d = null; }
  $('#tabs').hidden = true; $('#walletBtn').hidden = true;
  if (!d || !d.s || !d.eid) { $('#app').innerHTML = `<section class="card"><h2>These coupons aren't recognised</h2><p class="hint">Ask the guest to open their QR code again.</p></section>`; return; }
  const kids = !!d.k, E = { m: clamp(d.m), c: kids ? 0 : clamp(d.c), choice: !kids && !!d.ch }; setPage(kids, d.pb);
  if (d.del && Date.now() >= d.del) { usedAll(); $('#app').innerHTML = `<section class="card" data-testid="coupon-expired"><h2>${esc(C.ui.couponsDeleted)}</h2></section>`; return; } // 30 days after the event
  const list = couponsFor(d.s, E, !kids), v = { event_name: d.en, guest_name: d.n, host_name: d.hn || 'your host' };
  const draw = () => {
    $('#app').innerHTML = `<section class="card" data-testid="coupon-page"><h2>${esc(kids ? 'Mocktail coupons' : 'Drink coupons')} for ${esc(d.n)}</h2><p class="hint">${d.me ? `<b data-testid="cp-email">${esc(d.me)}</b> · ` : ''}${esc(d.en)}${d.hn ? ' · hosted by ' + esc(d.hn) : ''}</p>
      <p class="note warm" data-testid="single-use-note">${esc(C.ui.singleUse)}</p>${E.choice ? `<p>${esc(C.coupon.choiceLine)}</p>` : ''}
      ${list.map(cp => { const used = isUsed(d.eid, cp.code), blk = !used && choiceBlock(E.choice, list, cp, d.eid);
        return `<div class="cwrap ${used ? 'used' : ''}" data-testid="cp-${cp.code}">${couponCard(couponTextFrom(kids, cp.kind, Object.assign({ code: cp.code }, v)), cp.kind)}
        <div class="row cid"><span>Coupon ID <b data-testid="id-${cp.code}">${esc(cp.code)}</b></span>${used ? `<b class="usedtag" data-testid="status-${cp.code}">${esc(C.ui.used)}</b>` : blk ? `<span class="hint" data-testid="status-${cp.code}">${esc(fillT(C.ui.choiceTaken, { guest_name: d.n, choice: blk }))}</span>` : `<button class="btn small" data-use="${cp.code}" data-testid="use-${cp.code}">${esc(C.ui.markUsed)}</button>`}</div></div>`; }).join('') || '<p>No coupons for this guest.</p>'}
      ${kids ? `<p class="hint" data-testid="kids-ingredients">${esc(fillT(C.kids.ingredients, v))}</p>` : `<p class="hint">${esc(fillT('Drinks are offered by {host_name}, not Makerman Services.', v))}</p>`}<p class="hint">${esc(C.coupon.smallPrint)}</p></section>`;
    $$('[data-use]').forEach(b => b.onclick = () => {
      const c = b.dataset.use, cp = list.find(x => x.code === c);
      if (!confirm(fillT(C.ui.confirmUse, { code: c }))) return;
      if (isUsed(d.eid, c)) { toast('Already used'); return draw(); } // re-checked at the moment of use
      if (choiceBlock(E.choice, list, cp, d.eid)) { toast('Not available'); return draw(); }
      markUsed(d.eid, c, d.del); toast(C.ui.used + ': ' + c); draw();
    });
  };
  draw(); window.addEventListener('storage', e => { if (e.key === UKEY) draw(); });
}

// ---------- boot ----------
document.title = CFG.appName + ' ' + CFG.brand; $('#appName').textContent = CFG.appName; $('#appBrand').textContent = CFG.brand;
$('#modal').onclick = e => { if (e.target.id === 'modal' || e.target.hasAttribute('data-close')) $('#modal').hidden = true; };
$('#walletBtn').onclick = openWallet;
$$('#tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); });
window.addEventListener('storage', e => { if (e.key === KEY && document.body.dataset.page !== 'coupons' && !/^#rsvp=/.test(location.hash)) { S = load(); render(); } });
window.addEventListener('hashchange', () => location.reload());
window.IE = { maskEmail, state: () => S, isCharged, chargeGuests, entitlement: g => entitlement(g), coupons, wallet, inviteText, rsvpLink, autoPurge, setFor, isUsed, last: null };
if (document.body.dataset.page === 'coupons') couponView(); else if (/^#rsvp=/.test(location.hash)) guestView(); else render();
})();
