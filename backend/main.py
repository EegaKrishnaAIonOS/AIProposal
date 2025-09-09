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
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml.shared import OxmlElement, qn

app = FastAPI(title="RFP Solution Generator")

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

# New: environment-driven configuration
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins = ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

groq_client = Groq(api_key=GROQ_API_KEY)

class SolutionStep(BaseModel):
    title:str
    description:str

class Milestone(BaseModel):
    phase:str
    duration:str
    description:str

class ResourceItem(BaseModel):
    role: str
    count: int
    years_of_experience: Optional[int] = None
    responsibilities: Optional[str] = None

class CostItem(BaseModel):
    item: str
    cost: str
    notes: Optional[str] = None

class GeneratedSolution(BaseModel):
    title: str
    date: str
    problem_statement: str
    key_challenges: List[str]
    solution_approach: List[SolutionStep]
    milestones: List[Milestone]
    technical_stack: List[str]
    objectives: List[str]
    acceptance_criteria: List[str]
    resources: List[ResourceItem]
    cost_analysis: List[CostItem]

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

# Legacy .doc is intentionally not supported per requirements

def _get_logo_path() -> str:
    """Resolve absolute path to AIONOS_logo.png at project root."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_dir)
    logo_path = os.path.join(project_root, 'AIONOS_logo.png')
    return logo_path

# Utility: add Page X of Y footer using field codes

def _add_page_number_footer(doc: Document) -> None:
    section = doc.sections[0]
    footer = section.footer
    paragraph = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Helper to append a field
    def _add_field(run, fld_char_type):
        fld = OxmlElement('w:fldChar')
        fld.set(qn('w:fldCharType'), fld_char_type)
        run._r.append(fld)

    # Build: "Page " + PAGE + " of " + NUMPAGES
    r1 = paragraph.add_run("Page ")

    r_page_begin = paragraph.add_run()
    _add_field(r_page_begin, 'begin')
    instr_page = OxmlElement('w:instrText')
    instr_page.set(qn('xml:space'), 'preserve')
    instr_page.text = ' PAGE '
    r_page_begin._r.append(instr_page)
    r_page_sep = paragraph.add_run()
    _add_field(r_page_sep, 'separate')
    r_page_text = paragraph.add_run()
    _add_field(r_page_text, 'end')

    r2 = paragraph.add_run(" of ")

    r_nump_begin = paragraph.add_run()
    _add_field(r_nump_begin, 'begin')
    instr_nump = OxmlElement('w:instrText')
    instr_nump.set(qn('xml:space'), 'preserve')
    instr_nump.text = ' NUMPAGES '
    r_nump_begin._r.append(instr_nump)
    r_nump_sep = paragraph.add_run()
    _add_field(r_nump_sep, 'separate')
    r_nump_text = paragraph.add_run()
    _add_field(r_nump_text, 'end')

# Utility: add a bookmark to a heading paragraph and add PAGEREF fields

def _add_bookmark(paragraph, name: str, bm_id: int) -> int:
    start = OxmlElement('w:bookmarkStart')
    start.set(qn('w:id'), str(bm_id))
    start.set(qn('w:name'), name)
    end = OxmlElement('w:bookmarkEnd')
    end.set(qn('w:id'), str(bm_id))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)
    return bm_id + 1


def _add_pageref_to_cell(cell, bookmark_name: str) -> None:
    p = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    def _add_field(run, fld_char_type):
        fld = OxmlElement('w:fldChar')
        fld.set(qn('w:fldCharType'), fld_char_type)
        run._r.append(fld)
    r_begin = p.add_run()
    _add_field(r_begin, 'begin')
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = f' PAGEREF {bookmark_name} '
    r_begin._r.append(instr)
    r_sep = p.add_run()
    _add_field(r_sep, 'separate')
    r_end = p.add_run()
    _add_field(r_end, 'end')

# Utility: add a leadered index line: "NN Title ......... <PAGEREF>"
# (kept for reference but not used — we now insert a TOC field)

def _add_index_line(doc: Document, number_str: str, title: str, bookmark_name: str) -> None:
    p = doc.add_paragraph()
    p.style = doc.styles['Normal']
    tabstops = p.paragraph_format.tab_stops
    tabstops.add_tab_stop(Inches(6.0), alignment=WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
    run_left = p.add_run(f"{number_str} {title}\t")
    def _add_field(run, fld_char_type):
        fld = OxmlElement('w:fldChar')
        fld.set(qn('w:fldCharType'), fld_char_type)
        run._r.append(fld)
    r_begin = p.add_run()
    _add_field(r_begin, 'begin')
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = f' PAGEREF {bookmark_name} '
    r_begin._r.append(instr)
    r_sep = p.add_run()
    _add_field(r_sep, 'separate')
    r_end = p.add_run()
    _add_field(r_end, 'end')

# Insert a Table of Contents field (Heading levels 1 only)

def _insert_toc(doc: Document) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # Create field characters within runs (valid WordprocessingML)
    def fld_char(char_type: str):
        el = OxmlElement('w:fldChar')
        el.set(qn('w:fldCharType'), char_type)
        return el
    def instr_text(text: str):
        el = OxmlElement('w:instrText')
        el.set(qn('xml:space'), 'preserve')
        el.text = text
        return el
    r1 = p.add_run(); r1._r.append(fld_char('begin'))
    r2 = p.add_run(); r2._r.append(instr_text(' TOC \\o "1-1" \\h \\z \\u '))
    r3 = p.add_run(); r3._r.append(fld_char('separate'))
    r4 = p.add_run(); r4._r.append(fld_char('end'))

# LLM Processing
async def analyze_rfp_with_groq(rfp_text: str) -> GeneratedSolution:
    """Analyze RFP text using Groq and generate solution"""
    
    prompt = f"""
    You are an expert technical consultant specializing in creating detailed technical proposals for RFPs. 
    
    Based on the following RFP document, generate a comprehensive technical proposal that follows this structure:
    
    1. Title
    2. Problem Statement
    3. Key Challenges (3-5 items)
    4. Solution Approach (4-6 steps with title and description for each)
    5. Milestones (5-8 phases with duration and description)
    6. Technical Stack
    7. Objectives
    8. Acceptance Criteria
    9. Resources (list of roles with counts, years_of_experience, responsibilities)
    10. Cost Analysis (INR currency; list of cost items with cost and optional notes)
    
    Respond ONLY with a single fenced JSON block using triple backticks and the json language tag. No prose before or after.
    
    RFP Content:
    {rfp_text[:8000]}
    
    The JSON structure must be exactly:
    {{
        "title": "Solution title",
        "date": "{datetime.now().strftime('%B %Y')}",
        "problem_statement": "Problem description",
        "key_challenges": ["challenge1", "challenge2"],
        "solution_approach": [
            {{"title": "Step 1: Title", "description": "Detailed description"}}
        ],
        "milestones": [
            {{"phase": "Phase Name", "duration": "X weeks", "description": "Phase description"}}
        ],
        "technical_stack": ["Technology1", "Technology2"],
        "objectives": ["Objective1", "Objective2"],
        "acceptance_criteria": ["Criteria1", "Criteria2"],
        "resources": [
            {{"role": "Role Name", "count": 3, "years_of_experience": 5, "responsibilities": "Key responsibilities"}}
        ],
        "cost_analysis": [
            {{"item": "Item name", "cost": "₹750,000", "notes": "Optional note"}}
        ]
    }}
    """
    
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a technical proposal expert. Always respond with valid JSON inside a fenced ```json block."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000
        )
        
        response_text = response.choices[0].message.content or ""
        
        # Robust fenced JSON extraction
        json_start = response_text.find("```json")
        json_end = response_text.rfind("```")
        if json_start != -1 and json_end != -1 and json_end > json_start:
            json_str = response_text[json_start + len("```json"):json_end].strip()
        else:
            # Fallback: try to slice from first { to last }
            brace_start = response_text.find('{')
            brace_end = response_text.rfind('}')
            if brace_start == -1 or brace_end == -1:
                raise ValueError("No JSON found in response")
            json_str = response_text[brace_start:brace_end+1]
        
        solution_data = json.loads(json_str)
        return GeneratedSolution(**solution_data)
        
    except Exception as e:
        print(f"Error with Groq API: {str(e)}")
        # Fallback solution (INR costs; includes years_of_experience)
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
            ],
            resources=[
                {"role": "Project Manager", "count": 1, "years_of_experience": 10, "responsibilities": "Project governance and stakeholder communication"},
                {"role": "Solution Architect", "count": 1, "years_of_experience": 8, "responsibilities": "Architecture and design oversight"},
                {"role": "Backend Engineer", "count": 2, "years_of_experience": 5, "responsibilities": "API and data layer development"},
                {"role": "Frontend Engineer", "count": 2, "years_of_experience": 4, "responsibilities": "UI implementation and integrations"}
            ],
            cost_analysis=[
                {"item": "Discovery & Design", "cost": "₹650,000", "notes": "Requirements and architecture"},
                {"item": "Implementation", "cost": "₹2,900,000", "notes": "Core features and integrations"},
                {"item": "Testing & QA", "cost": "₹580,000", "notes": "Automated and UAT"},
                {"item": "Deployment & Training", "cost": "₹420,000", "notes": "Go-live and enablement"}
            ]
        )
# Document generation functions
def create_word_document(solution: GeneratedSolution) -> str:
    """Create a Word document from the generated solution"""
    doc = Document()

    # Make fields update on open
    try:
        settings = doc.settings
        update_fields = OxmlElement('w:updateFields')
        update_fields.set(qn('w:val'), 'true')
        settings.element.append(update_fields)
    except Exception:
        pass

    # Add page numbers in footer: Page X of Y
    try:
        _add_page_number_footer(doc)
    except Exception:
        pass

    # Cover
    logo_path = _get_logo_path()
    if os.path.exists(logo_path):
        try:
            picture = doc.add_picture(logo_path, width=Inches(2.5))
            last_paragraph = doc.paragraphs[-1]
            last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        except Exception:
            pass
    title = doc.add_heading(solution.title, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_p = doc.add_paragraph(solution.date)
    date_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Contents (Word TOC)
    doc.add_page_break()
    doc.add_heading('Contents', level=1)
    _insert_toc(doc)

    # Content sections
    doc.add_page_break()
    bookmark_id = 1

    h = doc.add_heading('Problem Statement', level=1)
    bookmark_id = _add_bookmark(h, 'sec_problem_statement', bookmark_id)
    doc.add_paragraph(solution.problem_statement)

    h = doc.add_heading('Key Challenges', level=1)
    bookmark_id = _add_bookmark(h, 'sec_key_challenges', bookmark_id)
    for challenge in solution.key_challenges:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(challenge)

    h = doc.add_heading('Our Solution Approach', level=1)
    bookmark_id = _add_bookmark(h, 'sec_solution_approach', bookmark_id)
    for i, step in enumerate(solution.solution_approach, 1):
        doc.add_heading(f'{step.title}', level=2)
        doc.add_paragraph(step.description)

    h = doc.add_heading('Technical Stack', level=1)
    bookmark_id = _add_bookmark(h, 'sec_technical_stack', bookmark_id)
    for tech in solution.technical_stack:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(tech)

    h = doc.add_heading('Key Milestones', level=1)
    bookmark_id = _add_bookmark(h, 'sec_key_milestones', bookmark_id)
    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = 'Phase'
    hdr_cells[1].text = 'Duration'
    hdr_cells[2].text = 'Description'
    for cell in hdr_cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.bold = True
    for milestone in solution.milestones:
        row_cells = table.add_row().cells
        row_cells[0].text = milestone.phase
        row_cells[1].text = milestone.duration
        row_cells[2].text = milestone.description

    h = doc.add_heading('Objectives', level=1)
    bookmark_id = _add_bookmark(h, 'sec_objectives', bookmark_id)
    for objective in solution.objectives:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(objective)

    h = doc.add_heading('Acceptance Criteria', level=1)
    bookmark_id = _add_bookmark(h, 'sec_acceptance_criteria', bookmark_id)
    for criteria in solution.acceptance_criteria:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(criteria)

    h = doc.add_heading('Resources', level=1)
    bookmark_id = _add_bookmark(h, 'sec_resources', bookmark_id)
    r_table = doc.add_table(rows=1, cols=4)
    r_table.style = 'Table Grid'
    r_hdr = r_table.rows[0].cells
    r_hdr[0].text = 'Role'
    r_hdr[1].text = 'Count'
    r_hdr[2].text = 'Years of Experience'
    r_hdr[3].text = 'Responsibilities'
    for cell in r_hdr:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.bold = True
    for res in solution.resources:
        row = r_table.add_row().cells
        row[0].text = res.role
        row[1].text = str(res.count)
        row[2].text = str(res.years_of_experience or '')
        row[3].text = res.responsibilities or ""

    h = doc.add_heading('Cost Analysis', level=1)
    bookmark_id = _add_bookmark(h, 'sec_cost_analysis', bookmark_id)
    c_table = doc.add_table(rows=1, cols=3)
    c_table.style = 'Table Grid'
    c_hdr = c_table.rows[0].cells
    c_hdr[0].text = 'Item'
    c_hdr[1].text = 'Cost (INR)'
    c_hdr[2].text = 'Notes'
    for cell in c_hdr:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.bold = True
    for ci in solution.cost_analysis:
        row = c_table.add_row().cells
        row[0].text = ci.item
        row[1].text = ci.cost
        row[2].text = ci.notes or ""

    temp_dir = tempfile.gettempdir()
    doc_path = os.path.join(temp_dir, f'technical_proposal_{datetime.now().strftime("%Y%m%d_%H%M%S")}.docx')
    doc.save(doc_path)
    return doc_path

# API Endpoints
@app.post("/api/generate-solution", response_model=GeneratedSolution)
async def generate_solution(file: UploadFile = File(...)):
    """Generate solution from uploaded RFP document"""
    
    # Validate file type (PDF and DOCX only)
    allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}. Only PDF and DOCX are supported.")
    
    # Create temporary file
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, file.filename)
    
    try:
        # Save uploaded file while enforcing size limit
        with open(temp_file_path, "wb") as buffer:
            total_written = 0
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_written += len(chunk)
                if total_written > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(status_code=400, detail=f"File too large. Max size is {MAX_FILE_SIZE_MB}MB.")
                buffer.write(chunk)
        await file.close()

        # Double-check file size on disk
        if os.path.getsize(temp_file_path) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
        # Extract text based on file type
        if file.content_type == 'application/pdf':
            rfp_text = extract_text_from_pdf(temp_file_path)
        elif file.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            rfp_text = extract_text_from_docx(temp_file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
        
        if not rfp_text.strip():
            raise HTTPException(status_code=400, detail="No text content found in the document")
        
        # Generate solution using Groq
        solution = await analyze_rfp_with_groq(rfp_text)
        
        return solution
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
    finally:
        # Cleanup temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass

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

@app.get("/api/logo")
async def get_company_logo():
    """Serve the company logo image for frontend preview."""
    logo_path = _get_logo_path()
    if not os.path.exists(logo_path):
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(logo_path, media_type='image/png', filename='AIONOS_logo.png')

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)