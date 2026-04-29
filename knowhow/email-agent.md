# Email Agent — Rules and Workflow

## Purpose
Process emails arriving at Gonzalo's Cobuildy mailbox, identify the
sender, persist them in the system, log the interaction, and — if the
lead is ripe — trigger project creation under Gonzalo's verdict.

There are two scripts under `scripts/email/`:

- **`email-agent.js`** — interactive, processes the latest INBOX
  messages, prompts Gonzalo for verdicts when criteria are met.
- **`backfill.js`** — non-interactive, summarises every email between
  Gonzalo and known persons since the cutoff and writes them to the
  per-person interaction logs.

## Mailbox / IMAP
- Account: `gonzalog@cobuildy.com` (IONOS)
- IMAP folders scanned by `backfill.js`:
  - `INBOX` (received)
  - `Elementos enviados` (sent — note the Spanish folder name; the
    code regex is `/sent|enviados/i` to handle both)
- Cutoff: `2026-03-17` (configurable in the script)

## `email-agent.js` — interactive flow

### Pre-filter (cheap, no API call)
Skip clearly irrelevant emails before invoking the LLM:
- Has an attachment → keep
- Subject or sender contains `proyecto`, `inversión`, `financiación`,
  `equity`, `ticket`, `urbanización`, `promoción` → keep
- Otherwise → skip

### LLM analysis (one Claude call per kept email)
Sends subject, sender, date, attachments and truncated body to Claude
Sonnet 4.6. Claude returns:

```json
{
  "isProjectRelated": true,
  "sender":      { "name": "...", "email": "...", "company": "..." | null },
  "projectInfo": { "location": "...", "ticket": "...", "type": "..." } | null,
  "suggestedAction": "...",
  "verdict_needed": true
}
```

### Decision flow

```
analyze
  │
  ├── !isProjectRelated
  │     ├── sender already in /data/people (≥90% match)
  │     │     → refresh Last email + Last updated. Done.
  │     └── sender unknown
  │           → skip entirely (no orphan create from newsletters)
  │
  └── isProjectRelated
        │
        ├── Resolve person & company via entity matching
        │     (knowhow/entity-matching.md, scripts/entity/match.js)
        │     - ≥90%  → auto-link
        │     - 25-89% → ask Gonzalo (CLI prompt)
        │     - <25%  → create new
        │
        ├── Persist person.md and company.md
        │     New → from template with Channel: email
        │     Existing → refresh Last email, Last updated
        │
        ├── 3-criteria gate
        │     Verdict prompt only when ALL THREE are filled:
        │       location, ticket, asset type.
        │     Missing any → log entry with "criteria not yet met",
        │     no verdict prompt, lead stays prospecting.
        │
        └── Verdict prompt: viable / discarded / pending / skip
              ├── skip      → no log, no action
              ├── discarded → log "discarded — no project created"
              ├── pending   → log "pending review"
              └── viable
                    ├── reserveProjectCode (atomic mkdir)
                    ├── createLocalProject (project.md, log.md, feedback.md)
                    ├── addActiveProject on person.md
                    ├── set Current stage = active
                    └── createProjectStructure on Drive
                          ([CODE] - [City] - [Promoter] / Promoter Files)
```

## `backfill.js` — bulk summarisation

Run: `node scripts/email/backfill.js` (dry run) →
`node scripts/email/backfill.js --apply`.

For each person in `/data/people/`, find every email since the cutoff
where they are sender or recipient. For each message:

1. Pre-filter (same heuristic as above) — keep relevant only
2. Claude summarises subject + body into a one-line summary
3. Append entry to the person's log:
   ```
   YYYY-MM-DD | Email (received) | <summary> | <next action>
   YYYY-MM-DD | Email (sent)     | <summary> | <next action>
   ```

### Why direction is in the channel column
We need `Email (sent)` vs `Email (received)` distinguishable both in
the channel filter and in dedup. Putting direction in parens keeps
the channel as a single token and lets `entryKey` collapse on
`(date, channel-tag)` for re-runs (Claude generates non-deterministic
summaries across runs — see `log-architecture.md`).

### Idempotency
Email entries dedup on `(date, channel-tag)` not on text. Re-running
`--apply` won't multiply entries even though Claude's summaries vary
slightly each run.

## Logging routing
Handled by `logInteraction(slug, entry)` (see `log-architecture.md`):
- Person has an active project → `/data/projects/[CODE]/log.md`
- Otherwise → `/data/people/logs/<slug>.md` (sidecar)

The "project created" entry on a `viable` verdict is written by
`fillLogMd` directly into the new project's log.md — no duplication on
the person sidecar.

## Drive folder format
`[CODE] - [City] - [Promoter]` — example:
`ES-001 - Olcoz - Carlos S. del Arco`. Subfolder: `Promoter Files`
(promoter uploads docs there).

## What these scripts do NOT do
- They do not auto-respond / send any reply.
- They do not push leads to Kommo (handled separately).
- They do not upload attachments to Drive — `email-agent.js` only
  creates the project folder; uploads are manual for now.
- `backfill.js` does not create new persons. If a sender isn't already
  in `/data/people/`, their emails are silently ignored — orphan
  creation is the live agent's responsibility.
