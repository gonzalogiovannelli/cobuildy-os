# Kommo Agent — Rules and Workflow

## Purpose
Sync Kommo CRM data with the Cobuildy OS repository.
Kommo is the hub for WhatsApp Business and ad campaign leads.
Kommo notes written by the team are a key source of project information.

## Pipelines in Kommo
- **Developers** → promoter leads from ads and WhatsApp Business
- **Private Investors** → investor leads (managed by Dona)

## Data Kommo captures automatically
- Full name
- Phone (WhatsApp)
- Work email
- Country tag (es, pt, eng)
- Full WhatsApp conversation history
- Pipeline stage
- Team notes (key source of project info and call summaries)

## Inbound Lead Workflow

### Step 1 — New lead enters Kommo
- Extract: name, phone, email, country tag, pipeline
- Run entity matching against /data/people and /data/companies
- Follow rules in /knowhow/entity-matching.md

### Step 2 — Create or update entity
- If new → create person.md from template
- If existing → update identities section with Kommo ID and phone
- Add Kommo ID to person.md identities

### Step 3 — Log the interaction
- Add entry to person.md activity summary
- Format: YYYY-MM-DD | WhatsApp (Kommo) | [summary] | [next action]

## Pipeline Stage Change Workflow

### When a lead changes stage manually
- Log the stage change in person.md
- Format: YYYY-MM-DD | Kommo | Stage changed to [stage] | [next action]

## Notes and Call Summaries Workflow

### When a team member adds a note in Kommo
- Read the note content
- Check if it contains project information:
  - Location mentioned? → yes/no
  - Ticket amount mentioned? → yes/no
  - Project type mentioned? → yes/no
- If all 3 criteria are met → flag for project creation review

## Project Creation Trigger

### Minimum criteria to create a project
1. Location (city or region)
2. Approximate ticket (€)
3. Project type (renovation, new build, etc.)

### If criteria are met (from note, call transcript, or conversation)
- Extract project info from the source
- Present summary to Gonzalo:
  "New project detected for [Name]. Here is the summary:
  - Location: [x]
  - Ticket: [x]
  - Type: [x]
  What is your verdict? (viable / discarded / pending)"

### Verdicts
- **viable** → assign next project code, create /data/projects/[CODE]/ from template
- **discarded** → log reason in person.md, no project created
- **pending** → log in person.md, schedule follow-up

## Drive Folder Creation (separate hito)
- Drive folder is created only when first physical document is received
- Project code is already assigned at this point
- Folder name: [CODE] - [City] - [Promoter]
- Example: ES-001 - Asturias - LunaGrupo

## Enrich Kommo from the system
- When a project is created or updated in the repo,
  add a note in the corresponding Kommo lead with the project code
  and current status
- This keeps Kommo informed without making it the SSOT