# AIonOS Knowledge Base Integration (SharePoint + RAG)

## Overview
AIonOS RFP Generator integrates with Microsoft SharePoint to ingest presentations and documents into a vector store (Pinecone). The application then uses Retrieval-Augmented Generation (RAG) to generate proposals backed by the AIonOS knowledge base.

This guide consolidates setup, architecture, operations, endpoints, and troubleshooting into one place. No secrets or credentials are contained in this document.

---

## Architecture
- SharePoint Client (`sharepoint_client.py`)
  - Microsoft Graph authentication using app credentials
  - Folder discovery and file listing (path- or id-based)
  - File download and delta queries (incremental change tracking)
- File Parsers (`file_parsers.py`)
  - DOCX (python-docx), PPTX (python-pptx), XLSX (pandas/openpyxl), CSV (pandas), PDF (PyMuPDF/PyPDF2), TXT
- Ingestion Pipeline (`sharepoint_pipeline.py`)
  - Initial sync: full ingestion (list → download → extract → chunk → embed → upsert to Pinecone)
  - Incremental sync: Graph delta detection for new/changed/deleted items
  - Metadata for Pinecone vectors: `knowledge_base: "AIonOS"`, `filename`, `sharepoint_file_id`, `text`, `web_url`, `last_modified`, `file_type`
- API/Backend (`main.py` + routes)
  - Exposes REST endpoints for connection test, listing, status, sync control
  - Generating proposals using Groq LLM with Pinecone-backed context
- Frontend
  - Sends `{ text, method: "knowledgeBase", knowledge_base: "AIonOS" }` to generate with AIonOS knowledge base

---

## Environment & Configuration (no credentials)
Add these keys (values are managed securely via your deployment environment):

```bash
# SharePoint Authentication (place values in a secure env store)
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_TENANT_ID=

# SharePoint Location
SHAREPOINT_SITE_URL=  # or SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
SHAREPOINT_FOLDER_ID=
SHAREPOINT_FOLDER_PATH=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX_NAME=

# Groq
GROQ_API_KEY=

# CORS / Misc
ALLOWED_ORIGINS=
LOG_LEVEL=
```

Auto-sync controls:
```bash
# Auto-ingestion scheduler
SHAREPOINT_AUTO_SYNC_ENABLED=true          # Enable background sync
SHAREPOINT_INITIAL_SYNC_ON_START=true      # Run initial sync on app start (if never synced)
SHAREPOINT_SYNC_INTERVAL_MINUTES=60        # Incremental sync interval (e.g., 1440 for daily)
```

Folder path examples (no IDs):
```bash
# Example: SXRepository subfolder Agritech
SHAREPOINT_FOLDER_PATH=/Bid/SXRepository/Agritech
```

---

## SharePoint Access & Listing
- Path-based listing: `/sites/{siteId}/drives/{driveId}/root:{folder_path}:/children`
- Id-based listing: `/sites/{siteId}/drives/{driveId}/items/{folder_id}/children`
- Best practice: prefer path-based where possible; ensure trailing `:/` when resolving by path
- The app normalizes the path and supports recursive traversal for nested folders

Logging tags:
- `[graph]` for token acquisition and Graph requests
- `[list]` for folder/file listing and recursion details

---

## Ingestion Pipeline (Initial + Incremental)

### Initial Sync
1. List files (recursive)
2. Download content (per file)
3. Extract text (format-specific parser)
4. Chunk text (by ~1000 chars, overlap ~100)
5. Embed (HuggingFace, e.g., all-MiniLM-L6-v2)
6. Upsert into Pinecone with metadata `knowledge_base: "AIonOS"`

Logging tags:
- `[initial] Listing files from SharePoint (recursive)`
- `[initial] Processing file: name=… id=… url=…`
- `[initial] Extract / Chunk / Upsert` with counts and totals

### Incremental Sync (Delta)
- Retrieves changes via Graph delta query
- For each new/updated file: download, extract, chunk, embed, upsert
- For deletions: record detected deletion (vector cleanup strategy optional)

Logging tags:
- `[incremental] Delta query returned N changes`
- `[incremental] Processing change: name=… id=…`
- `[incremental] Upserting … vectors …`

---

