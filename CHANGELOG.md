# Changelog — loomus.ai

All notable user-facing changes to LOOMUS. Format follows [Keep a Changelog](https://keepachangelog.com/); internal engineering notes live in the private Codex.

## 2026-06-11

### Added
- **Sign in with Google** — one tap on any LOOMUS surface; email code remains as fallback. Existing email accounts merge automatically (same address = same library, planet, handle).
- **Account page** at `/you/account` — identity (handle & display-name editing, your star), standing (reading-day tier), patronage (plan, upgrade, billing portal, refund policy), and session control, in one quiet drawer.
- **You-pill menu** — clicking your planet chip in the top bar now opens Your space / Account / Sign out.
- Order ledger (internal) — every purchase is now tracked end-to-end so no request can go unanswered.

### Fixed
- Signing out now signs you out **everywhere** — margin, graphs, marginalia — within seconds (previously a stale session could "resurrect" on other subdomains).
- Safari users are no longer signed out every 7 days.
- Cross-device identity: your chosen star and handle now follow your account to any browser; changing your star updates the chip everywhere.
- Reading-day count is now server-side — the same number on every LOOMUS surface, on every device.
- Plan changes for active supporters now route through the Stripe portal (correct proration); the upgrade button no longer pointed at a missing page.
- Session tokens no longer appear in any link URL (security hardening).
- Library page now reads "100+ books" past the milestone (was "110 of 100").
- Mobile `/you`: the view switcher no longer overlaps the header; long quotes no longer clip at the viewport edge.

### Changed
- Billing moved fully to live mode — upgrades, plan switches, cancellations and refunds are all self-serve.

## 2026-06-10

### Added
- Daily Picks v2 — decoupled pipeline (cron → API → homepage) with last-good fallback; the homepage never shows an empty morning.
- Identity chip v1 — your planet thumbnail + @handle in the top bar across all surfaces.
- NOTES v3.5a — select any passage on a book page and send it to your margin; notes drawer on knowledge graphs.
