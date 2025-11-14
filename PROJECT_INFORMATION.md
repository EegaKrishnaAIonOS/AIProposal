# 📋 AIProposal - Complete Project Information & Features

## 🎯 Project Overview

**AIProposal** is an intelligent RFP (Request for Proposal) solution generator that uses AI to automatically analyze RFP documents and generate professional, detailed technical proposals. It streamlines the proposal writing process by leveraging machine learning to extract key information, identify challenges, and suggest solutions.

**Repository**: AIProposal (version2 branch)  
**Owner**: EegaKrishnaAIonOS  
**Current Version**: 0.1.0

---

## 🏗️ Technology Stack

### **Backend**
- **Framework**: FastAPI (Python 3.8+)
- **AI/LLM**: Groq Cloud (Llama 3 model)
- **Vector Database**: Pinecone (for RAG - Retrieval Augmented Generation)
- **Embeddings**: HuggingFace (all-MiniLM-L6-v2)
- **Document Processing**: 
  - PyPDF2 (PDF parsing)
  - python-docx (Word document generation)
  - python-pptx (PowerPoint support)
- **Web Framework Utilities**: Uvicorn, Pydantic, SQLAlchemy
- **Web Scraping**: BeautifulSoup, Selenium (optional)
- **Database**: SQLite
- **RAG Framework**: LangChain

### **Frontend**
- **Framework**: React 18.2.0 with React Router v7.9.1
- **Styling**: Tailwind CSS 3.4.17
- **UI Icons**: lucide-react, react-icons, @heroicons/react
- **File Upload**: react-dropzone 14.3.8
- **Date Handling**: date-fns 4.1.0
- **Testing**: Jest, React Testing Library

### **Infrastructure**
- **API Documentation**: FastAPI Auto-docs (Swagger)
- **CORS**: FastAPI CORS Middleware
- **File Handling**: Temporary file storage with cleanup
- **Authentication**: OAuth2 support in routes

---

## ✨ Core Features

### 1. **RFP Document Upload & Processing**
- **Supported Formats**: PDF (.pdf), Word (.docx)
- **Max File Size**: 10MB (configurable)
- **Processing**: Real-time extraction and parsing
- **Status Updates**: Real-time progress indicators

### 2. **AI-Powered Analysis**
- **Problem Statement Extraction**: Automatically extracts and summarizes the RFP problem
- **Key Challenges Identification**: Identifies and lists critical challenges
- **Solution Approach Generation**: Proposes detailed technical solutions
- **Technical Stack Recommendation**: Suggests appropriate technologies
- **Project Timeline**: Generates realistic milestone timelines
- **Architecture Diagram**: Creates Mermaid diagrams for system architecture
- **Cost Analysis**: Preliminary cost breakdowns
- **Resource Planning**: Team composition and experience requirements
- **KPIs & Metrics**: Defines measurable success indicators

### 3. **Professional Document Generation**
- **Output Format**: Microsoft Word (.docx)
- **Content Sections**:
  - Title Page with company branding
  - Executive Summary
  - Problem Statement (4-5 lines paragraph format)
  - Key Challenges (detailed paragraphs, 4-6 sentences each)
  - Our Solution Approach (5-7 sentence paragraphs per step)
  - Technical Stack with categorized technologies
  - Project Milestones with phases and durations
  - Architecture Diagram (mermaid or visual)
  - Objectives and Acceptance Criteria
  - Resources and Team Structure
  - Cost Analysis breakdown
  - Key Performance Indicators (KPIs)
  - Risk Mitigation strategies
  - Table of Contents (auto-generated)

### 4. **Interactive Preview & Editing**
- **Live Preview**: View generated proposal before downloading
- **Inline Editing**: Modify any section directly in the preview
- **Section Collapsible**: Expandable/collapsible sections for easy navigation
- **Search Navigation**: Jump to specific sections via chatbot

### 5. **Architecture Diagram Viewer** (Enhanced)
- **Zoom Controls**: 
  - Zoom in/out (+/- buttons, 25% increments)
  - Reset to 100%
  - Fit-to-width for responsive sizing
  - Live zoom percentage display
- **Interactive Features**:
  - Horizontal and vertical scrolling
  - Mermaid diagram rendering (inline SVG)
  - Fallback to mermaid.ink encoded images
  - Code view toggle (inspect diagram source)
- **Supported Diagram Types**:
  - Flowcharts
  - System architectures
  - Data flow diagrams

### 6. **Tender Management System**
- **Active Tenders Listing**: Browse available tenders with:
  - Organization name
  - Tender title and summary
  - Sector classification (color-coded badges)
  - Deadline tracking
  - Tender value (formatted in INR)
  - External links to original postings
  - Chat assistant for tender insights

