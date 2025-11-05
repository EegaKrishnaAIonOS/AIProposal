# RAG Implementation Details - AI Proposal Generator

## Overview
This document provides a comprehensive description of the **Retrieval-Augmented Generation (RAG)** system implemented in the AI Proposal Generator application. The system uses a hybrid approach combining vector search with LLM-based generation to create contextually relevant technical proposals from RFP documents or problem statements.

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  - File Upload Component                                         │
│  - Generation Method Selection (LLM Only vs RAG)                │
│  - Real-time Preview                                             │
│  - Product Recommendations Display                               │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP POST /api/generate-solution
                     │ HTTP POST /api/generate-solution-text
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Document Processing Layer                                │  │
│  │  - PDF/DOCX Extraction                                    │  │
│  │  - Text Chunking (RecursiveCharacterTextSplitter)        │  │
│  └──────────┬────────────────────────────────────────────────┘  │
│             │                                                    │
│             ▼                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  RAG Pipeline                                             │  │
│  │                                                           │  │
│  │  Step 1: Document Ingestion                              │  │
│  │  ├─ Text Chunking (1000 chars, 100 overlap)             │  │
│  │  ├─ Embedding Generation (HuggingFace)                  │  │
│  │  └─ Vector Storage (Pinecone)                           │  │
│  │                                                           │  │
│  │  Step 2: Query Processing                                │  │
│  │  ├─ Input: RFP Text or Problem Statement                │  │
│  │  ├─ Embedding Generation                                 │  │
│  │  ├─ Similarity Search (k=5 top chunks)                  │  │
│  │  └─ Context Retrieval                                    │  │
│  │                                                           │  │
│  │  Step 3: LLM Generation                                  │  │
│  │  ├─ Prompt Engineering with Context                     │  │
│  │  ├─ Groq API (llama-3.1-8b-instant)                    │  │
│  │  └─ Structured JSON Response                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│            Vector Database (Pinecone)                            │
│  - Index Name: From Environment Variables                       │
│  - Dimension: 384 (all-MiniLM-L6-v2)                           │
│  - Metric: Cosine Similarity                                    │
│  - Storage: AWS Serverless                                      │
│  - Embedding Model: HuggingFace all-MiniLM-L6-v2               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Implementation

### 1. User Interface Components

#### **File Upload Component** (`FileUploader.jsx`)
- **Purpose**: Handles file uploads for PDF and DOCX documents
- **Features**:
  - Drag-and-drop interface
  - File validation (type and size)
  - Visual feedback for upload status
  - File preview

#### **Generation Method Selection** (`App.js`)
- **Location**: Lines 313-341 in `App.js`
- **Purpose**: Allows users to choose between RAG and LLM-only generation
- **Implementation**:
  ```javascript
  const [generationMethod, setGenerationMethod] = useState('knowledgeBase');
  
  // Checkbox inputs for method selection
  <input
    type="checkbox"
    checked={generationMethod === "knowledgeBase"}
    onChange={() => setGenerationMethod("knowledgeBase")}
  />
  <label>Generate using Knowledge Base (RAG)</label>
  ```

#### **Preview Card Component** (`PreviewCard.jsx`)
- **Purpose**: Displays generated solutions with sections
- **Features**:
  - Collapsible sections (Problem Statement, Key Challenges, Solution Approach, etc.)
  - Edit mode for manual corrections
  - Architecture diagram rendering
  - Section navigation for chatbot integration

### 2. API Integration

#### **Generate Solution Endpoint** (`App.js`, Lines 48-134)
```javascript
const generateSolution = async () => {
  // Prepare FormData
  const formData = new FormData();
  formData.append('file', file);
  formData.append('method', generationMethod); // Pass generation method
  
  // Call backend API
  const response = await fetch('/api/generate-solution', {
    method: 'POST',
    body: formData
  });
  
  // Handle response
  const data = await response.json();
  setSolution(data.solution);
  setRecommendations(data.recommendations);
}
```

**Key Features**:
- Supports both file upload and text input
- Passes generation method to backend
- Handles product recommendations
- Saves generated solution to database
- Error handling and loading states

---

## Backend Implementation

### 1. Document Ingestion Pipeline (`upload_routes.py`)

#### **Endpoint**: `POST /api/upload-solution`
- **Purpose**: Upload historical solutions to build knowledge base
- **Location**: Lines 59-134 in `upload_routes.py`

**Processing Steps**:

1. **File Reception**:
   ```python
   file = await upload_solution(file: UploadFile)
   # Save file to uploads/ directory
   ```

