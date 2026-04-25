# LinkedIn Agent — Rules and Workflow

## Purpose
Automate LinkedIn outreach tracking and lead management
using Gonzalo's Sales Navigator account.

## Pipeline Statuses
Defined in /data/outreach/linkedin-pipeline.md
- `requested` → connection request sent
- `connected` → accepted, no message sent yet
- `messaged` → first message sent, waiting for reply
- `lead` → replied, person.md created in /data/people

## Outreach Workflow

### Step 1 — New connection request sent
- Add row to linkedin-pipeline.md
- Fields: name, LinkedIn URL, company, status: requested, date

### Step 2 — Request accepted
- Update status to `connected` in linkedin-pipeline.md
- Note date of acceptance

### Step 3 — First message sent
- Update status to `messaged`
- Note message date and a brief summary of the message sent

### Step 4 — They reply
- Update status to `lead`
- Trigger entity creation: create person.md from template
- Run entity matching first (they may already exist from another channel)
- Log first interaction in person.md activity summary

## Inbound Messages Workflow

### When someone replies on LinkedIn
- Run entity matching against /data/people and /data/companies
- If known → add log entry to relevant project or person file
- If new → create person.md, add to pipeline as `lead`

## Daily Outreach Target
- Goal: 30 new connection requests per day
- LinkedIn pipeline is the source of truth for outreach volume and conversion

## Notes
- LinkedIn DMs are part of the interaction history of a person
- All LinkedIn messages must be logged in person.md or project log.md
- Sales Navigator is used by Gonzalo only
- A teammate may occasionally use Gonzalo's account for outreach