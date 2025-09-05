from fastapi import FastAPI,File,UploadFile,HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List,Optional
import os,json,tempfile,shutil
from datetime import datetime
import asyncio
from groq import Groq
from dotenv import load_dotenv
import PyPDF2
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.shared import OxmlElement, qn

app = FastAPI(title="RFP Solution Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

groq_client = Groq(api_key=GROQ_API_KEY)

class SolutionStep(BaseModel):
    title:str
    description:str

class MileStone(BaseModel):
    phase:str
    duration:str
    description:str

class GeneratedSolution(BaseModel):
    title: str
    date: str
    problem_statement: str
    key_challenges: List[str]
    solution_approach: List[SolutionStep]
    milestones: List[MileStone]
    technical_stack: List[str]
    objectives: List[str]
    acceptance_criteria: List[str]

# Document extraction functions
def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {str(e)}")
    return text

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from Word document"""
    text = ""
    try:
        doc = Document(file_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Word document: {str(e)}")
    return text

def extract_text_from_doc(file_path: str) -> str:
    """Extract text from old Word document (.doc)"""
    # For .doc files, you might need python-docx2txt or other libraries
    # For now, we'll return an error message
    raise HTTPException(status_code=400, detail="Legacy .doc format not supported. Please convert to .docx")

# LLM Processing
async def analyze_rfp_with_groq(rfp_text: str) -> GeneratedSolution:
    """Analyze RFP text using Groq and generate solution"""
    
    prompt = f"""
    You are an expert technical consultant specializing in creating detailed technical proposals for RFPs. 
    
    Based on the following RFP document, generate a comprehensive technical proposal that follows this structure:
    
    1. **Title**: Create a descriptive title for the solution
    2. **Problem Statement**: Summarize the core problem from the RFP
    3. **Key Challenges**: Identify 3-5 main technical/business challenges
    4. **Solution Approach**: Break down into 4-6 detailed steps with titles and descriptions
    5. **Milestones**: Create 5-8 project phases with duration and description
    6. **Technical Stack**: List relevant technologies, frameworks, and tools
    7. **Objectives**: List key project objectives
    8. **Acceptance Criteria**: Define measurable success criteria
    
    Make the response professional, technical, and similar in style to enterprise consulting proposals.
    
    RFP Content:
    {rfp_text[:8000]}  # Limit text to avoid token limits
    
    Please respond in JSON format with the following structure:
    {{
        "title": "Solution title",
        "date": "{datetime.now().strftime('%B %Y')}",
        "problem_statement": "Problem description",
        "key_challenges": ["challenge1", "challenge2", ...],
        "solution_approach": [
            {{"title": "Step 1: Title", "description": "Detailed description"}},
            ...
        ],
        "milestones": [
            {{"phase": "Phase Name", "duration": "X weeks", "description": "Phase description"}},
            ...
        ],
        "technical_stack": ["Technology1", "Technology2", ...],
        "objectives": ["Objective1", "Objective2", ...],
        "acceptance_criteria": ["Criteria1", "Criteria2", ...]
    }}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Using Llama 3 model
            messages=[
                {"role": "system", "content": "You are a technical proposal expert. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000
        )
        
        response_text = response.choices[0].message.content
        
        # Try to extract JSON from response
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            raise ValueError("No JSON found in response")
        
        json_str = response_text[json_start:json_end]
        solution_data = json.loads(json_str)
        
        return GeneratedSolution(**solution_data)
        
    except Exception as e:
        print(f"Error with Groq API: {str(e)}")
        # Fallback solution
        return GeneratedSolution(
            title="Technical Solution Proposal",
            date=datetime.now().strftime('%B %Y'),
            problem_statement="Based on the RFP requirements, we need to develop a comprehensive technical solution.",
            key_challenges=[
                "Integration complexity with existing systems",
                "Scalability and performance requirements",
                "Data security and compliance",
                "User adoption and training"
            ],
            solution_approach=[
                {
                    "title": "Step 1: Requirements Analysis & Architecture Design",
                    "description": "Comprehensive analysis of requirements and design of solution architecture"
                },
                {
                    "title": "Step 2: Technology Stack Selection & Setup",
                    "description": "Selection and configuration of appropriate technologies and frameworks"
                },
                {
                    "title": "Step 3: Development & Implementation",
                    "description": "Agile development approach with iterative implementation"
                },
                {
                    "title": "Step 4: Testing & Quality Assurance",
                    "description": "Comprehensive testing strategy including unit, integration, and user acceptance testing"
                },
                {
                    "title": "Step 5: Deployment & Go-Live",
                    "description": "Production deployment with monitoring and support setup"
                }
            ],
            milestones=[
                {"phase": "Planning & Design", "duration": "2 weeks", "description": "Requirements analysis and solution design"},
                {"phase": "Development Phase 1", "duration": "4 weeks", "description": "Core functionality development"},
                {"phase": "Development Phase 2", "duration": "4 weeks", "description": "Advanced features and integrations"},
                {"phase": "Testing & QA", "duration": "2 weeks", "description": "Comprehensive testing and bug fixes"},
                {"phase": "Deployment & Launch", "duration": "1 week", "description": "Production deployment and go-live"},
                {"phase": "Support & Maintenance", "duration": "Ongoing", "description": "Post-launch support and maintenance"}
            ],
            technical_stack=["Python", "React", "FastAPI", "PostgreSQL", "Docker", "AWS"],
            objectives=[
                "Deliver a scalable and robust technical solution",
                "Ensure seamless integration with existing systems",
                "Provide comprehensive documentation and training",
                "Achieve high user adoption and satisfaction"
            ],
            acceptance_criteria=[
                "System meets all functional requirements",
                "Performance benchmarks achieved",
                "Security compliance verified",
                "User acceptance testing completed successfully"
            ]
        )
# Document generation functions
def create_word_document(solution: GeneratedSolution) -> str:
    """Create a Word document from the generated solution"""
    doc = Document()
    
    # Set document title
    title = doc.add_heading(solution.title, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add date
    date_p = doc.add_paragraph(solution.date)
    date_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_page_break()
    
    # Table of Contents placeholder
    doc.add_heading('Contents', level=1)
    toc_items = [
        '01 Problem Statement',
        '02 Key Challenges', 
        '03 Our Solution Approach',
        '04 Technical Implementation',
        '05 Project Milestones',
        '06 Technical Stack',
        '07 Objectives & Success Criteria'
    ]
    
    for i, item in enumerate(toc_items, 1):
        p = doc.add_paragraph()
        p.add_run(f'{i:02d} ').bold = True
        p.add_run(item[3:])  # Remove the number prefix
    
    doc.add_page_break()
    
    # Problem Statement
    doc.add_heading('Problem Statement', level=1)
    doc.add_paragraph(solution.problem_statement)
    
    # Key Challenges
    doc.add_heading('Key Challenges', level=1)
    for challenge in solution.key_challenges:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(challenge)
    
    # Solution Approach
    doc.add_heading('Our Solution Approach', level=1)
    for i, step in enumerate(solution.solution_approach, 1):
        doc.add_heading(f'{step.title}', level=2)
        doc.add_paragraph(step.description)
    
    # Technical Stack
    doc.add_heading('Technical Stack', level=1)
    for tech in solution.technical_stack:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(tech)
    
    # Milestones
    doc.add_heading('Key Milestones', level=1)
    
    # Create table for milestones
    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = 'Phase'
    hdr_cells[1].text = 'Duration'
    hdr_cells[2].text = 'Description'
    
    # Make header row bold
    for cell in hdr_cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.bold = True
    
    for milestone in solution.milestones:
        row_cells = table.add_row().cells
        row_cells[0].text = milestone.phase
        row_cells[1].text = milestone.duration
        row_cells[2].text = milestone.description
    
    # Objectives
    doc.add_heading('Objectives', level=1)
    for objective in solution.objectives:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(objective)
    
    # Acceptance Criteria
    doc.add_heading('Acceptance Criteria', level=1)
    for criteria in solution.acceptance_criteria:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(criteria)
    
    # Save document
    temp_dir = tempfile.gettempdir()
    doc_path = os.path.join(temp_dir, f'technical_proposal_{datetime.now().strftime("%Y%m%d_%H%M%S")}.docx')
    doc.save(doc_path)
    
    return doc_path

# API Endpoints
@app.post("/api/generate-solution", response_model=GeneratedSolution)
async def generate_solution(file: UploadFile = File(...)):
    """Generate solution from uploaded RFP document"""
    
    # Validate file type
    allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    # Create temporary file
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, file.filename)
    
    try:
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract text based on file type
        if file.content_type == 'application/pdf':
            rfp_text = extract_text_from_pdf(temp_file_path)
        elif file.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            rfp_text = extract_text_from_docx(temp_file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        if not rfp_text.strip():
            raise HTTPException(status_code=400, detail="No text content found in the document")
        
        # Generate solution using Groq
        solution = await analyze_rfp_with_groq(rfp_text)
        
        return solution
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
    finally:
        # Cleanup temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/api/download-solution")
async def download_solution(solution: GeneratedSolution):
    """Download generated solution as Word document"""
    
    try:
        # Create Word document
        doc_path = create_word_document(solution)
        
        # Return file response
        return FileResponse(
            doc_path,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            filename='technical_proposal.docx',
            headers={"Content-Disposition": "attachment; filename=technical_proposal.docx"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating document: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)