2. **Text Extraction**:
   ```python
   if file_extension == ".docx":
       doc = docx.Document(dest_path)
       for paragraph in doc.paragraphs:
           file_content += paragraph.text + "\n"
   elif file_extension == ".pdf":
       loader = PyPDFLoader(dest_path)
       docs = loader.load_and_split(text_splitter)
   ```

3. **Chunking**:
   ```python
   from langchain.text_splitter import RecursiveCharacterTextSplitter
   
   text_splitter = RecursiveCharacterTextSplitter(
       chunk_size=1000,  # Characters per chunk
       chunk_overlap=100  # Overlapping characters for context
   )
   docs = text_splitter.create_documents([file_content])
   ```

4. **Embedding & Storage**:
   ```python
   # Generate embeddings
   embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
   
   vectors = []
   for doc in docs:
       doc_id = str(uuid.uuid4())
       embedding = embedding_model.embed_documents([doc.page_content])[0]
       metadata = {
           "filename": filename,
           "user_id": user_id,
           "text": doc.page_content
       }
       vectors.append((doc_id, embedding, metadata))
   
   # Upload to Pinecone
   INDEX.upsert(vectors)
   ```

### 2. Vector Store Configuration (`main.py`)

#### **Pinecone Setup** (Lines 76-96):
```python
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings

# Environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

# Embedding model
EMBEDDING_MODEL = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)
VECTOR_STORE = PineconeVectorStore(
    index_name=PINECONE_INDEX_NAME,
    embedding=EMBEDDING_MODEL
)
```

**Configuration Details**:
- **Embedding Model**: `all-MiniLM-L6-v2` (HuggingFace)
  - Dimension: 384
  - Fast, lightweight, production-ready
- **Vector Store**: Pinecone (Serverless on AWS)
  - Index auto-created if not exists
  - Cosine similarity for relevance matching

### 3. RAG Retrieval (`main.py`)

#### **Core Function**: `analyze_rfp_with_groq()` (Lines 483-614)

**Parameters**:
- `rfp_text`: Input problem statement or RFP content
- `use_rag`: Boolean flag to enable/disable RAG

**Step-by-Step Process**:

##### **Step 1: Similarity Search** (Lines 487-493)
```python
retrieved_docs = []
if use_rag:
    try:
        # Search for top 5 most relevant chunks
        retrieved_docs = VECTOR_STORE.similarity_search(rfp_text, k=5)
    except Exception as e:
        safe_print(f"Error retrieving from vector store: {str(e)}")
        retrieved_docs = []
```

**What Happens**:
1. Query text is embedded using `HuggingFaceEmbeddings`
2. Vector search finds k=5 most similar chunks
3. Results include metadata (filename, user_id, text)

##### **Step 2: Context Building** (Lines 495-504)
```python
# Debug: Print retrieved chunks
safe_print("--- Retrieved Chunks for Validation ---")
for i, doc in enumerate(retrieved_docs):
    safe_print(f"Chunk {i+1}:")
    safe_print(doc.page_content)
    safe_print(f"Source file: {doc.metadata.get('filename', 'N/A')}")
    safe_print("-" * 50)

# Combine into context
context_text = "\n\n".join([doc.page_content for doc in retrieved_docs]) 
    if retrieved_docs else "No relevant references found."
```

**Purpose**: 
- Validates retrieval quality
- Logs source documents
- Prepares context for LLM prompt

##### **Step 3: Prompt Engineering** (Lines 506-567)
```python
prompt = f"""
You are an expert technical consultant specializing in creating detailed 
technical proposals for RFPs. Try to identify the field/domain of the RFP 
and tailor the solution accordingly. 
While drafting the solution, ensure to incorporate the domain knowledge, 
and include proper jargon.

Use the uploaded reference solutions (if relevant) as inspiration, but 
adapt to the new RFP.

Based on the following RFP document, generate a comprehensive technical 
proposal...

RFP Content:
{rfp_text[:8000]}

Reference Solutions (from previous uploads):
{context_text[:6000]}

The JSON structure must be exactly:
{{
    "title": "Solution title",
    "date": "{datetime.now().strftime('%B %Y')}",
    ...
}}
"""
```

**Key Features**:
- Domain-aware generation
- Incorporates retrieved context
- Structured JSON output
- Truncates inputs to fit token limits

##### **Step 4: LLM Generation** (Lines 569-614)
```python
response = groq_client.chat.completions.create(
    model=GROQ_MODEL,  # "llama-3.1-8b-instant"
    messages=[
        {
            "role": "system", 
            "content": "You are a technical proposal expert. Always respond with valid JSON inside a fenced ```json block."
        },
        {"role": "user", "content": prompt}
    ],
    temperature=0.3,  # Low temperature for consistency
    max_tokens=4000
)

