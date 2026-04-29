# Cobuildy OS — Changelog

Track structural changes to the system: data model, agent rules,
file conventions. Bump versions on meaningful changes, not every commit.

## Versioning

- `v2.0` etc. → breaking change (templates rewritten, files moved, agents
  changed signature)
- `v1.1` etc. → additive change (new field, new agent, new rule)
- `v1.0.1` etc. → fix or clarification (no schema impact)

When a breaking change ships, list the migration steps Gonzalo (or anyone
else) needs to run on existing data.

---

## v1.3 — 2026-04-29

### Deep review pass: knowhow ↔ code drift cleanup

**email-agent.md — full rewrite**
- Old A/B/C/D case model (Known/New × Attachment/No-attachment) removed.
  It never matched the actual flow.
- Added: pre-filter heuristic, JSON contract from the LLM call,
  `isProjectRelated` branching, 3-criteria gate, verdict options and
  meanings, atomic project code reservation, log routing rule, Drive
  folder format with Promoter Files subfolder.
- Removed obsolete "Outbound Emails — Rules" (no code exists for it;
  will come back when implemented).

**linkedin-agent.md — clarified logging**
- For new persons (most warm leads) → log to person.md `Interactions Log`.
- For existing persons with a project → log to project's log.md via
  the shared `logInteraction` helper.

**kommo-agent.md — fact corrections**
- `Developers Linkedin` pipeline mentioned (linkedin-agent push target).
- Field name corrected to `Kommo Lead ID` and `Kommo Contact ID`.
- Drive folder rule updated: created with the project on `viable`
  verdict, not gated on document arrival.
- "Enrich Kommo from the system" section marked as TBD.

**aircall-agent.md and granola-agent.md — channel naming + routing**
- Canonical channels in logs: `Call` and `Meet` (no longer
  `Call (Aircall)` / `Meeting (Granola)`). Source goes in summary text.
- Log routing follows the project-vs-person rule (project log if a
  project exists, person.md otherwise).
- Phantom paths (`/data/projects/[CODE]/calls/`,
  `/data/people/calls/<slug>/`, `/knowhow/internal-meetings/`) flagged
  as TBD until the agent is built.

**communication-agent.md — full rewrite**
- Reoriented around the manual reality: outreach is human-driven, the
  system suggests rather than sends. The old "auto-send first message"
  flow described an integration that never existed.
- Added explicit "automatic vs manual" table.
- Pointed to `tone-and-voice.md` for tone (de-duplicated).
- LinkedIn workflow now describes the Sheet-based reality.

**tickets-index.md — slim down**
- Removed empty Bugs and Improvements tables (visual noise).
- Single Open table with Type column.

**email-agent.js — minor**
- Removed duplicate comment lines (residue of earlier edits).

---

## v1.2 — 2026-04-28

### LinkedIn agent (sheet-based) + persist refactor

**LinkedIn agent**
- New `scripts/linkedin/sheet.js` — reads the Developers tab of the
  outreach Google Sheet. Auth shared with `scripts/drive`.
- New `scripts/linkedin/linkedin-agent.js` — processes warm leads
  (column L = TRUE). For each warm row: existing match (≥90%) → refresh
  `Last LinkedIn`; new → create person.md + company.md from templates.
  Idempotent (re-runs don't duplicate).
- Out of scope for v1: Investors tab, Dani's parallel outreach, Kommo
  push, write-back to the sheet.
- Run with: `node scripts/linkedin/linkedin-agent.js`. Sheet ID can be
  overridden via `LINKEDIN_SHEET_ID` env var.

**Refactor: shared persistence module**
- New `scripts/entity/persist.js` — extracted shared primitives that
  every agent will need: `slugify`, `today`, `setField`/`setFields`,
  `fillCompanyMd`, `fillFeedbackMd`, `updatePersonFields`,
  `addActiveProject`, `appendPersonLog`, `appendProjectLog`,
  `logInteraction`, `logEntry`, `getActiveProjectCodes`,
  `reserveProjectCode`.
- `scripts/email/email-agent.js` updated to import from persist.js
  instead of carrying its own copy. ~150 lines deduplicated.

**Docs**
- `knowhow/linkedin-agent.md` rewritten to describe the sheet-based
  flow (was describing a hypothetical direct-LinkedIn integration).
- Cleaned references to the deleted `data/outreach/linkedin-pipeline.md`
  in communication-agent, data-enrichment, email-agent.
- `data/outreach/linkedin-pipeline.md` removed (replaced by the Google
  Sheet as SSOT for the outreach pipeline).

---

## v1.1 — 2026-04-28

### Cleanup pass after first end-to-end email run

**Person**
- Renamed `Type` → `Role`. Values reduced to `promoter / investor`
  (removed `advisor`).
- Replaced Kommo-derived 12-stage `Current stage` enum with
  `prospecting / active / dormant / discarded`.
- `Channel` enum now `email / linkedin / kommo / referral / direct`
  (added `email`, removed split `ads-es / ads-pt / ads-eng`).
- Activity Summary refactored: replaced single `Last interaction:` with
  per-channel `Last email / Last call / Last meet / Last LinkedIn /
  Last Kommo`.
- Added `## Interactions Log` section for orphan-phase history (only
  appended when person has no project).

**Company**
- Removed `## Company Type` section (Type field + Parent company).
  Companies are identified by name and links, not by a type label.

**Project**
- Renamed `Type` → `Asset type`. Values reduced to
  `residential / commercial / hospitality / mixed` (added `hospitality`,
  was just `residential / commercial / mixed`).
- Removed `## Investors Presented` table (duplicated `feedback.md`).

**Documents**
- Removed date suffix from naming convention. Now
  `[CODE]-[document_type]-[descriptor].[ext]`.
- Versioning, when needed, goes as `-vN` suffix.

**Investor model**
- Confirmed: investors live inside `/data/people/<slug>.md` with an
  `Investor ID: INV-NNN` field. There is NO `/data/investors/` directory.
- Cleaned aircall-agent.md, granola-agent.md to remove the `or
  /data/investors` references.

**Channels (canonical names)**
- `Email` / `LinkedIn` / `Kommo` / `Call` / `Meet`. Used in log entries
  and `Last <channel>:` fields. No more `WhatsApp (Kommo)`.

**Other**
- Deleted `BRD.md` (superseded by living docs in `/knowhow/`).
- Clarified operational vs Claude account in CLAUDE.md
  (gonzalog@cobuildy.com vs gonzalogiovannelli@gmail.com).

### Migration impact
- Existing person.md files with old enums/fields (e.g. `carlos_s_del_arco.md`
  created earlier today) keep working but show the old field names. They
  can be migrated manually or by re-running the agent on a fresh email.

---

## v1.0 — 2026-04-27

Initial scaffolding. Email-agent end-to-end with entity-matching and
atomic project codes.
