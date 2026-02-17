from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.time_block import TimeBlock
from app.schemas.schemas import TimeBlockRead

router = APIRouter()


@router.get("", response_model=list[TimeBlockRead])
def list_time_blocks(db: Session = Depends(get_db)):
    return db.query(TimeBlock).all()
