# Granola Agent — Rules and Workflow

## Purpose
Automatically process meeting transcriptions and notes from Granola
for all team members, identify the contact, and trigger the
appropriate workflow based on who hosted the meeting and contact type.

## Team Members on Granola
- **Gonzalo** → meetings with promoters
- **Dona** → meetings with investors
- **Danila** → mixed

## Meeting Types
- Video calls via Google Meet, Zoom, or similar
- Granola captures transcription + structured notes automatically

## Transcription Sources
- **Granola** → video calls (this agent)
- **Aircall** → phone calls (separate agent)
- No overlap, no duplicates

## Step 1 — Identify the meeting
- Extract: host, attendees, duration, date, platform
- Identify team member involved
- Run entity matching on attendees against /data/people
- Follow rules in /knowhow/entity-matching.md

## Step 2 — Process Granola output
- Read structured notes and full transcription
- Extract:
  - Main topics discussed
  - Project or investment information mentioned
  - Documents requested or shared
  - Commitments made by either party
  - Next steps agreed

## Step 3 — Route by meeting type

### Promoter meeting (Gonzalo or Danila)
- Check for project creation criteria:
  1. Location mentioned?
  2. Ticket amount mentioned?
  3. Project type mentioned?
- If all 3 met → present verdict prompt to Gonzalo:
  "Meeting with [Name] — [duration]
  Summary: [3-5 lines]
  Project info: Location [x], Ticket [x], Type [x]
  What is your verdict? (viable / discarded / pending)"

### Investor meeting (Dona)
- Extract investor preferences if mentioned:
  ticket range, instrument, geography, risk profile
- Update investor profile in /data/people or /data/investors
- Log interaction in relevant project feedback.md if project was discussed

## Step 4 — Process verdict (promoter meetings only)

### viable
- Assign next project code (ES-00X or PT-00X)
- Create /data/projects/[CODE]/ from template
- Save transcription: /data/projects/[CODE]/calls/YYYY-MM-DD-granola.txt
- Save Granola notes: /data/projects/[CODE]/calls/YYYY-MM-DD-granola-notes.txt
- Add log entry: YYYY-MM-DD | Meeting (Granola) | [summary] | [next action]
- Add note in Kommo with project code

### discarded
- Log reason in person.md
- Add log entry: YYYY-MM-DD | Meeting (Granola) | Discarded — [reason] | No action

### pending
- Log in person.md activity summary
- Add log entry: YYYY-MM-DD | Meeting (Granola) | Pending — [reason] | Follow up on [date]

## Step 5 — Save transcription
- If project exists → /data/projects/[CODE]/calls/YYYY-MM-DD-granola.txt
- If no project → /data/people/calls/firstname_lastname/YYYY-MM-DD-granola.txt

## Duplicate Meeting Detection

### Same meeting rule
- If two or more team members hosted a Granola session with:
  - Same Meet/Zoom link OR
  - Same date + same attendees + overlapping time
- → Treat as one meeting, not multiple
- → Keep the transcription with the longest duration
- → Discard the others

### Internal meetings (team only)
- If all attendees are Gonzalo, Dona, or Danila
- → Log as internal meeting, no client entity matching needed
- → Save in /knowhow/internal-meetings/YYYY-MM-DD.txt if relevant

### Client meeting with multiple team members
- If one or more attendees are external contacts
- → Run entity matching on external attendees only
- → Keep longest transcription
- → Associate to the relevant client and project

## Notes
- Granola covers video calls only, Aircall covers phone calls
- Granola provides both transcription and structured notes
- Structured notes from Granola are preferred over raw transcription for log summaries