# Granola Agent — Rules and Workflow

## Purpose
Capture video-meeting summaries (Google Meet, Zoom) into the system as
`Meet`-channel log entries with the full Granola AI summary embedded
as a multi-line body.

## Status: MCP-driven, no script

There is no `scripts/granola/...` to run. Granola exposes its data
only through MCP, so the workflow is:

1. Gonzalo (or whoever) asks Claude in this chat to "log my meeting
   with [Name] today" / "log all Granola meetings since last Friday"
2. Claude calls the MCP tools to read meeting data
3. Claude writes the entries into the appropriate log via the same
   `logInteraction(slug, entry)` helper used by the other agents

This intentionally trades a one-click script for human-in-the-loop
control over which meetings get logged and what the summary looks
like (Granola summaries vary in quality — some are gold, some need
trimming).

## MCP server
- **URL:** `https://mcp.granola.ai/mcp`
- **Tools used:**
  - `list_meetings` — list recent meetings
  - `get_meetings` — pull full payload for a meeting
  - `query_granola_meetings` — search by content / attendees
  - `list_meeting_folders`, `get_meeting_transcript` — for deeper
    drilldown when the AI summary isn't enough

## Entity match
- Match attendees by email against `Email:` / `Personal Email:` in
  `/data/people/<slug>.md`
- Internal-only meetings (all attendees are Gonzalo / Dona / Danila)
  are not logged anywhere — they are team operating noise, not
  customer signal
- External meetings: log to every external attendee's log

## Entry format

```
YYYY-MM-DD | Meet | <one-line headline> | <next action>

### Section heading from Granola summary
- bullet
- bullet

### Another section
- ...
```

The header line is one line and follows the standard format. Below it,
a markdown body holds the full Granola AI summary, separated from the
header by a blank line. Sections within the body are normal markdown
(`###` headings, lists, etc.) — they show up cleanly in the log file.

Entries are separated by `\n---\n\n` (same as everywhere else; see
`log-architecture.md`).

The headline should be informative: "`Cobuildy / Urbana Home — Málaga
16 unidades`" beats "`Reunión con Cristóbal`". Pull the project name
or topic from the meeting title if Granola has one, otherwise from
the content.

## Why Meet entries are multi-line

Meet is the only channel where the full content (a real meeting) is
worth keeping inline — phone calls have audio links, emails have a
mailbox, Kommo has the lead UI. A meeting that the team had once and
will be referenced for months should not require a separate file or
URL hop.

## Dedup
Meet entries collapse on `(date, channel-tag)` — same person + same
day + `Meet` channel = one entry. This lets us:

- Re-import a meeting after Granola's AI summary has improved (replace
  short headline with full body): use `rebuildPersonLog(slug, entries,
  { replace: true })`
- Avoid duplicates if the user asks to "log the meeting" twice

If we ever need multiple distinct meetings on the same day with the
same person, add an explicit marker (`<!-- granola:MEETING_ID -->`)
to the header — same pattern as Aircall. Not implemented yet because
it hasn't come up.

## Logging routing
Same as everywhere — handled by `logInteraction(slug, entry)`:
- Person has an active project → `/data/projects/[CODE]/log.md`
- Otherwise → `/data/people/logs/<slug>.md` (sidecar)

## Project-creation gate
Promoter meetings can hit the 3-criteria gate (Location / Ticket /
Asset type). When Claude reads a Granola summary and all three are
covered, it should propose a verdict prompt before logging. In
practice today this is a manual judgement Gonzalo makes during the
"log this meeting" conversation — there is no automated detector yet.

## What this agent does NOT do
- It does not pull meetings on a schedule (no cron, no script).
- It does not store raw transcripts. The Granola UI keeps those; we
  store the AI summary inline in the log.
- It does not detect duplicate Meets when two team members both used
  Granola on the same call (rare for us today). If it happens, log
  once on whichever attendee's account had the better summary.
