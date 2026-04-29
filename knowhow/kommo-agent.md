# Kommo Agent — Rules and Workflow

## Purpose
Kommo is our team CRM and the WhatsApp Business hub. The repo is the
SSOT; Kommo feeds the repo (lead intake) and receives writes from the
repo (notes, status moves) so Dona, Danila and Gonzalo see the same
state in their day-to-day UI.

## Pipelines
| Pipeline | ID | Purpose |
|---|---|---|
| Developers | (managed) | Promoter leads from ads / WhatsApp Business |
| Active Developers | (managed) | Promoters in active deal flow |
| Developers Linkedin | 13581344 | Push target for warm LinkedIn leads (see `linkedin-agent.md`) |
| Private Investors | (managed) | Investor leads (Dona's domain) |

## House rules (non-negotiable)

1. **Agents NEVER delete leads in Kommo.** DELETE is not used. To
   discard a lead programmatically, move it to status `For manually
   delete` (ID `105198532`) so a human can review and clear the queue.
   `kommo.js` exposes `moveLeadToTrash(leadId, trashStatusId)` for this.
2. **Every note the system writes back is prefixed with `[Cobuildy OS]`.**
   This is the dividing line that lets us later import the team's
   manual notes without re-importing our own writes. See the dedup
   filter in `backfill-notes.js`.
3. **Repo is SSOT.** Kommo is a feeder + UI. Conflicting field values
   are resolved in favour of person.md, not Kommo.

## Scripts

### `scripts/kommo/kommo.js` — API client
Read: `listLeads`, `getLead`, `getLeadNotes`, `listContacts`,
`getContact`, `getPipelineStatuses`.
Write: `createLeadComplex` (atomic Lead+Contact+Company via
`/leads/complex`), `addNote`, `updateLeadStatus`, `moveLeadToTrash`.

### `scripts/kommo/kommo-agent.js` — Lead intake (backfill)
Run: `node scripts/kommo/kommo-agent.js --pipeline=Developers`
(also: `--pipeline="Active Developers"`).

Pulls leads from a pipeline and creates / updates `data/people/<slug>.md`
with:
- `Kommo Lead ID:` + `Kommo Contact ID:` in Identities
- `Phone:`, `WhatsApp:`, `Email:`, `Company:` in Links
- `Channel: kommo`, `Current stage: prospecting`
- `Source: <pipeline name>`

**Filters (skipped)**:
- Status `Closed - lost`, `Not qualified`, `Closed - won`
- Older than 4 months (recency cap)
- Auto-generated names (`Facebook Lead <number>`, etc.) and
  company-only leads with no human contact

**Idempotency**:
- Looks up existing person by `Kommo Lead ID` first → updates in place
- On slug collision with different Kommo Lead ID → falls back to
  `safeSlug(slug, contactId)` → e.g. `javier.md` and `javier-40411351.md`
- Single-name persons get a disambiguator title via `buildPersonTitle`
  (`# Javier (Acme Holdings)` or `# Juan (juan@…)`)

**Side effect on success**: posts a note back to the Kommo lead:
```
[Cobuildy OS] Lead imported into Cobuildy OS on YYYY-MM-DD
```

### `scripts/kommo/backfill-notes.js` — Notes → person logs
Reads team notes off every Kommo lead linked from a person.md, writes
them as `Kommo` channel entries in the person's interaction log.

**KEEP_TYPES**: `common`, `extended_service` only. Auto-generated
note types (system events, attachments, call cards, etc.) are skipped.

**Skips notes that start with `[Cobuildy OS]`** — those are our own
writes, not human input. (The hard rule above is what makes this
filter trustworthy.)

**Entry format**:
```
YYYY-MM-DD | Kommo | <text truncated to 120 chars> | (by <user_name>)
```

Notes don't have stable upstream IDs in the schema we use, so dedup
falls back to first-80-chars (deterministic — Kommo notes don't get
rewritten). Multi-Kommo notes on the same day on the same person are
preserved as long as they differ in the first 80 chars.

## LinkedIn lead push (handled by `linkedin-agent.js`)
Warm LinkedIn leads (sheet column `Reply received` = TRUE) are pushed
to pipeline `Developers Linkedin`, status `Linkedin Warm Lead`
(105198184), via `createLeadComplex`. The Kommo Lead ID + Contact ID
returned are written back to `data/people/<slug>.md` Identities. Full
flow in `linkedin-agent.md`.

## Project-creation gate (applied to Kommo content via email-agent / future kommo-agent)
The 3-criteria gate (Location / Ticket / Asset type) is **not** part
of the Kommo backfill — it is applied by `email-agent.js` and
(future) a kommo conversation agent that reads recent notes. The
backfills here just sync data; verdicts on creating a project happen
in the agent that watches new content.

## What this agent does NOT do
- It does not delete leads (see house rule 1).
- It does not sync pipeline-stage changes back to person.md
  `Current stage` — we use our own enum (prospecting / active /
  dormant / discarded), Kommo stages are pipeline-specific.
- It does not write Drive folders. Drive folder creation is gated on
  the project-creation flow (see `project-workflow.md`).
