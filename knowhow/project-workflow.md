# Project Workflow — Stages and Rules

## Purpose
Define the lifecycle of a project from first contact to close.
No project should advance to the next stage without meeting the requirements.

## Stages

### 1. Prospecting
- Lead has shown interest in Cobuildy services
- Minimum info captured: name, contact channel, location (if mentioned)
- Project code NOT assigned yet
- Lives in: person.md activity summary

### 2. Analysis
- Active communication: calls, emails, WhatsApp exchanges
- Project creation criteria being evaluated:
  1. Location confirmed
  2. Ticket confirmed
  3. Asset type confirmed
- The agent prompts Gonzalo for a verdict ONLY when all 3 criteria are
  confirmed in the source (email body, call transcript, Kommo note, etc.).
  If a criterion is missing, the agent logs the interaction on the
  person and waits for the next touchpoint.
- Verdict options: `viable` / `discarded` / `pending`
- A project is reserved (code assigned + /data/projects/[CODE]/ created)
  ONLY on `viable`. `discarded` and `pending` keep the lead alive on
  person.md but create no project.

### 3. Contract Signed ⚠️ Critical milestone
- Success fee contract sent to promoter (from template)
- Promoter signs and returns
- Contract received via:
  - Email → agent detects automatically, uploads to Drive, updates log
  - WhatsApp → Gonzalo uploads manually to Drive, notifies system
- Contract must be uploaded to Drive before advancing
- System blocks advancement to Structuring without confirmed contract
- Log entry: YYYY-MM-DD | [channel] | Success fee contract signed | Begin structuring

### 4. Structuring
- Gonzalo works on structuring the project
- Google Sheet (financial model) is being built
- Documents being collected from promoter:
  - See /knowhow/required-documents.md for full list
- Drive folder active and being populated
- One pager / ficha being prepared for investors

### 5. Ready to Invest
- Project ficha complete and approved internally
- Project presented to selected investors (by Dona)
- Each presentation logged: YYYY-MM-DD | Email | Ficha sent to INV-00X | Pending feedback
- Investor feedback collected in feedback.md

### 6. Investor Due Diligence
- Investor has shown serious interest
- Investor requests additional documentation
- Negotiation of terms begins
- All document requests and responses logged in log.md
- All feedback and negotiation notes in feedback.md

### 7. Closed / Discarded
#### Closed
- Deal signed
- Log entry: YYYY-MM-DD | | Deal closed with INV-00X | Archive project
- Project status updated to: closed

#### Discarded
- Project rejected at any stage
- Log reason in log.md
- Log entry: YYYY-MM-DD | | Project discarded — [reason] | No action
- Project status updated to: discarded
- person.md activity summary updated

## Stage Transition Rules
- **Prospecting → Analysis:** first substantive conversation about a project
- **Analysis → Contract:** all 3 project criteria confirmed + Gonzalo verdict: viable
- **Contract → Structuring:** signed contract uploaded to Drive ⚠️ mandatory
- **Structuring → Ready to invest:** ficha complete + internal approval
- **Ready to invest → Due diligence:** investor confirms serious interest
- **Due diligence → Closed/Discarded:** deal signed or rejected

## Notes
- project.md `Stage` field must always reflect current stage
- No project advances without meeting stage requirements
- Contract stage is a hard blocker — no exceptions