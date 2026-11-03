/* User-facing wording with {placeholders}. Copied EXACTLY from /workspace/ops/content/myparty-invites/copy.md
   (Legal passed with edits, 3 Nov 2026 15:05; token wording 15:09, the Building note in brackets on the resend line dropped as it is confirmed). Swap text here only. {privacy_link} and token placeholders stay
   UNFILLED on purpose: Mal sets them. Lines under `ui` are NOT in copy.md (engineering placeholders for Legal/Content). */
window.IE_COPY = {
  email: {
    subject: "You're invited: {event_name} 🎉",
    // Each line is one line of the email. [RSVP here]({rsvp_link}) becomes a link. The two coupon lines are dropped if the guest has no coupons.
    lines: [
      "Hi {guest_name},",
      "{host_name} would love you to join {event_name}!",
      "📅 {date} · ⏰ {time}",
      "📍 {venue}",
      "{host_note}",
      "Please RSVP by {rsvp_deadline}: [RSVP here]({rsvp_link})",
      "@coupon:Your drink coupons are included below. Show them at the bar on the night.",
      "@coupon:Drinks are offered by {host_name}, not Makerman Services.",
      "See you there!",
      "---",
      "You got this because {host_name} invited you. Don't want these? Reply and let the host know.",
      "Privacy: see the guest privacy notice on the RSVP page.",
      "Made with My Party"
    ]
  },
  rsvp: {
    heading: "Will you be there?",
    yes: "Yes, I'll be there", no: "Sorry, can't make it", maybe: "Maybe",
    fName: "Your name", fPlus: "Number of guests", fDiet: "Dietary needs (optional)", fMsg: "Message for the host (optional)",
    confirmYes: "You're on the list! Your drink coupons are ready. Save this email or screenshot them.",
    confirmNo: "Thanks for letting {host_name} know. Hope to see you next time!"
  },
  coupon: {
    mocktail: "MOCKTAIL · Good for 1 mocktail · {event_name} · Guest: {guest_name} · Code {code} · One use only · Offered by {host_name}, not Makerman Services",
    cocktail: "COCKTAIL · Good for 1 cocktail · {event_name} · Guest: {guest_name} · Code {code} · One use only · 18+ only. ID may be required. Please drink responsibly. · Offered by {host_name}, not Makerman Services",
    choiceLine: "Your coupons: 2 mocktails or 1 cocktail (your pick at the bar).",
    smallPrint: "Coupons are valid only at this event, aren't transferable, and have no cash value. Staff may refuse service."
  },
  hostResponsibility: "If your event is at a licensed venue, the venue's licence and RSA rules apply. Under the NSW Liquor Act 2007 (s117), no one may supply alcohol to anyone under 18 without their parent or guardian's OK, and only responsibly. As the host, you're responsible for the drinks you offer. Makerman Services doesn't supply or serve alcohol.",
  under18Toggle: "Guest is under 18 = mocktail coupons only",
  privacy: "My Party collects your name and email so {host_name} can manage the guest list. Dietary needs are collected only if you choose to share them (tick to consent). Your details are used only for this event, aren't sold or shared with anyone else, and are deleted on {delete_date} (30 days after the event). My Party is run by Makerman Services (ABN 22 791 780 670). Questions or deletion requests: makermanservices@gmail.com. Full privacy policy: {privacy_link}. You can also contact {host_name}.",
  tokens: [
    "Tokens are used only when you send invitations with the My Party invite engine.",
    "My Party is free. Sending invitations uses tokens: A$1.17 (AUD) per guest.",
    "My Party and the standalone invitation app each have their own token balance. Tokens bought in one can't be used in or moved to the other.",
    "1 token = 1 guest invite, A$1.17 (AUD).",
    "Tokens don't expire.",
    "Resending to the same guest or editing an invite doesn't use another token.",
    "Tokens can't be exchanged for cash and can't be transferred to another account.",
    "Refunds: unused tokens can be refunded within 14 days of purchase. Contact us at makermanservices@gmail.com.",
    "Nothing in these terms limits your rights under the Australian Consumer Law, including your rights to a refund or remedy if the service has a major fault."
  ],
  // Kids' parties: EXACTLY from /workspace/ops/content/myparty-invites/kids-and-entertainment.md (Legal passed 15:13)
  kids: {
    subject: "{child_name} is having a party! 🎈",
    lines: [
      "Hi {guest_name}'s family,",
      "You're invited to {child_name}'s birthday party, turning {age}!",
      "📅 {date} · ⏰ {start_time} to {end_time}",
      "📍 {venue}",
      "Please RSVP by {rsvp_deadline}: [RSVP here]({rsvp_link})",
      "Let us know about any allergies or dietary needs.",
      "A parent or carer is welcome to stay. {drop_off_note}",
      "---",
      "Made with My Party"
    ],
    fChild: "Child's name", fComing: "Coming?", yes: "Yes", no: "No", maybe: "Maybe", fAdults: "Number of adults staying",
    fAllergy: "Allergies or dietary needs (optional, only with consent)", fMsg: "Message for the host (optional)",
    // Kids' coupons (Mal 15:19 + Legal rules): mocktails only, 2 per kid by default, host can switch off. Never "at the bar".
    mocktail: "MOCKTAIL · Good for 1 mocktail (non-alcoholic) · {event_name} · Guest: {guest_name} · Code {code} · One use only · Show this at the party · Check allergies with {host_name}. · Offered by {host_name}, not Makerman Services",
    ingredients: "Ingredients are up to {host_name}. Check allergies with the host.",
    hostNote: "Kids' party: 2 mocktail coupons per kid by default (you can change or switch them off). No cocktails at kids' parties. Ingredients are up to you, so check guests' allergies.",
    privacyExtra: "A parent or carer fills in the RSVP, and we only collect the child's first name. Allergy or dietary details for a child are shared only with a parent's or carer's consent (they tick the consent box)."
  },
  artLabel: "AI-generated art, made with Grok Imagine",
  ui: { // NOT in copy.md: placeholders for Legal/Content to check
    gmail: "Invites go out from your own Gmail, as you, after you sign in with Google. We ask only for permission to send email (gmail.send) and can't read your inbox. The sign-in lasts for this session only and is never saved. Guest emails are used only for this event's invites, never for anything else.",
    preview: "Preview: not sent. This preview builds each email but never sends it.",
    stub: "Preview: test purchase only. No payment is taken and no card is asked for.",
    dietConsent: "Tick to share your dietary needs with {host_name}",
    parentConsent: "I'm the child's parent or carer, and I agree to share these allergy or dietary details with {host_name}.",
    kidsConfirmYes: "You're on the list! See you at the party.",
    noCash: "Tokens can't be exchanged for cash and can't be transferred to another account."
  }
};