- **Wishlist Feature**:
  - Save tenders for later reference
  - Add/remove from wishlist
  - Search saved tenders
  - Sort by: Date Added, Deadline, or Title
  - Bulk clear all wishlist items
  - Pagination support (20 items per page)

- **Sector Classification**:
  - Hospitality & Catering (orange)
  - Logistics & Supply Chain (green)
  - Transportation & Infrastructure (blue)
  - General/Other sectors (purple)

### 7. **RAG (Retrieval Augmented Generation)**
- **Knowledge Base**: AIonOS Knowledge Base integration
- **Semantic Search**: Pinecone vector database for intelligent retrieval
- **Context Enhancement**: Retrieved documents inform AI responses
- **Quality Improvement**: More accurate and contextual proposals

### 8. **SharePoint Integration** (Optional)
- **Auto-Sync**: Automatically syncs AIonOS Knowledge Base from SharePoint
- **Incremental Updates**: Only fetches new/modified documents (delta links)
- **Background Worker**: Scheduled sync task (configurable interval, default 60 minutes)
- **Fallback**: Works with or without SharePoint connection

### 9. **Solution Management**
- **Database Storage**: Solutions saved to SQLite database
- **Solution History**: Track and access previous proposals
- **Solution Objects**: Store title, date, all proposal components
- **Re-use & Versioning**: Build on previous solutions

### 10. **Tender Chatbot** 
- **Context-Aware**: Understands tender details
- **Real-time Assistance**: Answers questions about current tenders
- **Wishlist Integration**: Can reference saved items
- **Natural Language**: Uses LLM for conversational responses

---

## 📂 Project File Structure

```
AIProposal/
├── backend/
│   ├── main.py                      # FastAPI app, core RFP analysis engine
│   ├── database.py                  # SQLAlchemy ORM models & connection
│   ├── requirements.txt             # Python dependencies
│   ├── upload_routes.py             # File upload endpoints
│   ├── tenders_routes.py            # Tender management endpoints
│   ├── wishlist_routes.py           # Wishlist endpoints
│   ├── sharepoint_routes.py         # SharePoint integration endpoints
│   ├── scraper_service.py           # Web scraping for tender data
│   ├── sharepoint_pipeline.py       # SharePoint sync pipeline
│   ├── sharepoint_client.py         # SharePoint API client
│   ├── sharepoint_delta_link.json   # Delta link state tracking
│   ├── company_info.py              # Company branding info
│   ├── file_parsers.py              # PDF/DOCX parsing utilities
│   ├── test_*.py                    # Various test files
│   ├── generated_solutions/         # Output solutions folder
│   ├── uploads/                     # Uploaded files storage
│   └── __pycache__/                 # Python cache
│
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Main React app component
│   │   ├── App.css                  # App styling
│   │   ├── index.js                 # React entry point
│   │   ├── index.css                # Global Tailwind styles
│   │   ├── setupProxy.js            # Dev proxy configuration
│   │   ├── setupTests.js            # Test setup
│   │   ├── pages/
│   │   │   ├── Dashboard.js         # Main dashboard
│   │   │   ├── ActiveTenders.js     # Tender browsing page
│   │   │   ├── Wishlist.js          # Wishlist management
│   │   │   ├── Home.js              # Home page
│   │   │   ├── Login.js             # Authentication page
│   │   │   └── Contact.js           # Contact page
│   │   ├── components/
│   │   │   ├── PreviewCard.jsx      # Proposal preview & editor
│   │   │   ├── FileUploader.jsx     # File upload component
│   │   │   ├── ChatBox.jsx          # Solution chatbot
│   │   │   ├── TenderChatBox.jsx    # Tender chatbot
│   │   │   ├── ActionButtons.jsx    # Action button group
│   │   │   ├── GeneratedSolutions.jsx
│   │   │   ├── RFPProcessPopup.jsx
│   │   │   └── UploadSolutionModal.jsx
│   │   └── assets/                  # Images, icons
│   ├── public/
│   │   ├── index.html               # HTML template
│   │   ├── manifest.json            # PWA manifest
│   │   └── robots.txt               # SEO robots file
│   ├── package.json                 # Dependencies
│   ├── tailwind.config.js           # Tailwind configuration
│   ├── postcss.config.js            # PostCSS configuration
│   └── README.md                    # Frontend readme
│
├── README.md                        # Main project readme
├── LICENSE                          # Project license
├── RAG_Implementation_Details.md    # RAG documentation
├── AIonOS_knowledge_base.md         # Knowledge base info
└── setup_sharepoint.sh              # SharePoint setup script
```

---

## 🔌 API Endpoints

