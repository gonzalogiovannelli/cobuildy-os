# Email Agent — Rules and Workflow

## Purpose
Automatically process incoming emails to Gonzalo's Cobuildy account,
identify the sender, and take the appropriate action in the system.

## Trigger
A new email arrives at gonzalog@cobuildy.com (operational mailbox).
The agent is invoked manually for now (`node scripts/email/email-agent.js`)
and pulls unread INBOX messages.

## Step 1 — Identify the sender
- Extract: name, email address, phone (if present), company name (if present)
- Run entity matching against /data/people and /data/companies
- Follow rules defined in /knowhow/entity-matching.md

## Step 2 — Analyze the email content
- Does it contain attachments? → note file name, type, size
- Does it mention a project location?
- Does it mention financial figures (ticket, area, timeline)?
- Is it a reply to an existing conversation or a first contact?

## Step 3 — Determine the action

### Case A: Known person + attachment with project info
- This is a project document → trigger project creation workflow
- Create /data/projects/[CODE]/ from template if not exists
- Add log entry in log.md
- Upload attachment to corresponding Drive folder
- Update person.md activity summary

### Case B: Known person + no attachment
- Add log entry in log.md with email summary
- Update next action in person.md

### Case C: New person + attachment with project info
- Create person.md from template
- Create company.md if company is mentioned
- Trigger project creation workflow (same as Case A)

### Case D: New person + no attachment
- Create person.md from template
- Add to linkedin-pipeline.md if came from LinkedIn
- Log the interaction

## Step 4 — Drive folder creation (for new projects)
- Folder name format: [CODE] - [City] - [Promoter]
- Example: ES-001 - Malaga - NZPromocion
- Create in Cobuildy parallel Drive folder (test environment)
- Upload attachments to this folder
- Save Drive folder link in project.md

## Step 5 — Confirm and log
- If a project exists for the sender → add entry to /data/projects/[CODE]/log.md
- If no project (orphan person) → add entry to person.md `Interactions Log`
- Update `Last email:` field on person.md regardless
- Format: YYYY-MM-DD | Email | [summary] | [next action]

## Outbound Emails — Rules

## Trigger
Gonzalo sends an email from gonzalog@cobuildy.com

## Step 1 — Identify the recipient
- Run entity matching against /data/people and /data/companies
- Follow rules defined in /knowhow/entity-matching.md

## Step 2 — Analyze the email content
- Does it contain attachments? → note file name, type
- Is it sending a project ficha to an investor? → log in feedback.md
- Is it a follow-up to an existing conversation?
- Is it requesting documents from a promoter?

## Step 3 — Log the interaction
- Add entry to the relevant log.md
- Format: YYYY-MM-DD | Email (outbound) | [summary] | [next action]
- If a project ficha was sent to an investor → add entry in feedback.md:
  INV-00X | YYYY-MM-DD | Email | Ficha sent | Pending feedback