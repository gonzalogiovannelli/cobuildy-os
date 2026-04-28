# LinkedIn Agent — Rules and Workflow

## Purpose
Convert warm LinkedIn outreach leads into entities in the system. The
sheet is the SSOT for the outreach pipeline; this agent only acts when a
lead becomes warm.

## Source of truth
A Google Sheet maintained manually by Gonzalo:
- Tab `Developers` → outreach to real estate developers (Gonzalo's column,
  ignoring Dani's parallel outreach for v1)
- Tab `Investors` → outreach to investors (Dona) — out of scope for v1

The sheet ID is in `scripts/.env` as `LINKEDIN_SHEET_ID`.

## Pipeline columns (Developers tab)
| Col | Field | Meaning |
|-----|-------|---------|
| H | Gonzalo connection sent | Date the request was sent |
| I | Connection accepted | TRUE when accepted |
| K | Msg sent | TRUE when first message sent |
| L | **Reply received** | TRUE → **warm lead, agent acts** |

A row is warm only when `L = TRUE`. The agent ignores everything else.

## Agent flow

When `node scripts/linkedin/linkedin-agent.js` runs:

1. Read all rows from the `Developers` tab.
2. Filter to rows where `Reply received = TRUE`.
3. For each warm row:
   - Run entity matching against `/data/people` (name + company).
   - **Existing match (≥90%):** refresh `LinkedIn` URL, `Last LinkedIn`,
     `Last updated` on the existing person.md. Log the interaction.
   - **No match:** create `person.md` from template with:
     - `Channel: linkedin`
     - `Role: promoter`
     - `LinkedIn:` employee link from col G
     - `Current stage: prospecting`
     - `First contact date:` parsed from col H if present, else today
     - `Last LinkedIn:` today
     - `Notes:` content of col J ("Info") if any
   - If a company name is in col B, run company matching:
     - Existing company match (≥90%): link the new person.md to it
     - No match: create `company.md` from template
   - Append a log entry to person.md `Interactions Log`.

## Idempotency
The agent is safe to re-run. The second pass on the same warm row finds
the existing person via match, and only refreshes `Last LinkedIn` —
no duplicates created. Rows on the sheet stay marked `L = TRUE` forever;
that's fine.

## What the agent does NOT do (v1)
- Send LinkedIn messages or connection requests (manual)
- Track Dani's parallel outreach (cols M-N)
- Process the Investors tab
- Push leads to Kommo with a `linkedin` tag (deferred to phase 2)
- Modify the sheet (read-only)

## Daily outreach target
Goal: 30 new connection requests per day, tracked manually in the sheet.

## Notes
- LinkedIn DMs are part of a person's interaction history — once they
  reply and become a person.md, future LinkedIn touches go to either the
  project log (if they have one) or person.md `Interactions Log`.
- Sales Navigator is used by Gonzalo only for outreach.
