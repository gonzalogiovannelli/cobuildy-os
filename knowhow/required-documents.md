# Required Documents — Per Project Stage

## Purpose
Define which documents are required at each stage of a project.
The system checks against this list to identify missing documents
and block stage advancement if critical documents are absent.

## Stage 1 & 2: Prospecting and Analysis
No documents required yet.
Project code assigned when 3 criteria confirmed (location, ticket, type).

## Stage 3: Contract Signed (KYC — mandatory before advancing)
- [ ] DNI of the signatory
- [ ] CIF of the company
- [ ] Company statutes (estatutos)
- [ ] Signed success fee contract

⚠️ All 4 documents must be in Drive before advancing to Structuring.

## Stage 4: Structuring
- [ ] Land title deed / arras contract / proof of secured land
- [ ] Official appraisal (current value + hypothetical value)
- [ ] Business plan or minimum financial model

⚠️ Without a minimum financial model, project cannot be taken seriously.

## Stage 5: Ready to Invest
- [ ] Project deck / presentation
- [ ] Plans and renders
- [ ] Detailed unit list (m2, type, price per unit)
- [ ] Building permit or permit status
- [ ] Construction budget or contractor agreement

⚠️ Without deck and unit list, project cannot be shown to investors.

## Stage 6: Investor Due Diligence
Documents requested by the investor on a case by case basis.
All requests and responses logged in /data/projects/[CODE]/log.md

## How the system uses this file
- When asked "what documents are missing for ES-001?"
  → system checks Drive folder contents against this list
  → returns list of missing documents for current stage
- When a document is uploaded to Drive
  → system updates project.md and log.md
- When all documents for a stage are complete
  → system notifies Gonzalo that project is ready to advance

## Notes
- Documents live in Google Drive, not in this repository
- This file defines what should be there, Drive holds the actual files
- Document names in Drive should follow this convention:
  [CODE]-[document-type]-[YYYY-MM-DD]
  Example: ES-001-appraisal-2025-04-25.pdf