# Extract JSON from response
response_text = response.choices[0].message.content
json_str = extract_json_from_response(response_text)
solution_data = json.loads(json_str)

# Render architecture diagram
if solution_data.get("architecture_diagram"):
    image_path = render_mermaid_to_image(solution_data["architecture_diagram"])
    solution_data["architecture_diagram_image"] = base64_encoded_image
```

**Groq Configuration**:
- **Model**: `llama-3.1-8b-instant`
- **Temperature**: 0.3 (balanced creativity/consistency)
- **Max Tokens**: 4000
- **Return Format**: Structured JSON

### 4. Architecture Diagram Rendering

#### **Function**: `render_mermaid_to_image()` (Lines 453-480)
```python
def render_mermaid_to_image(mermaid_code: str) -> str | None:
    """Render Mermaid code to PNG using Kroki API"""
    payload = {
        "diagram_source": mermaid_code,
        "diagram_type": "mermaid",
        "output_format": "png"
    }
    
    response = requests.post("https://kroki.io", json=payload, timeout=10)
    
    if response.status_code == 200:
        temp_dir = tempfile.gettempdir()
        image_path = os.path.join(temp_dir, 
            f'architecture_diagram_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
        with open(image_path, "wb") as f:
            f.write(response.content)
        return image_path
```

**Features**:
- Converts Mermaid syntax to PNG
- Uses Kroki.io API
- Temporary file management
- Base64 encoding for frontend display

### 5. Solution Processing Endpoints

#### **Endpoint 1**: `POST /api/generate-solution` (Lines 881-943)
- **Input**: File upload + generation method
- **Process**: Extract → Generate → Return
- **Output**: `SolutionWithRecommendations`

```python
@app.post("/api/generate-solution", response_model=SolutionWithRecommendations)
async def generate_solution(
    file: UploadFile = File(...),
    method: str = "knowledgeBase"
):
    # Validate file type
    allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    # Extract text
    if file.content_type == 'application/pdf':
        rfp_text = extract_text_from_pdf(temp_file_path)
    elif file.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        rfp_text = extract_text_from_docx(temp_file_path)
    
    # Generate solution
    if method == "llmOnly":
        solution = await analyze_rfp_with_groq(rfp_text, use_rag=False)
    else:
        solution = await analyze_rfp_with_groq(rfp_text, use_rag=True)
    
    # Product recommendations
    recs = find_product_recommendations(solution.problem_statement, threshold=0.20)
    
    return SolutionWithRecommendations(solution=solution, recommendations=recs)
```

#### **Endpoint 2**: `POST /api/generate-solution-text` (Lines 945-957)
- **Input**: Raw text + generation method
- **Process**: Generate directly from text
- **Output**: `SolutionWithRecommendations`

### 6. Product Recommendation System

#### **Function**: `find_product_recommendations()` (Lines 315-336)
```python
def find_product_recommendations(problem_statement: str, threshold: float = 0.30):
    """
    Lightweight product matching using:
    - Jaccard similarity over token sets
    - Keyword boosting
    - Product catalog (_AIONOS_PRODUCTS)
    """
    recs = []
    for product in _AIONOS_PRODUCTS:
        # Base similarity from description
        base_score = _similarity(problem_statement, product["description"])
        
        # Keyword boost
        kw_matches = sum(1 for kw in product["keywords"] if kw in problem_statement.lower())
        if kw_matches:
            boost = min(1.0, kw_matches / max(3, len(product["keywords"]))) * 0.8
        
        score = min(1.0, 0.6 * base_score + boost)
        
        if score >= threshold:
            recs.append(ProductRecommendation(
                name=product["name"],
                description=product["description"],
                url=product["url"],
                score=score
            ))
    
    return sorted(recs, key=lambda r: r.score, reverse=True)
```

**AionOS Product Catalog** (Lines 234-295):
- IntelliMate™ - Unified AI platform
- IntelliConverse - Voice AI platform
- IntelliReach - Marketing suite
- IntelliWorkflow - Business automation
- IntelliResilience - Business continuity
- IntelliPulse - Feedback automation

---

## Data Flow

### 1. Document Upload Flow
```
User Uploads File
      ↓
Frontend validates (PDF/DOCX, <10MB)
      ↓
POST /api/upload-solution
      ↓
Backend extracts text
      ↓
Text splitter creates chunks (1000 chars, 100 overlap)
      ↓
Embeddings generated (HuggingFace)
      ↓
Vectors uploaded to Pinecone
      ↓
Return success with metadata
      ↓
File stored in uploads/
```

### 2. RAG Generation Flow
```
User provides RFP/problem statement
      ↓
Frontend: method="knowledgeBase" OR "llmOnly"
      ↓
POST /api/generate-solution or /api/generate-solution-text
      ↓
if method == "knowledgeBase":
    rfp_text embedded → Pinecone similarity_search(k=5)
    context = top 5 chunks
else:
    context = "No relevant references found."
      ↓
Prompt = System instructions + RFP + Context
      ↓
Groq LLM generates structured JSON
      ↓
Post-process: Render Mermaid diagram
      ↓
Product recommendations matched
      ↓
Return {solution, recommendations}
      ↓
Frontend displays preview
```

### 3. LLM-Only Generation Flow
```
User provides RFP/problem statement
      ↓
Frontend: method="llmOnly"
      ↓
POST /api/generate-solution or /api/generate-solution-text
      ↓
analyze_rfp_with_groq(rfp_text, use_rag=False)
      ↓
No vector search performed
      ↓
Prompt = System instructions + RFP only
      ↓
Groq LLM generates structured JSON
      ↓
Post-process: Render Mermaid diagram
      ↓
Product recommendations matched
      ↓
Return {solution, recommendations}
      ↓
Frontend displays preview
```

---

## Key Technologies

### Vector Database
- **Pinecone**: Serverless vector database
  - Cloud: AWS
  - Metric: Cosine similarity
  - Auto-scaling, managed infrastructure

### Embedding Model
- **HuggingFace all-MiniLM-L6-v2**:
  - Dimension: 384
  - Fast inference
  - Balanced accuracy/speed
  - Sentence-level embeddings

### LLM
- **Groq API**:
  - Model: llama-3.1-8b-instant
  - Fast inference (sub-second latency)
  - Cost-effective
  - JSON mode support

### Text Processing
- **LangChain**:
  - `RecursiveCharacterTextSplitter` for chunking
  - `PineconeVectorStore` for retrieval
  - Document loaders (PyPDFLoader)

### Document Parsing
- **PyPDF2**: PDF extraction
- **python-docx**: DOCX handling
- **BeautifulSoup**: Web scraping support

---

## Benefits of RAG Approach

### 1. **Context-Aware Generation**
- Incorporates domain-specific knowledge from historical proposals
- Adapts to different industries (TTLH, banking, healthcare, etc.)
- Maintains consistency with company standards

### 2. **Reduced Hallucination**
- Grounded in actual uploaded solutions
- Citations from source documents
- Validation through retrieved chunks

### 3. **Incremental Learning**
- Knowledge base grows with each upload
- Accumulates best practices over time
- Team-wide knowledge sharing

### 4. **Flexibility**
- LLM-only mode for novel problems
- RAG mode for leverage historical context
- User-controlled generation method

### 5. **Cost Efficiency**
- Smaller context windows (k=5 chunks)
- Fast Groq inference
- Pinecone serverless scaling

---

## Security & Access Control

### User Isolation
- `user_id` in vector metadata
- Can implement tenant-based filtering
- Per-user knowledge bases

### File Management
- SQLite database for metadata
- File system storage for documents
- Temporary file cleanup

### Environment Variables
```bash
GROQ_API_KEY=<your_groq_key>
PINECONE_API_KEY=<your_pinecone_key>
PINECONE_ENVIRONMENT=<your_env>
PINECONE_INDEX_NAME=<your_index_name>
```

---

## Performance Considerations

### Retrieval
- **Vector Search**: ~50-100ms (Pinecone)
- **Embedding**: ~20-50ms per document
- **Total RAG Overhead**: ~100-200ms

### Generation
- **Groq API**: ~500-1000ms
- **Total Generation**: ~1-2s

### Optimization
- Caching retrieved chunks
- Batch embedding generation
- Parallel diagram rendering

---

## Future Enhancements

### 1. **Hybrid Search**
- Combine semantic + keyword search
- BM25 + vector similarity

### 2. **Re-ranking**
- Secondary LLM-based re-ranking
- Diversity boosting

### 3. **Metadata Filtering**
- Filter by domain, date, user
- Advanced query building

### 4. **Chat History**
- Multi-turn conversations
- Context accumulation

### 5. **Evaluation Metrics**
- Relevance scoring
- User feedback loop
- A/B testing framework

---

## Summary

The RAG implementation in this application demonstrates a production-ready system combining:
- **Efficient retrieval** via Pinecone vector search
- **Context-aware generation** using Groq LLM
- **User-friendly interface** with React frontend
- **Flexible architecture** supporting multiple generation modes
- **Enterprise features** including authentication, product recommendations, and document management

This approach enables the system to generate high-quality, domain-specific technical proposals while maintaining cost efficiency and scalability.

