/* Invitation engine config. PREVIEW build.
   - appName: working name, change in ONE place.
   - No Gmail sign-in in this build ("Email sending coming soon"): hosts copy or share invite links. No OAuth code ships.
   - Payments are STUBBED: no Stripe call exists in this build.
   - art: swap any background by changing its file here (text is drawn live over it). */
window.IE_CONFIG = {
  appName: 'Invite & Pour', brand: 'by Makerman Services',
  // Pages allowed to embed this app and send prefill (event details + guest names, never emails) by postMessage
  prefillFrom: ['https://makerman-services.github.io', 'http://localhost:8773'],
  myPartyUrl: 'https://makerman-services.github.io/party-planner-invites-preview/',
  deleteAfterDays: 30,
  art: {
    invites: [
      // ai: true shows the "AI-generated art, made with Grok Imagine" label on it (or its own label). kids: shown in kids' party mode. adults: false hides it there.
      // Canva AI paid art (Legal pass /workspace/ops/legal/canva-paid-art-pass-2026-11-03.md, sources in ART-SOURCES.md): first in each list, so it is the default.
      { id: 'navygold', name: 'Navy & gold', src: 'img/canva-adult-invite.webp', ink: '#fff', pane: 'rgba(10,14,40,.55)', ai: true, label: 'Made with Canva AI' },
      { id: 'skyparty', name: 'Balloons & bunting', src: 'img/canva-kids-invite.webp', ink: '#1E1B2E', pane: 'rgba(255,255,255,.82)', ai: true, label: 'Made with Canva AI', kids: true, adults: false },
      // Grok Imagine art below: preview only (Mal 17:37: Imagine stays in posts and previews; remove before sale)
      { id: 'confetti', name: 'Confetti', src: 'img/invite-confetti.jpg', ink: '#fff', pane: 'rgba(10,14,40,.55)', ai: true },
      { id: 'garden', name: 'Garden', src: 'img/invite-garden.jpg', ink: '#2E2A1F', pane: 'rgba(255,253,245,.82)', ai: true },
      { id: 'neon', name: 'Neon night', src: 'img/invite-neon.jpg', ink: '#fff', pane: 'rgba(12,6,30,.6)', ai: true },
      // Kids' party art (Content, Grok Imagine): shown only in kids' party mode
      { id: 'balloons', name: 'Balloons', src: 'img/kids-invite-balloons.jpg', ink: '#1E1B2E', pane: 'rgba(255,255,255,.82)', ai: true, kids: true, adults: false },
      { id: 'circus', name: 'Circus', src: 'img/kids-invite-circus.jpg', ink: '#fff', pane: 'rgba(60,10,20,.55)', ai: true, kids: true, adults: false }
    ],
    // Full-page background art (fixed layer behind everything; clicks pass through). Host picks one in Design.
    // Add or swap art here; an empty list falls back to the plain colour.
    page: {
      colour: '#F7F5FB',
      // Legal-passed photo-real pages (faded cream centre for the text). notice = extra line shown wherever that page is used.
      adult: [{ id: 'elegant', name: 'Party tables (photo)', src: 'img/adult-page-elegant-faded.jpg', ai: true }, { id: 'seniors', name: 'Classic tea party (photo)', src: 'img/seniors-page-classic-faded.jpg', ai: true }],
      kids: [{ id: 'party', name: 'Clown, magician & party table (photo)', src: 'img/kids-page-party-v2-faded.jpg', ai: true, notice: 'Illustration only. Entertainers are booked by the host.' }, { id: 'cartoon', name: 'Cartoon clown & magician', src: 'img/kids-page-clown-magician.jpg', ai: true, notice: 'Illustration only. Entertainers are booked by the host.' }]
    },
    mocktail: 'img/coupon-mocktail.jpg', cocktail: 'img/coupon-cocktail.jpg', couponAi: true
  },
  // This app's OWN token balance (storage key invitePour.wallet.v1). Separate from any My Party balance; no transfers either way.
  // Robot Crew-style tokens. Mal 3 Nov 15:08: 1 token = 1 guest invite = A$1.17 (AUD). Welcome tokens are free and spent first; bought tokens stored separately.
  tokens: {
    welcome: 1, unitCents: 117, perInvite: 1,
    packs: [{ id: 't5', n: 5, cents: 585 }, { id: 't10', n: 10, cents: 1170 }, { id: 't25', n: 25, cents: 2925 }, { id: 't50', n: 50, cents: 5850 }],
    whatOne: '1 guest invite' // tokens don't expire (Legal 15:09). No AI features in this build, so nothing else uses tokens.
  }
};