### **Core RFP Endpoints**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-solution` | Upload RFP file and generate solution |
| POST | `/api/generate-solution-text` | Generate solution from text input |
| POST | `/api/download-solution` | Download generated proposal as .docx |
| GET | `/api/health` | Health check |

### **Tender Management**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenders` | List all tenders (paginated) |
| GET | `/api/tenders/{tender_id}` | Get tender details |
| POST | `/api/tenders/search` | Search tenders by keyword |
| GET | `/api/tenders/sector/{sector}` | Filter by sector |

### **Wishlist**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishlists` | Get user's wishlist (paginated) |
| POST | `/api/wishlists` | Add tender to wishlist |
| DELETE | `/api/wishlists/{wishlist_id}` | Remove from wishlist |

### **SharePoint Integration**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sharepoint/sync` | Trigger manual sync |
| GET | `/api/sharepoint/status` | Get sync status |

### **Auto-Generated API Docs**
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 🚀 How to Use (Step-by-Step)

### **1. Upload RFP Document**
- Navigate to Dashboard
- Click "Upload RFP Document"
- Select PDF or Word file (max 10MB)
- Document auto-processes

### **2. Generate Solution**
- Click "Generate Solution" button
- Wait for AI analysis (LLM processes the RFP)
- System extracts challenges, proposes solutions, generates milestones

### **3. Review & Preview**
- Preview generates in real-time
- View all sections: Problem Statement, Challenges, Solutions, Architecture, etc.
- Expand/collapse sections for easier reading
- Zoom and scroll architecture diagram

### **4. Customize Proposal**
- Edit any section inline (if editable mode is enabled)
- Adjust text, add/remove items
- Modify technical stack recommendations
- Update cost analysis

### **5. Download Proposal**
- Click "Download" button
- Professional Word document (.docx) is generated
- Ready to send to clients or stakeholders

### **6. Manage Tenders (Optional)**
- Browse "Active Tenders" page
- View tender details: organization, deadline, value, sector
- Add tenders to Wishlist (click heart icon)
- Chat with Tender Assistant for insights
- Search and sort saved wishlist items

---

## 🔧 Configuration & Environment Variables

### **Backend (.env file)**
```env
# Required
GROQ_API_KEY=your_groq_api_key_here
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_pinecone_env
PINECONE_INDEX_NAME=your_index_name

# Optional
GROQ_MODEL=moonshotai/kimi-k2-instruct
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
MAX_FILE_SIZE_MB=10
LOG_LEVEL=INFO
AIONOS_COMPACT_OUTPUT=true

# SharePoint Integration (optional)
SHAREPOINT_AUTO_SYNC_ENABLED=true
SHAREPOINT_SYNC_INTERVAL_MINUTES=60
SHAREPOINT_INITIAL_SYNC_ON_START=true
```

### **Frontend (package.json proxy)**
```json
"proxy": "http://127.0.0.1:8000"
```

---

## 📊 Data Models

### **Solution Object**
```python
{
  "id": int,
  "title": str,
  "date": str,
  "problem_statement": str,
  "key_challenges": [str],  # List of 4-6 sentence paragraphs
  "solution_approach": [
    {
      "title": str,
      "description": str  # 5-7 sentence paragraphs
    }
  ],
  "technical_stack": [str],
  "milestones": [
    {
      "phase": str,
      "duration": str,
      "description": str
    }
  ],
  "objectives": [str],
  "acceptance_criteria": [str],
  "resources": [
    {
      "role": str,
      "count": int,
      "years_of_experience": int,
      "responsibilities": str
    }
  ],
  "cost_analysis": [
    {
      "item": str,
      "cost": str,
      "notes": str
    }
  ],
  "key_performance_indicators": [
    {
      "metric": str,
      "target": str,
      "measurement_method": str,
      "frequency": str
    }
  ],
  "architecture_diagram": str  # Mermaid code
}
```

### **Tender Object**
```python
{
  "id": int,
  "organization": str,
  "title": str,
  "summary": str,
  "sector": str,
  "deadline": datetime,
  "value": float,
  "url": str,
  "created_at": datetime
}
```

---

## 🎨 UI/UX Features

### **Responsive Design**
- Mobile-first approach with Tailwind CSS
- Works on desktop, tablet, and mobile devices
- Hamburger menu on small screens
- Flexible grid layouts

