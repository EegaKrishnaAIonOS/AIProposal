# 📄 RFP Solution Generator

A professional application that automatically generates technical proposals from RFP documents using AI.

---

## 🏗️ Architecture Overview

- **Frontend**: React with Tailwind CSS (Professional UI)
- **Backend**: FastAPI (Python)
- **AI Processing**: Groq Cloud (Llama 3 model)
- **Document Processing**: PyPDF2, python-docx
- **File Generation**: Word documents (.docx)

---

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- Groq API key

---

## 🚀 Quick Start

### 1️⃣ Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate   # On Windows
# source venv/bin/activate   # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo GROQ_API_KEY=your_groq_api_key_here > .env
```

### 2️⃣ Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
### 3️⃣ Configuration Files
Backend Structure
```bash
backend/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables
└── temp/                # Temporary files (auto-created)
```
Frontend Structure
```bash
frontend/
├── src/
│   ├── App.js           # Main React component
│   ├── index.css        # Tailwind imports
│   └── index.js         # React entry point
├── package.json         # Node dependencies
├── tailwind.config.js   # Tailwind configuration
└── postcss.config.js    # PostCSS configuration
```
### 4️⃣ Add Tailwind to CSS

frontend/src/index.css
```bash
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 5️⃣ Running the Application

Start Backend
```bash
cd backend
venv\Scripts\activate   # On Windows
# source venv/bin/activate   # On macOS/Linux
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Start Frontend
```bash
cd frontend
npm start
```
🔗 The application will be available at:

Frontend → http://localhost:3000
Backend API → http://localhost:8000
API Docs → http://localhost:8000/docs

🎯 How to Use

Upload RFP Document → Upload a PDF or Word document.
Generate Solution → Process with AI to generate the solution.
Review Preview → Preview the generated proposal.
Download Proposal → Download as a Word document.
Customize → Edit the downloaded document before sending to clients.

📁 File Support

PDF → .pdf (up to 10MB)
Word → .docx (up to 10MB)
Output → Microsoft Word .docx

🔧 Key Features
✅ Professional UI

Clean, corporate design
Responsive layout
Real-time status updates
Professional color scheme

🤖 AI-Powered Analysis

Extract problem statements
Identify key challenges
Generate solution approaches
Recommend technical stacks
Propose project milestones

📄 Document Generation

Ready-to-send Word format
Table of contents
Structured proposal sections
Professional formatting

🛠️ Customization Options

Modify AI Prompt → Update analyze_rfp_with_groq() in backend/main.py.
Change Document Template → Edit create_word_document() in backend/main.py.
Update UI Styling → Modify React + Tailwind components.

📊 API Endpoints

POST /api/generate-solution → Upload RFP and generate solution
POST /api/download-solution → Download generated proposal
GET /api/health → Health check

🔒 Security Considerations

File size limit (10MB)
File type validation
Temporary file cleanup
CORS configuration
Input sanitization

🚀 Deployment

Set environment variables
Use gunicorn for backend
Build React app (npm run build)
Configure nginx as reverse proxy
Enable SSL certificates

📞 Support

Check browser console (frontend errors)
Check FastAPI logs (backend errors)
Verify Groq API key in .env
Reinstall dependencies if needed

🔄 Future Enhancements

Support more file formats
Multiple AI models
Custom proposal templates
User authentication
Proposal versioning
CRM integration
