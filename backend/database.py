from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./solutions.db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Solution(Base):
    __tablename__ = "solutions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    generated_date = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
