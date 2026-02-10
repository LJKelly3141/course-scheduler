import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

db_path = os.environ.get("DATABASE_PATH", "./scheduler.db")
DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
