# Email Agent — Rules and Workflow

## Purpose
Process emails arriving at Gonzalo's Cobuildy mailbox, identify the sender,
persist them as a contact in the system, and — if the lead is ripe —
trigger project creation under Gonzalo's verdict.

## Trigger
Operational mailbox: `gonzalog@cobuildy.com` (IMAP).
Run manually for now: `node scripts/email/email-agent.js`.
Pulls the last 20 emails from `INBOX`.

## Pre-filter (cheap)
Before invoking the LLM, apply a keyword/attachment heuristic to skip
clearly irrelevant emails:
- Email has an attachment → keep
- Subject or sender contains: `proyecto`, `inversión`, `financiación`,
  `equity`, `ticket`, `urbanización`, `promoción` → keep
- Otherwise → skip

This avoids API spend on newsletters, automated notifications, etc.

## LLM analysis (one Anthropic call per email)
The agent sends the email subject, sender, date, attachments and (truncated)
body to Claude with `entity-matching.md` and this file as system context.
Claude must return a JSON object with this exact shape:

```json
{
  "isProjectRelated": true,
  "sender":      { "name": "...", "email": "...", "company": "..." | null },
  "projectInfo": { "location": "...", "ticket": "...", "type": "..." } | null,
  "suggestedAction": "...",
  "verdict_needed": true
}
```

`company` is the legal/commercial name extracted from signature, body,
or domain — null when nothing reliable is found.

## Decision flow

```
analyze
  │
  ├── !isProjectRelated
  │     ├── sender already exists in /data/people (≥90% match)
  │     │     → refresh `Last email`, `Last updated`. Done.
  │     └── sender is unknown
  │           → skip entirely (no orphan create from newsletters)
  │
  └── isProjectRelated
        │
        ├── Resolve person & company via entity matching
        │     (knowhow/entity-matching.md, scripts/entity/match.js)
        │     - ≥90% → auto-link to existing
        │     - 25-89% → ask Gonzalo (CLI prompt)
        │     - <25% → create new
        │
        ├── Persist person.md and company.md
        │     - New: create from template with Channel: email, etc.
        │     - Existing: refresh `Last email`, `Last updated`
        │
        ├── 3-criteria gate
        │     The agent only prompts for verdict when ALL three are
        │     filled in projectInfo: location, ticket, asset type.
        │     If any is missing:
        │       → log interaction (`Email | subject | criteria not yet met`)
        │       → no verdict prompt, lead stays in `prospecting`
        │
        └── Verdict prompt: viable / discarded / pending / skip
              ├── skip      → no log, no action
              ├── discarded → log interaction with note "discarded — no project created"
              ├── pending   → log interaction with note "pending review"
              └── viable
                    ├── reserveProjectCode (atomic mkdir of /data/projects/[CODE]/)
                    ├── createLocalProject  (project.md, log.md, feedback.md)
                    ├── addActiveProject on person.md (multi-project safe)
                    ├── set Current stage = `active` on person.md
                    └── createProjectStructure on Drive
                          ([CODE] - [City] - [Promoter] / Promoter Files)
```

## Logging routing
- Person has at least one active project → log entry goes to that
  project's `log.md`
- Person has no project (orphan) → log entry goes to person.md's
  `## Interactions Log` section
- Format: `YYYY-MM-DD | Email | [subject] | [next action]`
- The "project created" entry on a `viable` verdict is written by
  `fillLogMd` directly into the new project's log.md — no duplication
  on person.md.

## Drive folder format
`[CODE] - [City] - [Promoter]` — example: `ES-001 - Olcoz - Carlos S. del Arco`
Subfolder: `Promoter Files` (the share the promoter uploads docs to).

## What this agent does NOT do
- Process outbound emails (read-only on INBOX for now)
- Upload attachments to Drive (agent creates the folder; manual upload)
- Push leads to Kommo or any external system (deferred)
- Auto-respond / send any message
