# Data Enrichment Rules

## Purpose
Define how each field in every entity template gets populated.
Sources: email agent, Kommo agent, Aircall agent, Granola agent, LinkedIn sheet, manual input.

---

## Person Fields

| Field | Source | How |
|-------|--------|-----|
| Full name | Kommo / email / LinkedIn sheet | Extracted automatically from contact name |
| Email | Kommo / email header | Extracted automatically |
| Phone | Kommo | Extracted automatically |
| WhatsApp | Kommo | Extracted automatically |
| LinkedIn | LinkedIn sheet | URL from sheet |
| Kommo Lead ID | Kommo import | Extracted automatically |
| Kommo Contact ID | Kommo import | Extracted automatically |
| Role | Agent suggestion / manual | Agent suggests `promoter` or `investor`, Gonzalo confirms |
| Investor ID | Manual | Assigned (INV-NNN) when contact confirms investment interest |
| Company | Email / Kommo / manual | Agent suggests, Gonzalo confirms |
| Channel | Email header / Kommo / LinkedIn sheet | First-contact channel: email / linkedin / kommo / referral / direct |
| Language | Kommo tags / email | es / en / pt |
| First contact date | Channel-specific (email Date header, Kommo created_at, etc.) | Extracted automatically per channel |
| Current stage | Manual / inferred | prospecting / active / dormant / discarded — independent from project Stage |
| Communication preferences | Granola / Aircall / manual | Agent extracts from call notes |
| Active projects | System | List of project codes when person becomes a promoter on one or more projects |
| Last email / call / meet / LinkedIn / Kommo | Per-channel agents | Each agent updates only its own channel's date |
| Next action | Manual / agent suggestion | Agent suggests after each interaction |

---

## Company Fields

| Field | Source | How |
|-------|--------|-----|
| Legal name | Documents / manual | Extracted from estatuto or contract |
| Commercial name | Email / manual | Mentioned in email signature or conversation |
| NIF/CIF | Documents / manual | Extracted from estatuto or contract |
| Address | Documents / manual | Extracted from escritura or estatuto |
| Country | Tags / email / manual | Inferred from location |
| Website | LinkedIn / email signature | Extracted automatically |
| Legal owners | Documents / manual | Extracted from estatuto or acta titular real |
| Ownership % | Documents / manual | Extracted from estatuto |
| Associated people | Manual / agent | Agent links when person mentions company |

---

## Project Fields

| Field | Source | How |
|-------|--------|-----|
| Code | System | Auto-assigned (ES-001, PT-001) on project creation |
| Stage | Manual / agent | prospecting → analysis → contract-signed → structuring → ready-to-invest → due-diligence → closed-won / discarded |
| Location | Email / Aircall / Granola | Extracted from first contact or call notes |
| Asset type | Email / Aircall / Granola / documents | residential / commercial / hospitality / mixed |
| Total area (m²) | Documents / Aircall / Granola | Extracted from business plan or call notes |
| Ticket (€) | Email / Aircall / Granola / Kommo | Extracted automatically |
| Financing instrument | Email / Aircall / Granola | Extracted automatically |
| Timeline | Aircall / Granola / documents | Extracted from call notes or business plan |
| Skin in the game | Aircall / Granola / documents | Extracted, Gonzalo confirms |
| Land secured | Escritura / Aircall / Granola | Extracted from documents or call notes |
| Commercial entity | Manual / documents | Gonzalo fills after first interaction |
| Legal entity | Documents / manual | Extracted from contract or estatuto |
| SPV | Documents / manual | Detected when new company appears in documents |
| Drive folder ID / link | System | Auto-created on project creation |
| Google Sheet | Manual | Gonzalo links the financial-model sheet here |
| Created / First document received / Created by | System | Auto-filled by the agent that created the project |
| Status summary | Manual / agent | Agent drafts, Gonzalo reviews |

---

## Enrichment Triggers

### Automatic (no confirmation needed)
- New email from known contact → update last interaction in person.md
- New Kommo stage change → update stage in person.md
- New LinkedIn connection accepted → update status in linkedin-pipeline.md

### Semi-automatic (agent proposes, Gonzalo confirms)
- Email with project data → propose project creation with extracted fields
- Document received → propose rename and field extraction
- Call transcript → propose verdict and field updates

### Manual
- Communication preferences
- Verdict (viable / discarded / pending)
- Company relationships
- Investor assignments