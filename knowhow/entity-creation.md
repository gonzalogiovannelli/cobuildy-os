# Entity Creation Rules

## Person
**When:** when a lead replies for the first time (LinkedIn, WhatsApp, email, Kommo)
**Who:** any team member
**File:** /data/people/firstname_lastname.md
**Initial Current stage:** prospecting

## Company
**When:** when a person mentions their company for the first time
**Who:** whoever is managing the contact
**File:** /data/companies/company_name.md
**Link:** referenced from person.md (Role section + Links)

## Project
**When:** Gonzalo gives a `viable` verdict after analyzing the lead
(typically requires the 3 minimum criteria — location, ticket, asset type —
to be confirmed; see project-workflow.md Stage 2)
**Code:** ES-001, PT-001 (country + sequential number, atomically reserved)
**File:** /data/projects/ES-001/project.md
**Initial Stage:** analysis
**Link:** referenced from person.md (Promoter) and company.md

## Investor
**When:** when a contact confirms investment interest
**How:** add `Investor ID: INV-NNN` to the existing person.md — investors
are NOT a separate file, they are a person with the investor field set
**Additional fields recorded on the same person.md:** ticket range,
instrument, geography, risk profile (in Communication Preferences / Notes)