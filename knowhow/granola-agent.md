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
  3. Asset type mentioned?
- If all 3 met → present verdict prompt to Gonzalo:
  "Meeting with [Name] — [duration]
  Summary: [3-5 lines]
  Project info: Location [x], Ticket [x], Asset type [x]
  What is your verdict? (viable / discarded / pending)"
- If any criterion is missing → log the meeting on the person (or on the
  existing project if there is one) and DO NOT prompt for verdict.

### Investor meeting (Dona)
- Extract investor preferences if mentioned:
  ticket range, instrument, geography, risk profile
- Update investor fields in /data/people/<slug>.md (investor is a person
  with `Investor ID: INV-XXX` set — not a separate file)
- Log interaction in relevant project feedback.md if project was discussed

## Step 4 — Process verdict (promoter meetings only)

### viable
- Reserve the next project code (atomic — see `entity-creation.md`)
- Create `/data/projects/[CODE]/` from template
- Save transcription + structured notes alongside the project (path TBD
  when this agent is built — likely `/data/projects/[CODE]/calls/`)
- Log entry to project log.md: `YYYY-MM-DD | Meet | [summary] | [next action]`
- Update person.md `Last meet`, set `Current stage: active`,
  `Active projects` += new code
- Push to Kommo (future): note with project code on the linked Kommo lead

### discarded
- Log to project log.md if person already has a project, otherwise to
  person.md `Interactions Log`
- Format: `YYYY-MM-DD | Meet | Discarded — [reason] | No action`
- Update `Last meet` on person.md

### pending
- Same routing as discarded
- Format: `YYYY-MM-DD | Meet | Pending — [reason] | Follow up on [date]`
- Update `Last meet` on person.md

## Step 5 — Save transcription
- If a project exists → save to `/data/projects/[CODE]/calls/YYYY-MM-DD-granola.txt`
  (raw transcript) and `YYYY-MM-DD-granola-notes.txt` (structured notes)
- If no project → exact path TBD when this agent is built (same TBD as
  in `aircall-agent.md`)

## Channel name in logs
Use the canonical channel: `Meet`. Source (Granola, Zoom, Google Meet)
goes in the summary text if relevant, not in the channel column.

## Duplicate Meeting Detection

### Same meeting rule
If two or more team members hosted a Granola session with:
- Same Meet/Zoom link, OR
- Same date + same attendees + overlapping time

→ Treat as one meeting, not multiple. Keep the transcription with the
longest duration; discard the others.

### Internal meetings (team only)
If all attendees are Gonzalo, Dona, or Danila → log as internal meeting,
no client entity matching needed. Path for storage TBD when this agent
is built (likely `/data/internal-meetings/YYYY-MM-DD.md` or skip
storage entirely and only summarize on demand).

### Client meeting with multiple team members
If one or more attendees are external contacts → run entity matching on
external attendees only, keep longest transcription, associate to the
relevant client and project.

## Notes
- Granola covers video calls only, Aircall covers phone calls
- Structured notes from Granola are preferred over raw transcription
  when summarizing for log entries