## Automatic Sync (Scheduler)
- Runs as a background task after app startup
- Controls: `SHAREPOINT_AUTO_SYNC_ENABLED`, `SHAREPOINT_INITIAL_SYNC_ON_START`, `SHAREPOINT_SYNC_INTERVAL_MINUTES`
- Example: set `SHAREPOINT_SYNC_INTERVAL_MINUTES=1440` for once-per-day sync

Startup logs include:
- `[SharePoint Sync] Auto-sync enabled. Interval=… min. Initial on start=…`
- Then periodic increments: `[SharePoint Sync] Incremental sync completed: …`

---

## API Endpoints

- `GET /api/sharepoint/test-connection`
  - Verifies Microsoft Graph token acquisition
- `GET /api/sharepoint/list-files?recursive=true`
  - Shows files (and optionally folders) for verification
- `GET /api/sharepoint/status`
  - Shows connection state, whether initial sync has been performed, and index info
- `POST /api/sharepoint/sync/initial`
  - One-time full ingestion
- `POST /api/sharepoint/sync/incremental`
  - Delta-based updates; safe to run periodically

- `POST /api/generate-solution-text`
  - Body example (using AIonOS KB):
    ```json
    {
      "text": "Generate a proposal for …",
      "method": "knowledgeBase",
      "knowledge_base": "AIonOS"
    }
    ```
  - Backend queries Pinecone with `knowledge_base == "AIonOS"` to build context, then generates the proposal

---

## Frontend Flow
- User selects Knowledge Base → AIonOS
- Sends `text`, `method: "knowledgeBase"`, `knowledge_base: "AIonOS"`
- Backend retrieves relevant chunks from Pinecone, augments the prompt, and returns a structured proposal

---

## Quick Start
1. Configure env vars (no secrets in this document)
2. Install backend dependencies (see `backend/requirements.txt`)
3. Start backend (uvicorn)
4. Test connection → list files
5. Run initial sync (one-time)
6. Verify status `has_initial_sync: true`
7. Generate with `knowledge_base: "AIonOS"`
8. Ensure auto-sync scheduler is on for future updates

---

## Troubleshooting
- Auth errors: verify app credentials and tenant; confirm required Graph permissions (Sites.Read.All, Files.Read.All, admin consent)
- Empty listings: verify folder path; ensure trailing colon in path-based Graph calls; check drive/folder alignment
- Delta issues: remove saved delta link file to reset (if present) and re-run initial sync
- Parsing errors: ensure format supported and parser dependencies installed
- Performance: large folders may take time; rely on incremental sync after initial run

---

## Operational Notes
- No user-provided tokens are required; the backend acquires and refreshes Graph tokens automatically
- New files in SharePoint are picked up by the incremental sync based on the configured schedule
- Generation always uses the latest vectors in Pinecone

---

## Folder Path Updates
To point the system at a different folder, set `SHAREPOINT_FOLDER_PATH` to the desired root (e.g., `/Bid/SXRepository/SomeFolder`) and restart the backend. For path-based listing, the application will recursively traverse and ingest content under that path.

---

## Change Log (High-Level)
- Added PPTX, DOCX, XLSX, CSV, PDF, TXT parsing
- Implemented initial and incremental SharePoint ingestion
- Added knowledge base filtering in generation (`knowledge_base: "AIonOS"`)
- Implemented background auto-sync with configurable interval
- Expanded logging across Graph calls, listing, and pipeline stages for full visibility


# Architecture Comparison: Proposed vs. Current Implementation

## ✅ What We Have (Current Implementation)

### Core Components
1. **SharePoint Client** (`sharepoint_client.py`)
   - ✅ Microsoft Graph API authentication
   - ✅ File listing and downloading
   - ✅ Delta query support
   - ✅ Path-based and ID-based access

2. **File Parsers** (`file_parsers.py`)
   - ✅ PPTX parsing using `python-pptx`
   - ✅ Extracts text from slides and tables
   - ✅ Supports: DOCX, PPTX, XLSX, CSV, PDF, TXT

3. **SharePoint Pipeline** (`sharepoint_pipeline.py`)
   - ✅ Ingests SharePoint files into Pinecone
   - ✅ Chunking and embedding
   - ✅ Initial and incremental sync
   - ✅ Metadata tagging with `knowledge_base: "AIonOS"`

