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
| Phone | Kommo / WhatsApp | Extracted automatically |
| WhatsApp | Kommo | Extracted automatically |
| LinkedIn | LinkedIn sheet | Read from column G |
| Kommo Lead ID | Kommo import | Extracted automatically |
| Kommo Contact ID | Kommo import | Extracted automatically |
| Type (role) | Manual | Gonzalo confirms after first interaction |
| Company | Email / Kommo / manual | Agent suggests, Gonzalo confirms |
| Source channel | Kommo tags / LinkedIn sheet | Extracted from tags (meta, es, pt) or sheet |
| Language | Kommo tags / email | Extracted from tags (es, eng, pt) |
| First contact date | Kommo created_at / email date | Extracted automatically |
| Current stage | Kommo status / manual | Synced from Kommo or updated manually |
| Communication preferences | Granola / Aircall / manual | Agent extracts from call notes |
| Activity summary | Auto-generated | System generates from log entries |
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
| Parent company | Manual | Gonzalo confirms when promoter mentions SPV |

---

## Project Fields

| Field | Source | How |
|-------|--------|-----|
| Code | System | Auto-assigned (ES-001, PT-001) on project creation |
| Stage | Manual / Kommo | Updated by Gonzalo after each milestone |
| Location | Email / Aircall / Granola | Extracted from first contact or call notes |
| Type | Email / Aircall / Granola / documents | Extracted automatically |
| Total area (m²) | Documents / Aircall / Granola | Extracted from business plan or call notes |
| Ticket (€) | Email / Aircall / Granola / Kommo | Extracted automatically |
| Financing instrument | Email / Aircall / Granola | Extracted automatically |
| Timeline | Aircall / Granola / documents | Extracted from call notes or business plan |
| Skin in the game | Aircall / Granola / documents | Extracted, Gonzalo confirms |
| Land secured | Escritura / Aircall / Granola | Extracted from documents or call notes |
| Commercial entity | Manual / documents | Gonzalo fills after first interaction |
| Legal entity | Documents / manual | Extracted from contract or estatuto |
| SPV | Documents / manual | Detected when new company appears in documents |
| Drive folder ID | System | Auto-created on project creation |
| Investors presented | Manual / Dona | Updated when ficha is sent to investor |
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