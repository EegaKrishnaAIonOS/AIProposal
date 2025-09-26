from sqlalchemy import create_engine, Column, Integer, String, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./solutions.db"

engine = create_engine(DATABASE_URL,connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Solution(Base):
    __tablename__ = "solutions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    generated_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, index=True)
    file_path = Column(String)


class UploadedSolution(Base):
    __tablename__ = "uploaded_solutions"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, index=True)
    file_path = Column(String)

Base.metadata.create_all(bind=engine)

# Lightweight migration: if the uploaded_solutions table exists but lacks the user_id column,
# add it (SQLite supports ALTER TABLE ... ADD COLUMN).
try:
    with engine.begin() as conn:
        # Ensure user_id column exists on solutions
        try:
            cols = conn.execute(text("PRAGMA table_info('solutions')")).fetchall()
            col_names = [c[1] for c in cols]
            if 'user_id' not in col_names:
                conn.execute(text("ALTER TABLE solutions ADD COLUMN user_id VARCHAR"))
        except Exception:
            pass

        tbl = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='uploaded_solutions'"))
        tbl = getattr(tbl, 'fetchone', lambda: None)()        
        if tbl:
            cols = conn.execute(text("PRAGMA table_info('uploaded_solutions')")).fetchall()
            col_names = [c[1] for c in cols]
            if 'user_id' not in col_names:
                conn.execute(text("ALTER TABLE uploaded_solutions ADD COLUMN user_id VARCHAR"))
except Exception:
    # If migration fails, don't crash the app startup; the error will surface on DB operations.
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
