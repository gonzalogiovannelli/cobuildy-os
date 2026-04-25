# Cobuildy OS — Business Requirements Document
**Version:** 1.0  
**Date:** April 27, 2025  
**Author:** Gonzalo Giovannelli — Head of Developer Relations  
**Team:** Danila Valiaev (CEO), Dona Karamanga (Investor Relations)  
**Repository:** github.com/gonzalogiovannelli/cobuildy-os (private)  
**Status:** Phase 1 — Architecture & Documentation complete

---

## 1. Executive Summary

Cobuildy is a real estate co-investment startup operating in Spain and Portugal. The company structures real estate development projects and connects promoters with professional investors. With a team of 3 people, the current operational model creates a hard ceiling on deal volume.

This document describes the **Cobuildy OS**: a file-based, agent-powered operating system that serves as the Single Source of Truth (SSOT) for all client interactions, projects, and deal flow. The system replaces fragmented information scattered across WhatsApp, email, LinkedIn, Google Drive, and Kommo CRM.

The system is built on a Git repository, operated via Claude Code, and designed to grow incrementally — starting with documentation and data architecture, then connecting live data sources, and finally automating repetitive workflows.

---

## 2. Problem Statement

### 2.1 Current Pain Points
- Deal volume is capped at ~1 deal per month due to manual overhead
- Lead information is fragmented across Kommo, personal WhatsApp, LinkedIn, email, and Google Drive
- When a lead becomes a warm client, tracking stops — no team member can see the full interaction history
- LinkedIn outreach is limited to 10-15 contacts/day instead of the 30/day target due to manual logging
- Google Drive folders are not consistently named or linked to CRM contacts
- Client data in Kommo becomes incomplete once a deal progresses to active structuring

### 2.2 Root Cause
There is no Single Source of Truth. Each team member holds part of the picture in their own tools. This makes collaboration, delegation, and scaling impossible without a structural change.

---

## 3. Solution Overview

The Cobuildy OS is a structured, file-based system stored in a private GitHub repository. It consists of two main areas:

| Area | Purpose |
|------|---------|
| `/knowhow` | Rules, policies, agent instructions, and operational guidelines |
| `/data` | Operational data: people, companies, projects, investors, outreach |

Claude Code reads the repository and uses the knowhow files to understand how to behave, then operates on the data files to log interactions, create entities, and answer queries.

The system does not replace Kommo, Google Drive, or any existing tool — it acts as an intelligent layer on top of them.

---

## 4. Data Architecture

### 4.1 Entity Model

| Entity | Description | Identifier |
|--------|-------------|------------|
| Person | Any human contact — promoter, investor, advisor, CFO | firstname_lastname.md |
| Company | Legal entity — promotora, SPV, investment company | company_name.md |
| Project | Real estate development deal | ES-001, PT-001... |
| Investor | Investor profile (subset of Person) | INV-001, INV-002... |

### 4.2 Key Relationships
- A **Person** can be a promoter, investor, or advisor
- A **Person** can have multiple **Companies** (including SPVs)
- A **Project** belongs to a **Company** (commercial entity, legal entity, or SPV)
- An **Investor** is a Person with an additional investor profile
- A **Project** can be presented to multiple **Investors**, tracked in feedback.md

### 4.3 Repository Structure

```
cobuildy-os/
  CLAUDE.md               → Master instructions for Claude Code
  BRD.md                  → This document
  knowhow/
    company.md            → Cobuildy profile, mission, value proposition
    entity-creation.md    → When and how to create each entity
    entity-matching.md    → How to identify existing contacts
    email-agent.md        → Inbound and outbound email workflow
    linkedin-agent.md     → LinkedIn outreach and lead tracking
    kommo-agent.md        → Kommo CRM sync workflow
    aircall-agent.md      → Phone call transcription workflow
    granola-agent.md      → Video call transcription workflow
    communication-agent.md → Tone, voice, message templates
    project-workflow.md   → Project lifecycle stages and rules
    required-documents.md → Documents required per stage
    tickets-index.md      → Bug and improvement tracker index
    tickets/              → One file per ticket
  data/
    people/               → One .md file per person
    companies/            → One .md file per company
    projects/             → One folder per project (ES-001/)
      project.md          → Project ficha
      log.md              → Interaction log
      feedback.md         → Investor feedback
      calls/              → Transcriptions (Aircall, Granola)
    investors/            → Investor profiles (INV-001...)
    outreach/             → LinkedIn pipeline tracking
```
---

## 5. Agent Architecture

### 5.1 Channels and Agents

