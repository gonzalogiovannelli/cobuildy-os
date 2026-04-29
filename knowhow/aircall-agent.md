# Aircall Agent — Rules and Workflow

## Purpose
Backfill call metadata from Aircall into per-person interaction logs so
every phone touchpoint shows up alongside emails, Kommo notes, LinkedIn
DMs and Meets. The script does not summarise the conversation — that
content lives in the recording, linked from each entry.

## Why metadata-only
Voice Intelligence (the Aircall feature that exposes transcripts and
AI summaries via API) is **not on our plan**. Calling those endpoints
returns `403 Forbidden`. The backfill records only what the metadata
API gives us:

- date / direction / duration
- which team member handled it (`call.user.name`)
- a permanent recording link (when present)
- Aircall's call ID, for support / dedup

For full content, click the audio link in the entry — Aircall serves a
fresh signed audio URL after auth.

## Script
- **Source:** `scripts/aircall/backfill.js`
- **API client:** `scripts/aircall/aircall.js` (Basic auth, paginated)
- **Cutoff:** `2026-03-17` (configurable in the script)
- **Run:** `node scripts/aircall/backfill.js` (dry run) →
  `node scripts/aircall/backfill.js --apply`

## Matching — phone, not name
Aircall gives us `raw_digits` for the external party. The script:
1. Loads every `data/people/<slug>.md` and reads `Phone:` and
   `WhatsApp:` from the Links section.
2. Normalises both sides via `normalizePhone` (`scripts/entity/match.js`)
   — strips spaces / dashes / parens, handles `+34`, `+351`, `00`
   prefixes.
3. Builds `phone → [slug, ...]` map. Same number on multiple persons is
   rare but supported (entry is duplicated to each).

If the phone is on no person, the call is silently skipped — we don't
auto-create persons from cold inbound numbers.

## Entry format

```
YYYY-MM-DD | Call | (direction, duration) handled by @user | #call_id · [audio](url) <!-- aircall:CALL_ID -->
```

For unanswered calls (`!answered_at` or `duration < 5s`):

```
YYYY-MM-DD | Call | (direction, 0s) no answer | #call_id <!-- aircall:CALL_ID -->
```

The `#call_id` is intentionally visible in the entry (next to the
[audio] link) so we can quote it when contacting Aircall support.

The `<!-- aircall:CALL_ID -->` marker at the end is the **dedup key**
(see `log-architecture.md`). It lets the same person have multiple
entries on the same day (4 missed-call attempts is common) without
collapsing them, and lets us re-run the backfill after format changes
without producing duplicates.

## Recording URL — `asset` not `recording`
Aircall exposes three URL fields per call. The script uses
`call.asset` because:

- `recording` — one-shot signed S3 URL, expires in ~30 minutes. Useless
  for a log entry meant to be clickable later.
- `recording_short_url` — often empty on non-VI plans.
- `asset` — permanent URL of the form
  `https://assets.aircall.io/calls/<id>/recording`. Redirects (after
  Aircall auth in the browser) to a fresh signed audio URL on each
  click.

## Idempotency
The backfill calls `rebuildPersonLog(slug, entries, { replace: true })`.
Combined with the `aircall:ID` marker, re-running:

- Picks up new calls since the last run (added to existing log)
- Overwrites entries whose format we changed (e.g. when we switched
  from `recording_short_url` to `asset`)
- Never produces duplicates

Safe to re-run any time.

## Where the entry lands
Routed by `logInteraction(slug, entry)` (see `log-architecture.md`):
- Person has an active project → `/data/projects/[CODE]/log.md`
- Otherwise → `/data/people/logs/<slug>.md`

## What this agent does NOT do
- It does not transcribe (no VI access).
- It does not run the project-creation gate (no semantic content to
  judge "Location / Ticket / Asset type" on).
- It does not write back to Aircall (no notes API used).
- It does not auto-create persons from unknown phone numbers.

If we add a Voice Intelligence plan later, the natural extension is a
second pass that fetches transcripts for the calls already in the log
and replaces the metadata-only body with a Granola-style multi-line
summary, keyed by the same `aircall:ID` marker.
