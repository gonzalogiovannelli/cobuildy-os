# Entity Matching Rules

## Purpose
When a new interaction arrives (email, WhatsApp, LinkedIn),
the system must determine if the sender already exists in /data/people
or /data/companies before creating a new entity.

## Matching Fields (in order of priority)
1. Phone number (normalized for ES/PT prefixes) → 100% match
2. Email address (lowercase) → 100% match
3. Full name + same company → 90% match
4. Full name only → 70% match
5. First name only → 30% match
6. Company name (fuzzy: ignore S.L., S.A., underscores, accents) → 90% match
   for company-to-company matching

## Match Thresholds

### 100% — Automatic, no confirmation needed
- Email matches exactly
- Action: link to existing entity, proceed automatically

### 90% — Automatic, no confirmation needed
- Full name, company name, or phone matches
- Action: link to existing entity, log the new channel identity

### 50–89% — Ask user, show evidence
- Partial matches found
- Action: show the user which existing entity was found and why,
  ask "Is this the same person?" before proceeding
- Display: matching fields, existing file path, confidence level

### 25–49% — Ask user if this is a new entity
- Very few matches, likely a new person
- Action: ask "We found a weak match with [name]. Is this a new contact
  or the same person?"

### 0–24% — Create as new entity automatically
- No meaningful matches found
- Action: create new person.md from template, assign next available code

## Notes
- Always check /data/people AND /data/companies
- Company name matching should be fuzzy (ignore SL, SA, spaces, accents)
- Log every match decision in the relevant log.md
- If a new channel is discovered for an existing person (e.g. email found
  for someone who only had LinkedIn), update their identities section