| Channel | Agent File | Key Action |
|---------|-----------|------------|
| LinkedIn | linkedin-agent.md | Outreach, pipeline tracking, lead creation |
| Email (Outlook) | email-agent.md | Inbound/outbound processing, document detection |
| WhatsApp / Kommo | kommo-agent.md | Lead sync, stage changes, note extraction |
| Phone calls | aircall-agent.md | Transcription, verdict workflow, project creation |
| Video calls | granola-agent.md | Meeting notes, duplicate detection, routing |
| Calendly | entity-creation.md | Booking trigger, person creation, log entry |

### 5.2 Entity Matching Rules

Before creating any new entity, the system runs entity matching against existing records:

| Confidence | Condition | Action |
|------------|-----------|--------|
| 100% | Email matches exactly | Link automatically |
| 90% | Full name, company, or phone matches | Link automatically |
| 50–89% | Partial match found | Show evidence, ask Gonzalo |
| 25–49% | Weak match | Ask if new contact |
| 0–24% | No match | Create new entity automatically |

### 5.3 Automation Policy

| Action | Automatic | Requires Approval |
|--------|-----------|-------------------|
| First LinkedIn message after connection | ✅ Yes | |
| Subsequent LinkedIn messages | | ✅ Yes |
| Email follow-ups | | ✅ Yes |
| Project creation after call verdict | ✅ Yes (if viable) | |
| Drive folder creation | ✅ Yes (on first doc) | |
| New entity creation (100% match) | ✅ Yes | |
| New entity creation (50-89% match) | | ✅ Yes |

---

## 6. Project Lifecycle

### 6.1 Stages

| Stage | Required Documents | Blocker |
|-------|--------------------|---------|
| 1. Prospecting | None | No |
| 2. Analysis | None (criteria being evaluated) | No |
| 3. Contract Signed | DNI, CIF, Statutes, Signed contract | ⚠️ Yes |
| 4. Structuring | Land deed, Appraisal, Business plan | No |
| 5. Ready to Invest | Deck, Plans, Unit list, Permits, Budget | ⚠️ Yes |
| 6. Due Diligence | As requested by investor | No |
| 7. Closed / Discarded | — | — |

### 6.2 Key Milestones
- **Project code assigned** (ES-001) → when 3 criteria confirmed: location + ticket + type
- **Drive folder created** → only when first physical document is received
- **Contract signed** → hard blocker, no structuring without it
- **Verdict workflow** → after every call, agent summarizes and asks: viable / discarded / pending

---

## 7. Communication Rules

### 7.1 Language
- Spanish → contacts based in Spain or with Spanish names
- English → all other contacts
- Always match the language the contact uses first

### 7.2 LinkedIn Message Templates

**English:**
> "Hi [Name], I came across your work on [project type] in [location]. At Cobuildy we help developers structure deals and raise capital from professional investors — success fee only, no upfront cost. Are you working on anything you'd like to explore financing for?"

**Spanish:**
> "Hola [Name], vi que estás trabajando en proyectos en [location]. En Cobuildy ayudamos a promotores a estructurar operaciones y levantar capital con inversores profesionales — solo cobramos si levantamos el capital. ¿Tienes algún proyecto en marcha que quieras explorar?"

---

## 8. Implementation Roadmap

### Phase 1 — Architecture & Documentation ✅ Complete
- [x] Repository created and structured
- [x] All knowhow files written
- [x] Templates created for all entities
- [x] CLAUDE.md written
- [x] BRD written

### Phase 2 — Connect Data Sources (Next)
- [ ] Google Drive API connection
- [ ] Outlook/Email API connection
- [ ] Kommo API connection
- [ ] Aircall API connection
- [ ] Granola integration
- [ ] LinkedIn automation

### Phase 3 — Populate with Real Data
- [ ] Load current 3 active clients
- [ ] Create project folders for active deals
- [ ] Migrate existing Kommo contacts

### Phase 4 — Test and Iterate
- [ ] Test full flow with one real case
- [ ] Open tickets for issues found
- [ ] Friday garbage collection review

---

## 9. Pending Decisions

| ID | Topic | Description |
|----|-------|-------------|
| T-001 | Drive folder structure | Company documents duplicated across project folders when promoter has multiple projects |
| T-002 | WhatsApp personal | Gonzalo uses personal WhatsApp for client comms — pending migration to business number |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| SSOT | Single Source of Truth |
| BRD | Business Requirements Document |
| SPV | Special Purpose Vehicle — company created for a specific project |
| KYC | Know Your Customer — identity verification |
| Skin in the game | Minimum 10% equity contribution required from the promoter |
| Verdict | Gonzalo's decision after a call: viable / discarded / pending |
| Harness | The system of rules and instructions that directs AI agents |