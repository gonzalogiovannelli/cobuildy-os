# Entity Creation Rules

## Person
**When:** when a lead replies for the first time (LinkedIn, WhatsApp, email)
**Who:** any team member
**File:** /data/people/firstname_lastname.md
**Initial status:** lead

## Company
**When:** when a person mentions their company for the first time
**Who:** whoever is managing the contact
**File:** /data/companies/company_name.md
**Link:** referenced from person.md

## Project
**When:** when a promoter sends the first project document
**Code:** ES-001, PT-001 (country + sequential number)
**File:** /data/projects/ES-001/project.md
**Link:** referenced from person.md and company.md

## Investor
**When:** when a contact confirms investment interest
**Code:** INV-001 (sequential number)
**Added to:** investor_id field in existing person.md
**Additional fields:** ticket, instrument, geography, risk profile

## Calendly Booking
**When:** a new meeting is booked via Calendly
**Action:** 
- Run entity matching on name and email
- If new → create person.md from template
- Add log entry: YYYY-MM-DD | Calendly | Meeting booked for [date] | Prepare for call
- Granola takes over when the meeting happens