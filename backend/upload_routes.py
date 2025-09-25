from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os, tempfile, shutil
from datetime import datetime
from typing import List, Optional
import io,docx, uuid

from langchain.text_splitter import RecursiveCharacterTextSplitter
#from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, TextLoader
import docx 
from pinecone import Pinecone, ServerlessSpec

from database import get_db, UploadedSolution as DBSolution
from dotenv import load_dotenv

router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOADS_DIR):
	os.makedirs(UPLOADS_DIR)

# --- NEW PINECONE INITIALIZATION ---
load_dotenv()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
EMBEDDING_MODEL = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

pc = Pinecone(api_key=PINECONE_API_KEY)

# Check if index exists, if not, create it
if PINECONE_INDEX_NAME not in [index.name for index in pc.list_indexes()]:
    pc.create_index(
        name=PINECONE_INDEX_NAME,
        dimension=384,
        metric="cosine",
		spec=ServerlessSpec(
            cloud='aws',
            region='us-east-1' # or your desired cloud and region
        )
    )

INDEX = pc.Index(PINECONE_INDEX_NAME)

# Text splitter for chunking documents
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
# --- END NEW PINECONE INITIALIZATION ---

@router.post("/api/upload-solution")
async def upload_solution(file: UploadFile = File(...), x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
	"""Upload a solution file and save metadata associated with the user (X-User-Id header)."""
	user_id = x_user_id or "anonymous"

	filename = file.filename
	safe_name = f"{int(datetime.utcnow().timestamp())}_{filename}"
	dest_path = os.path.join(UPLOADS_DIR, safe_name)

	try:
		with open(dest_path, 'wb') as buffer:
			while True:
				chunk = await file.read(1024 * 1024)
				if not chunk:
					break
				buffer.write(chunk)
		await file.close()

		# New RAG Processing
		file_content = ""
		file_extension = os.path.splitext(filename)[1].lower()

		if file_extension == ".docx":
			doc = docx.Document(dest_path)
			for paragraph in doc.paragraphs:
				file_content += paragraph.text + "\n"
		elif file_extension == ".pdf":
			loader = PyPDFLoader(dest_path)
			docs = loader.load_and_split(text_splitter)
			if not docs:
				raise ValueError("Could not extract content from PDF.")
		else:
			with open(dest_path, 'r', encoding='utf-8', errors='ignore') as f:
				file_content = f.read()

		if file_content:
			docs = text_splitter.create_documents([file_content])

		if not docs:
			raise ValueError("No content was extracted or chunks were created.")

        # Create unique IDs and prepare for upsert
		vectors = []
		for doc in docs:
			doc_id = str(uuid.uuid4())
			embedding = EMBEDDING_MODEL.embed_documents([doc.page_content])[0]
			metadata = {"filename": filename, "user_id": user_id, "text": doc.page_content}
			vectors.append((doc_id, embedding, metadata))

		# if not vectors:
		# 	print("No vectors to upsert.")
		# for i,doc in vectors:
		# 	print(f"Chunk {i+1}:")
		# 	print(doc)

        #Upsert chunks to Pinecone
		if vectors:
			INDEX.upsert(vectors)
        # --- END NEW RAG PROCESSING ---

		record = DBSolution(
			filename=filename,
			upload_date=datetime.utcnow(),
			user_id=user_id,
			file_path=dest_path
		)
		db.add(record)
		db.commit()
		db.refresh(record)

		return {"id": record.id, "filename": record.filename, "upload_date": record.upload_date.isoformat()}

	except Exception as e:
		if os.path.exists(dest_path):
			os.remove(dest_path)
		raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/api/uploaded-solutions")
def list_uploaded_solutions(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)) -> List[dict]:
	"""List uploaded solutions for the requesting user. If none, returns empty list."""
	user_id = x_user_id or "anonymous"
	records = db.query(DBSolution).filter(DBSolution.user_id == user_id).order_by(DBSolution.upload_date.desc()).all()
	return [
		{"id": r.id, "filename": r.filename, "upload_date": r.upload_date.isoformat()}
		for r in records
	]


@router.get("/api/uploaded-solutions/{solution_id}/download")
def download_uploaded_solution(solution_id: int, x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
	"""Download a previously uploaded solution if it belongs to the requesting user."""
	user_id = x_user_id or "anonymous"
	record = db.query(DBSolution).filter(DBSolution.id == solution_id, DBSolution.user_id == user_id).first()
	if not record:
		raise HTTPException(status_code=404, detail="Uploaded solution not found")
	if not os.path.exists(record.file_path):
		raise HTTPException(status_code=404, detail="File not found on server")

	return FileResponse(record.file_path, filename=record.filename, media_type='application/octet-stream')
