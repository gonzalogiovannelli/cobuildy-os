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

## v1.4 — 2026-04-30

### Sidecar logs + three backfills + Granola Meet entries

**Sidecar log architecture**
- Person interaction history moved out of `person.md` and into
  `/data/people/logs/<slug>.md`. Identity files stay compact for
  matching; logs grow freely without context-window pressure.
- New `/data/people/logs/_template_person_log.md` template.
- `person.md` Links section gets a `Log:` field pointing at the
  sidecar.
- New `knowhow/log-architecture.md` consolidates: two log destinations
  (project log if active project, else person sidecar), entry format,
  dedup key priority, channel-name policy, `[Cobuildy OS]` prefix
  rule for external system writes.

**`persist.js` — log helpers**
- New: `PEOPLE_LOGS_DIR`, `ensurePersonLog`, `appendPersonLog`,
  `rebuildPersonLog(slug, entries, opts)`, `parseExistingEntries`.
- `entryKey()` introduced for dedup with priority order:
  1. Explicit marker `<!-- src:ID -->` (e.g. `aircall:CALL_ID`,
     `kn:NOTE_ID`, `mid:MESSAGE_ID_HASH`)
  2. `(date, channel-tag)` for Email/Meet (non-deterministic summaries)
  3. First 80 chars of header line (deterministic content)
- `rebuildPersonLog` accepts `opts.replace = true` to overwrite
  existing entries on key collision (used by upgrade flows).
- Entries separated by `\n---\n\n` (consistent with project log.md).
- Multi-line entry bodies supported (header + blank line + markdown).

**Email backfill — `scripts/email/backfill.js`**
- Scans IMAP `INBOX` and `Elementos enviados` (IONOS Spanish folder
  name) since 2026-03-17.
- Per-message AI summary via Claude Sonnet 4.6.
- Format: `YYYY-MM-DD | Email (sent|received) | <summary> | <action>`.
- Dedup on `(date, channel-tag)` so re-runs don't multiply entries
  even when Claude rewrites the summary.
- Skips emails from senders not already in `/data/people/` (no
  orphan creation from backfill — that's the live agent's job).

**Kommo notes backfill — `scripts/kommo/backfill-notes.js`**
- Reads team notes off every Kommo lead linked from a person.md.
- KEEP_TYPES = `common`, `extended_service`. Auto-generated note
  types skipped.
- Skips notes that start with `[Cobuildy OS]` (our own writes).
- Format: `YYYY-MM-DD | Kommo | <text 120-char trunc> | (by <user>)`.

**Aircall backfill — `scripts/aircall/backfill.js` + `aircall.js`**
- Voice Intelligence not on plan → metadata-only entries (no transcripts).
- Match by phone: `Phone:` and `WhatsApp:` fields in person.md,
  normalised via `normalizePhone`.
- Format: `YYYY-MM-DD | Call | (direction, duration) handled by
  @user | #call_id · [audio](url) <!-- aircall:CALL_ID -->`.
- "no answer" branch when `!answered_at || duration < 5`.
- Uses `call.asset` (permanent URL) instead of `call.recording`
  (one-shot signed S3, expires in ~30min).
- Marker dedup lets multiple calls per day per person coexist.

**Granola Meet entries (MCP, no script)**
- Granola has no offline API; entries are written via the MCP server
  during chat sessions with Claude.
- Multi-line body: header line + blank line + full Granola AI summary
  (markdown sections, lists). Lets a single log file hold the full
  meeting context inline.
- Dedup on `(date, channel-tag)` so a short headline can be replaced
  by the full body via `rebuildPersonLog(replace: true)`.
- New `knowhow/granola-agent.md` documenting the manual workflow.

**Slug + title disambiguation**
- New `safeSlug(slug, contactId, leadId)` helper: on collision with a
  different `Kommo Lead ID`, appends `-<contactId>` so single-name
  promoters don't overwrite each other (e.g. `javier.md`,
  `javier-40411351.md`).
- New `buildPersonTitle(name, {company, email, phone})`: single-name
  persons get a parenthetical disambiguator
  (`# Javier (Acme Holdings)`).
- One-shot migration applied to 12 of 39 existing person.md files.

**Kommo write house rule**
- Agents NEVER call DELETE on Kommo leads. To discard programmatically,
  move to status `For manually delete` (ID `105198532`) for human
  review. `kommo.js` exposes `moveLeadToTrash(leadId, trashStatusId)`.
- All notes the system writes back are prefixed `[Cobuildy OS]` so
  future "import human notes" runs can filter them out cleanly.

**Multi-pipeline Kommo lead intake**
- `scripts/kommo/kommo-agent.js` now parameterised:
  `--pipeline=Developers` / `--pipeline="Active Developers"`.
- Filters: skip `Closed - lost` / `Not qualified` / `Closed - won`,
  4-month recency cap, skip auto-generated names
  (`Facebook Lead <number>`) and company-only leads.
- Posts `[Cobuildy OS] Lead imported on YYYY-MM-DD` note back on
  successful import.
- 43 leads imported total (36 Developers + 7 Active Developers).

**Bugfixes**
- `\s*(.+)
` regex bug in three readers (linkedin
  `readKommoLeadId`, match.js `readField`, persist.js
  `getActiveProjectCodes`): `\s` consumed `\n` and captured the
  next line. Fixed to `[ \t]*([^\n]*)
`.
- CRLF normalisation (`\r\n` → `\n`) on every template/file read in
  `persist.js`, `email-agent.js`, `linkedin-agent.js`, `kommo-agent.js`.
- Aircall recording URL fallback fixed (signed S3 → permanent
  `call.asset`).

**Knowhow docs aligned with implementation**
- `knowhow/aircall-agent.md` — rewritten to describe metadata-only
  reality (no Voice Intelligence on plan).
- `knowhow/kommo-agent.md` — house rules (no DELETE,
  `[Cobuildy OS]` prefix), backfill script docs.
- `knowhow/email-agent.md` — added backfill flow alongside live agent.
- `knowhow/granola-agent.md` — rewritten for the MCP manual workflow.
- `knowhow/linkedin-agent.md` — added Kommo push step (was marked TBD).

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
