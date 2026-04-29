# LinkedIn Agent — Rules and Workflow

## Purpose
Convert warm LinkedIn outreach leads into entities in the repo and
push them to the team's Kommo board so Dona / Danila see them in
their CRM. The Google Sheet is the SSOT for the outreach pipeline;
this agent only acts when a lead becomes warm.

## Source of truth
A Google Sheet maintained manually by Gonzalo:
- Tab `Developers` → outreach to real estate developers (Gonzalo's
  column; Dani's parallel outreach in cols M-N is ignored for now)
- Tab `Investors` → outreach to investors (Dona) — out of scope

Sheet ID is in `scripts/.env` as `LINKEDIN_SHEET_ID` (currently
`1cR51zYulygDUKc8dEATWsv3ksMMJf7H56clXsDsO6vY`). Read via
`scripts/linkedin/sheet.js` (Google Sheets API).

## Pipeline columns (Developers tab)
| Col | Field | Meaning |
|-----|-------|---------|
| B | Company name | Used for company matching / creation |
| G | LinkedIn URL | Employee profile link |
| H | Gonzalo connection sent | Date the request was sent |
| I | Connection accepted | TRUE when accepted |
| J | Info | Free-text notes on the lead |
| K | Msg sent | TRUE when first message sent |
| L | **Reply received** | TRUE → **warm lead, agent acts** |

A row is warm only when `L = TRUE`. The agent ignores everything else.

## Agent flow

`node scripts/linkedin/linkedin-agent.js`:

1. Read all rows from the `Developers` tab.
2. Filter to rows where `Reply received = TRUE`.
3. For each warm row:
   - Run entity matching against `/data/people` (name + company).
   - **Existing match (≥90%)**: refresh `LinkedIn`, `Last LinkedIn`,
     `Last updated` on the existing person.md. Log the interaction.
   - **No match**: create `person.md` from template with:
     - `Role: promoter`
     - `Channel: linkedin`
     - `Source: linkedin`
     - `Current stage: prospecting`
     - `LinkedIn:` employee link (col G)
     - `First contact date:` from col H if present, else today
     - `Last LinkedIn:` today
     - `Notes:` content of col J if any
   - If col B has a company name → run company matching; link existing
     or create new `company.md` from template.
4. **Push to Kommo** (`scripts/kommo/kommo.js → createLeadComplex`):
   - Pipeline: `Developers Linkedin` (ID `13581344`)
   - Status: `Linkedin Warm Lead` (ID `105198184`)
   - Atomic Lead + Contact + Company creation
   - Save returned `Kommo Lead ID` and `Kommo Contact ID` back into the
     person.md Identities section
5. Log the interaction (via shared `logInteraction(slug, entry)`):
   - Active project → `/data/projects/[CODE]/log.md`
   - Otherwise → `/data/people/logs/<slug>.md` (sidecar)
   - Format: `YYYY-MM-DD | LinkedIn | <summary from col J> | <next action>`

## Idempotency
Safe to re-run. The second pass on the same warm row:
- Finds the existing person via match
- Sees `Kommo Lead ID` already set → does not push to Kommo again
- Refreshes `Last LinkedIn` and `Last updated`
- No duplicate person, no duplicate Kommo lead

Rows on the sheet stay marked `L = TRUE` forever — that's fine.

## What this agent does NOT do
- Send LinkedIn connection requests or DMs (manual via Sales Navigator)
- Track Dani's parallel outreach (cols M-N)
- Process the Investors tab
- Modify the sheet (read-only)
- Re-push to Kommo if the person already has a `Kommo Lead ID`

## Daily outreach target
30 new connection requests per day, tracked manually in the sheet.
The agent's job starts only after a reply lands.

## Cross-refs
- Kommo write house rules: `knowhow/kommo-agent.md`
- Log routing and dedup: `knowhow/log-architecture.md`
- Per-channel `Last X` fields: `data/people/_template_person.md`