### **Color Scheme**
- **Primary**: Orange (#FF6B35) - Used for CTAs and highlights
- **Secondary**: Purple (#7C3AED) - Tender-related actions
- **Backgrounds**: Gray gradient palette
- **Sector Badges**: Color-coded (orange, green, blue, purple)

### **Interactive Elements**
- Hover effects and transitions
- Loading spinners and skeletons
- Toast notifications for success/error
- Modal dialogs for confirmations
- Collapsible sections for content organization

### **Accessibility**
- Semantic HTML structure
- Proper label associations
- ARIA labels for icon buttons
- Keyboard navigation support
- Color contrast compliance

---

## 🔐 Security Features

- **File Size Validation**: Max 10MB limit enforced
- **File Type Checking**: Only PDF and DOCX allowed
- **CORS Protection**: Configurable allowed origins
- **Temporary File Cleanup**: Automatic removal after processing
- **Input Sanitization**: Mermaid diagram code sanitization
- **Environment Variables**: Sensitive keys not hardcoded

---

## 📈 Performance Optimizations

- **Lazy Loading**: Components load on-demand
- **Mermaid Rendering**: Optimized diagram rendering with error handling
- **Pagination**: Tender and wishlist items paginated (20 per page)
- **Vector Search**: Pinecone for fast semantic retrieval
- **Caching**: Browser and server-side caching strategies

---

## 🐛 Recent Improvements (Current Session)

1. **Backend Prompt Enhancement**
   - Updated LLM prompts to request paragraph-level content
   - Key Challenges now require 4-6 sentence paragraphs
   - Solution Approach requires 5-7 sentence paragraphs
   - Fixed indentation errors in main.py

2. **Frontend UI Improvements**
   - Key Challenges render as paragraph cards (not bullet lists)
   - Architecture diagram zoom controls added
   - Fit-to-width button for responsive scaling
   - Horizontal scrolling with pan support
   - Code toggle to inspect mermaid diagrams
   - SVG scaling with zoom percentage display

3. **Component Structure**
   - PreviewCard.jsx enhanced with zoom state and wrapper ref
   - BASE_DIAGRAM_WIDTH constant (1200px) for scaling
   - useEffect hooks for zoom-dependent rendering

---

## 🚀 Deployment & Scaling

### **Local Development**
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
```

### **Production Deployment**
- Backend: Deploy on Heroku, AWS Lambda, or Docker container
- Frontend: Build with `npm run build`, serve via nginx or CDN
- Database: Configure SQLite or migrate to PostgreSQL
- Environment: Set all `.env` variables securely

---

## 📝 Future Enhancements

1. **Authentication & Authorization**
   - User registration and login
   - Role-based access control
   - Proposal ownership tracking

2. **Advanced Features**
   - Multiple AI models (OpenAI, Anthropic, etc.)
   - Custom proposal templates
   - Version history and comparison
   - Collaborative editing
   - CRM integration (Salesforce, HubSpot)
   - Email delivery

3. **Content Quality**
   - Fine-tuning LLM prompts
   - Custom knowledge base training
   - Industry-specific templates

4. **Infrastructure**
   - Kubernetes deployment
   - GraphQL API option
   - Real-time collaboration via WebSockets
   - Advanced analytics dashboard

---

## 📞 Support & Troubleshooting

### **Common Issues**
| Issue | Solution |
|-------|----------|
| "GROQ_API_KEY not found" | Add `.env` file in backend directory with valid API key |
| Pinecone connection error | Verify PINECONE_* env variables are correct |
| Frontend won't connect to backend | Check proxy setting in frontend/package.json, ensure backend is running on :8000 |
| Diagram not rendering | Inspect "Code" view, check mermaid syntax, verify network for mermaid.ink |
| File upload fails | Check file size (<10MB), format (.pdf or .docx), server disk space |

### **Debug Tips**
- **Frontend**: Open browser DevTools (F12) → Console for errors
- **Backend**: Check terminal logs, enable `LOG_LEVEL=DEBUG` in .env
- **API**: Visit `http://localhost:8000/docs` to test endpoints
- **Database**: Use SQLite browser to inspect database.db

---

## 📄 Additional Documentation

- **RAG Details**: See `RAG_Implementation_Details.md`
- **Knowledge Base**: See `AIonOS_knowledge_base.md`
- **SharePoint Setup**: Run `setup_sharepoint.sh`
- **Backend README**: See `backend/README.md`
- **Frontend README**: See `frontend/README.md`

---

## 👥 Contributors & License

**Repository**: EegaKrishnaAIonOS/AIProposal  
**License**: See LICENSE file  
**Branch**: version2

---

## ✅ Summary

**AIProposal** is a comprehensive, production-ready RFP solution generator that combines cutting-edge AI (Groq LLM), semantic search (Pinecone), and professional document generation to streamline proposal writing. With enhanced features for tender management, interactive editing, and architectural diagramming, it provides a complete workflow for businesses to quickly respond to RFPs with high-quality, customized proposals.

