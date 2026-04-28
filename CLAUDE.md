# Cobuildy OS — Claude Instructions

## What is Cobuildy
Cobuildy is a real estate co-investment startup operating in Spain and Portugal.
We structure real estate projects and connect promoters with investors.
We are a team of 3: Gonzalo (promoter side), Dona (investor side).and Daniel/Danila (CEO-Founder)

## What this repository is
This is our operating system. It is a file-based SSOT (Single Source of Truth)
that tracks all our leads, clients, projects, investors and interactions.
It replaces scattered information across WhatsApp, email, LinkedIn and Google Drive.

## Repository structure
- /knowhow → rules, policies and operational guidelines
- /data/people → one file per person (promoters and investors)
- /data/companies → one file per company
- /data/projects → one folder per project (ES-001, PT-001, etc.)
- /data/outreach → LinkedIn outreach pipeline

Investors live inside /data/people with an `Investor ID: INV-NNN` field —
they are NOT a separate folder.

## Operational accounts
- **Drive / company email:** gonzalog@cobuildy.com (this is what the
  agents read/write against)
- **Claude account:** gonzalogiovannelli@gmail.com (Gonzalo's personal,
  used to drive Claude Code)

## How to behave
- Always respond in the same language the user writes in
- When asked about a client or project, always check the relevant files first
- Never invent information. If something is not in the files, say so
- When creating a new entity, always use the corresponding template
- Keep all files and entries in English
- Dates always in YYYY-MM-DD format
- Project codes: ES-001, PT-001 (country + sequential number)
- Investor codes: INV-001 (sequential number)

## Key rules
- A person becomes a lead when they reply for the first time
- A project is created when Gonzalo gives a `viable` verdict and the
  3 minimum criteria are confirmed (location, ticket, asset type)
- An investor profile is created when a contact confirms investment interest
- Log entries go in /data/projects/[code]/log.md when a project exists,
  otherwise in /data/people/<slug>.md `Interactions Log` section
- Investor feedback goes in /data/projects/[code]/feedback.md

## Canonical channel names
Use these exact strings in log entries and `Last <channel>:` fields:
`Email` / `LinkedIn` / `Kommo` / `Call` / `Meet`

## MCP Servers

### Granola
- URL: https://mcp.granola.ai/mcp
- Use for: querying meeting notes, listing meetings, searching meeting content
- Available tools: query_granola_meetings, list_meetings, get_meetings