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
