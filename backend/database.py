from sqlalchemy import create_engine, Column, Integer, String, DateTime, text, Text
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy import Index
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

# New: table for scraped tenders/challenges
class ScrapedTenders(Base):
    __tablename__ = "scraped_tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(String, unique=True, index=True)
    source = Column(String)  # 'gem' | 'idex' | 'tata'
    title = Column(String)
    organization = Column(String)
    sector = Column(String)
    description = Column(Text)
    deadline = Column(DateTime)
    value = Column(String)
    url = Column(String)
    ttlh_score = Column(Integer, default=0)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(SQLITE_JSON)

    __table_args__ = (
        Index('idx_source_deadline', 'source', 'deadline'),
        Index('idx_sector', 'sector'),
    )

# New: table for wishlists
class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)  # NULL for global/anonymous
    tender_id = Column(String, index=True)  # Reference to scraped_tenders.tender_id
    title = Column(String)  # Snapshot
    organization = Column(String)  # Snapshot
    summary = Column(Text)  # Snapshot
    value = Column(String)  # Snapshot
    deadline = Column(DateTime)  # Snapshot
    url = Column(String)  # Snapshot
    sector = Column(String)  # Snapshot
    source = Column(String)  # Snapshot
    raw_snapshot = Column(SQLITE_JSON)  # Full snapshot of tender data
    created_at = Column(DateTime, default=datetime.utcnow)
    removed_at = Column(DateTime, nullable=True)  # Soft delete

    __table_args__ = (
        Index('idx_user_tender', 'user_id', 'tender_id'),
        Index('idx_user_created', 'user_id', 'created_at'),
    )

def ensure_tenders_table():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

def ensure_wishlists_table():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
