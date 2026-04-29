# Communication Agent — Rules and Workflow

## Purpose
Centralise the rules and templates for outbound communication
(LinkedIn DMs, email replies, follow-ups). The system mostly **suggests**
text — it does not send anything automatically.

For tone and voice see `knowhow/tone-and-voice.md` (single source on
greetings, closings, language, examples).

## What is automatic vs manual

| Action | Automatic | Manual |
|---|:-:|:-:|
| Send LinkedIn connection request | | ✓ (Sales Navigator) |
| Send LinkedIn first message after acceptance | | ✓ |
| Send any subsequent LinkedIn DM | | ✓ |
| Reply to incoming email | | ✓ |
| Update LinkedIn outreach Sheet (status changes) | | ✓ |
| Process warm LinkedIn lead (`Reply received = TRUE`) | ✓ | (linkedin-agent) |
| Refresh `Last <channel>` on person.md | ✓ | (per-channel agent) |

Bottom line: **outreach is human-driven**. The system only acts when
something has already happened (a reply arrived, a meeting ended, a
document was uploaded).

## LinkedIn workflow (current reality)

The LinkedIn outreach pipeline lives in a Google Sheet (Developers tab),
not in this repo. Gonzalo maintains it manually:
1. Sends a connection request → ticks `Gonzalo connection sent` (col H)
2. Connection accepted → ticks `Connection accepted` (col I)
3. Sends first DM → ticks `Msg sent` (col K)
4. Receives reply → ticks `Reply received` (col L) ← warm lead

When a row reaches step 4, the next run of `linkedin-agent` creates the
`person.md` (and `company.md` if applicable) automatically. Entity
matching prevents duplicates if the contact already exists from another
channel (email / Kommo).

After person.md exists, future LinkedIn DMs from Gonzalo are still
manual. Only the metadata gets updated by agents (`Last LinkedIn`,
log entries) when the next sync happens — see linkedin-agent.md.

## LinkedIn message templates (reference for Gonzalo)

These are reference templates Gonzalo copies/adapts when sending the
first message after a connection is accepted. Use the language the
contact uses; default to Spanish for Spanish names / Spain-based
contacts, English otherwise.

### English
> Hi [Name], I came across your work on [project type] in [location].
> At Cobuildy we help developers structure deals and raise capital from
> professional investors — success fee only, no upfront cost.
> Are you working on anything you'd like to explore financing for?

### Spanish
> Hola [Name], vi que estás trabajando en proyectos en [location].
> En Cobuildy ayudamos a promotores a estructurar operaciones y levantar
> capital con inversores profesionales — solo cobramos si levantamos
> el capital. ¿Tienes algún proyecto en marcha que quieras explorar?

### When they write first
No template. Read what they said, write a personalised reply that
moves toward booking a call.

## Email follow-up — future scope
Idea: after each outbound email, if no reply in 5 business days,
the system suggests a follow-up message to Gonzalo. Suggestion only,
never sent automatically. **Not implemented yet** — Gonzalo currently
tracks follow-ups manually.

## Goal of every conversation
Book a call (Calendly link). Do not push more than one follow-up per
channel. If silence after a follow-up, leave the lead in `dormant` and
move on.
