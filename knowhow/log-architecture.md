# Log Architecture

How interactions get persisted to the system, where they live, and how
agents avoid duplicating each other.

## Two log destinations

Every interaction (email, call, meet, Kommo note, LinkedIn DM, etc.)
is recorded as a log entry. The destination depends on whether the
person already has an active project:

| Person has active project? | Log goes to |
|---|---|
| Yes | `/data/projects/[CODE]/log.md` (single source per deal) |
| No  | `/data/people/logs/<slug>.md` (orphan-phase / pre-project history) |

The shared helper `logInteraction(slug, entry)` in
`scripts/entity/persist.js` does this routing automatically.

## Person logs are sidecar files

`/data/people/<slug>.md` holds **identity** (small, stable, easy to
read for matching). The interaction history lives in a separate file:

```
data/people/
  ├── alberto.md            ← identity (Email, Phone, Role, etc.)
  ├── alberto-log.md        ← (NOT this — superseded)
  └── logs/
      ├── alberto.md        ← Interactions Log (grows freely)
      ├── _template_person_log.md
      └── ...
```

Filename matches the slug. The person.md `Links` section has a
`Log:` field pointing at the sidecar.

This pattern lets us:
- Keep person.md compact for fast reading by matchers and agents
- Let logs grow indefinitely without context-window pressure
- Add rich multi-line bodies (e.g. full Granola summaries) on log
  entries that warrant them, without bloating identity files

## Entry format

Every entry begins with a header line:

```
YYYY-MM-DD | Channel | Summary | Next action [<!-- src:ID -->]
```

Channel is one of: `Email (sent|received)` / `LinkedIn` / `Kommo` /
`Call` / `Meet`. The optional HTML-comment marker at the end carries
a stable upstream ID for dedup (see below).

For most channels (Email, Kommo, LinkedIn, Call) the entire entry is
one line. For **Meet** the header line may be followed by a markdown
body containing the full AI summary (Granola, etc.):

```
2026-04-28 | Meet | Cobuildy / Urbana Home — Málaga 16 unidades | Cristóbal completes cash flow today

### Proyecto Málaga — Resumen Financiero
- Terreno €720k, construcción €2.36M
- Total proyecto: €7.48M
...

### Próximos pasos
- ...
```

Entries are separated by `\n---\n\n` (consistent with project log.md).

## Dedup keys

Re-running a backfill should not create duplicates. `entryKey` in
`persist.js` decides what counts as "the same entry", in priority order:

1. **Explicit marker** — `<!-- src:ID -->` in the header line. Used
   by integrations that have stable upstream IDs:
   - `aircall:<call_id>` — Aircall calls
   - `kn:<note_id>` — Kommo notes (when added)
   - `mid:<hash>` — Email Message-ID hash (when added)
2. **Email and Meet** — collapse on `(date, channel-tag)`. Their
   summaries are non-deterministic across runs (Email AI summary)
   or rewritten on upgrade (Meet short → full body), so we can't
   rely on text identity.
3. **Fallback** — first 80 chars of the header line. Works for
   deterministic content (Kommo notes don't change wording, etc.).

`rebuildPersonLog(slug, entries, opts)` accepts `opts.replace = true`
to overwrite existing entries with matching keys instead of
preserving them. Used by upgrade flows (e.g. promoting a short Meet
header to a full-body version, or replacing a stale Aircall entry
after a format change).

## Channel name policy

Use the canonical channel names — they're how dedup and logging
filters identify entries:

| Canonical | Source | Notes |
|---|---|---|
| `Email (sent)` / `Email (received)` | scripts/email/backfill.js + email-agent.js | Direction in parens |
| `LinkedIn` | scripts/linkedin/linkedin-agent.js | Sheet-driven warm leads |
| `Kommo` | scripts/kommo/backfill-notes.js + kommo-agent.js | Includes WhatsApp/ad notes |
| `Call` | scripts/aircall/backfill.js | Plus `(direction, duration)` in summary |
| `Meet` | manual via Granola MCP for now | Multi-line body when summary available |

## Agent-written notes in external systems

Anything the system writes back into Kommo (or any external system in
the future) is **prefixed with `[Cobuildy OS]`**. House rule. This
makes it possible later to ingest external notes (e.g. "import the
non-agent Kommo notes") without re-importing our own writes.
