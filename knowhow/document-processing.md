# Document Processing — Rules and Workflow

## Purpose
When a document arrives (email attachment, Drive upload, WhatsApp),
the system reads it, extracts key information, renames it following
the naming convention, and uploads it to the correct Drive folder.

## Reading Strategy
- **5 pages or fewer:** read the full document
- **More than 5 pages:** read only the first 3 pages
- This applies to all file types: PDF, Word, Excel, images

## Information to Extract
From every document, try to extract:
- Document type (estatuto, planos, tasación, business plan, contrato, etc.)
- Company name or project name mentioned
- Date of the document (if present)
- Key figures (ticket, surface area, NIF, etc.)

## Naming Convention
Format: [PROJECT_CODE]-[document_type]-[descriptor]-[YYYY-MM-DD].[ext]

Examples:
- ES-001-estatuto-inversiones_poliandrus-2025-04-27.pdf
- ES-001-planos-malaga-fase1-2025-04-27.pdf
- ES-001-tasacion-suelo-guadarrama-2025-04-27.pdf
- ES-001-business_plan-2025-04-27.xlsx
- ES-001-contrato-success_fee-2025-04-27.pdf

Rules:
- Always lowercase
- Spaces replaced with underscores
- Date is document date if found, otherwise today's date
- If project code unknown at time of upload, use PENDING as code
  and rename when project is assigned

## Document Types (standard names)
- estatuto → company statutes
- dni → identity document
- contrato → any contract
- tasacion → appraisal
- planos → architectural plans
- renders → visual renders
- business_plan → financial model or business plan
- presentacion → project presentation or deck
- licencia → building permit
- escritura → land title deed
- presupuesto → construction budget
- memoria → technical report

## Workflow

### Step 1 — Receive document
- Source: email attachment, WhatsApp forward, direct upload

### Step 2 — Read and analyze
- Apply reading strategy based on page count
- Extract: document type, company/project name, date, key figures

### Step 3 — Propose new name
- Generate name following convention
- Present to Gonzalo: "Rename [original_name.pdf] to [new_name.pdf]? yes / edit / skip"

### Step 4 — Upload to Drive
- Upload to /data/projects/[CODE]/Documents/ or /Legal/ or /Financial/
  based on document type
- Save Drive link in project log.md

### Step 5 — Update project ficha
- If document contains new project data (ticket, NIF, etc.)
- Present findings: "Found in document: [field]: [value]. Update project.md? yes / skip"

## Folder routing by document type
- Legal folder: estatuto, dni, contrato, escritura, licencia
- Financial folder: tasacion, business_plan, presupuesto
- Documents folder: planos, renders, presentacion, memoria, otros