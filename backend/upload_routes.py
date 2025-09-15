from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os, tempfile, shutil
from datetime import datetime
from typing import List, Optional

from database import get_db, UploadedSolution as DBSolution

router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOADS_DIR):
	os.makedirs(UPLOADS_DIR)


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