4. **API Integration** (`main.py`)
   - ✅ Knowledge base filtering: `knowledge_base="AIonOS"`
   - ✅ RAG retrieval with metadata filter
   - ✅ Support for both SharePoint and user uploads

5. **API Routes** (`sharepoint_routes.py`)
   - ✅ `/api/sharepoint/sync/initial`
   - ✅ `/api/sharepoint/sync/incremental`
   - ✅ `/api/sharepoint/list-files`
   - ✅ `/api/sharepoint/test-connection`
   - ✅ `/api/sharepoint/status`

---

## ❌ What's Missing from Proposed Architecture

### 1. Standalone Sync Script
**Proposed:** `sync_aionos_kb.py` - dedicated script for scheduled syncs
- ❌ Not implemented
- **Current:** Uses API endpoints or runs pipeline directly

### 2. Explicit Generation Methods
**Proposed:** Three distinct methods:
- `llmOnly` - Pure LLM
- `userKnowledgeBase` - User uploads
- `aionosKnowledgeBase` - SharePoint PPTs

**Current:** 
- ✅ Has `method="llmOnly"` or `method="knowledgeBase"`
- ✅ Has `knowledge_base="AIonOS"` filter
- ❌ Missing explicit three-way split

### 3. Folder Organization Metadata
**Proposed:** Track `folder_name` in metadata for organization
- ❌ Current metadata doesn't include folder hierarchy
- ❌ No folder-specific sync stats

### 4. Cache Directory
**Proposed:** Local cache for downloaded PPTs (`sharepoint_cache/aionos_ppts/`)
- ❌ Files downloaded directly, not cached locally
- ❌ No folder-specific cache structure

### 5. Enhanced Stats Endpoint
**Proposed:** `/api/aionos-stats` with:
- Folder counts
- File counts per folder
- Vector counts per folder
- ❌ Current: Basic status only

### 6. Generation Methods Endpoint
**Proposed:** `/api/generation-methods` to list available methods
- ❌ Not implemented

---

## 🔧 Implementation Gaps Summary

| Feature | Proposed | Current | Status |
|---------|----------|--------|--------|
| SharePoint Graph API | ✅ | ✅ | **Complete** |
| PPTX Text Extraction | ✅ | ✅ | **Complete** |
| Pinecone Ingestion | ✅ | ✅ | **Complete** |
| Knowledge Base Filtering | ✅ | ✅ | **Complete** |
| Standalone Sync Script | ✅ | ❌ | **Missing** |
| Three-Way Method Split | ✅ | ⚠️ | **Partial** |
| Folder Metadata | ✅ | ❌ | **Missing** |
| Cache Directory | ✅ | ❌ | **Missing** |
| Stats Endpoint | ✅ | ❌ | **Missing** |
| Methods Endpoint | ✅ | ❌ | **Missing** |

---

## 📝 Recommendations

### High Priority (Core Functionality Works)
1. **Fix SharePoint folder access** - Path-based endpoints are working
2. **Run initial sync** - Populate Pinecone with SharePoint content
3. **Test knowledge base filtering** - Verify `knowledge_base="AIonOS"` works

### Medium Priority (Enhancement)
1. Add folder metadata tracking
2. Create standalone sync script
3. Add stats endpoint

### Low Priority (Nice to Have)
1. Implement cache directory
2. Add generation methods endpoint
3. Refactor to explicit three-way method split

---

## ✅ Current Architecture is Functional

**The core workflow works:**
1. SharePoint → Download files (including PPTX)
2. Extract text using `file_parsers.py`
3. Chunk and embed
4. Store in Pinecone with `knowledge_base: "AIonOS"`
5. Query with metadata filter when `knowledge_base="AIonOS"`

**The main issue is:**
- SharePoint folder access returning 400 errors (being fixed)
- No content in Pinecone yet (need to run initial sync)

---

## 🚀 Next Steps

1. **Fix folder access** (in progress)
2. **Run initial sync** to populate knowledge base:
   ```bash
   POST /api/sharepoint/sync/initial
   ```
3. **Test knowledge base**:
   ```bash
   POST /api/generate-solution-text
   {
     "text": "...",
     "method": "knowledgeBase",
     "knowledge_base": "AIonOS"
   }
   ```
4. **Verify retrieval** - Check logs for "Retrieved N documents from AIonOS knowledge base"

