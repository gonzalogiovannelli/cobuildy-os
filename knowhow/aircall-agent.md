# Aircall Agent — Rules and Workflow

## Purpose
Automatically process call transcriptions from Aircall for all team members,
identify the contact, and trigger the appropriate workflow based on
who called, call direction, and contact type.

## Team Members on Aircall
- **Gonzalo** → calls promoters (outbound mostly)
- **Dona** → calls investors (outbound) + receives all inbound calls
- **Danila** → mixed

## Call Types

### By direction
- **Outbound** → team member initiated the call
- **Inbound** → contact initiated, always received by Dona

### By contact type
- **Promoter call** → handled by Gonzalo or Danila
- **Investor call** → handled by Dona

## Transcription Sources
- **Aircall** → phone calls (this agent)
- **Granola** → video calls, Meet, Zoom (separate agent)
- No overlap, no duplicates

## Step 1 — Identify the call
- Extract: caller, receiver, direction, duration, date
- Identify team member involved
- Extract contact phone number
- Run entity matching against /data/people
- Follow rules in /knowhow/entity-matching.md

## Step 2 — Summarize the call
- Read the full transcription
- Extract:
  - Main topics discussed
  - Project or investment information mentioned
  - Documents or next steps mentioned
  - Any commitments made by either party

## Step 3 — Route by call type

### Promoter call (Gonzalo or Danila)
- Check for project creation criteria:
  1. Location mentioned?
  2. Ticket amount mentioned?
  3. Asset type mentioned?
- If all 3 met → present verdict prompt to Gonzalo:
  "Call with [Name] — [duration]
  Summary: [3-5 lines]
  Project info: Location [x], Ticket [x], Asset type [x]
  What is your verdict? (viable / discarded / pending)"
- If any criterion is missing → log the call on the person (or on the
  existing project if there is one) and DO NOT prompt for verdict.

### Investor call (Dona or inbound)
- Extract investor preferences if mentioned:
  ticket range, instrument, geography, risk profile
- Update investor fields in /data/people/<slug>.md (investor is a person
  with `Investor ID: INV-XXX` set — not a separate file)
- Log interaction in relevant project feedback.md if a project was discussed

## Step 4 — Process verdict (promoter calls only)

### viable
- Assign next project code (ES-00X or PT-00X)
- Create /data/projects/[CODE]/ from template
- Save transcription: /data/projects/[CODE]/calls/YYYY-MM-DD-aircall.txt
- Add log entry: YYYY-MM-DD | Call (Aircall) | [summary] | [next action]
- Add note in Kommo with project code

### discarded
- Log reason in person.md
- Add log entry: YYYY-MM-DD | Call (Aircall) | Discarded — [reason] | No action

### pending
- Log in person.md activity summary
- Add log entry: YYYY-MM-DD | Call (Aircall) | Pending — [reason] | Follow up on [date]

## Step 5 — Save transcription
- If project exists → /data/projects/[CODE]/calls/YYYY-MM-DD-aircall.txt
- If no project → /data/people/calls/firstname_lastname/YYYY-MM-DD-aircall.txt

## Notes
- Inbound calls always go to Dona
- Aircall covers phone calls only, Granola covers video calls
- Over time, Aircall transcriptions replace manual Kommo notes