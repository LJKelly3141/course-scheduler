from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.term import Term
from app.schemas.schemas import BatchDeleteRequest, TermCreate, TermRead, TermUpdate, ValidationResult
from app.services.term_validation import finalize_term, validate_term

router = APIRouter()


@router.get("", response_model=list[TermRead])
def list_terms(db: Session = Depends(get_db)):
    return db.query(Term).all()


@router.post("", response_model=TermRead, status_code=201)
def create_term(payload: TermCreate, db: Session = Depends(get_db)):
    term = Term(
        name=payload.name,
        type=payload.type,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.get("/{term_id}", response_model=TermRead)
def get_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return term


@router.put("/{term_id}", response_model=TermRead)
def update_term(term_id: int, payload: TermUpdate, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(term, field, value)

    db.commit()
    db.refresh(term)
    return term


@router.post("/batch-delete", status_code=204)
def batch_delete_terms(payload: BatchDeleteRequest, db: Session = Depends(get_db)):
    terms = db.query(Term).filter(Term.id.in_(payload.ids)).all()
    for term in terms:
        db.delete(term)
    db.commit()


@router.delete("/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(term)
    db.commit()


@router.get("/{term_id}/validate", response_model=ValidationResult)
def validate_term_endpoint(term_id: int, db: Session = Depends(get_db)):
    """
    Validate a term schedule by running hard conflict detection and
    soft warning detection.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return validate_term(db, term_id)


@router.post("/{term_id}/finalize", response_model=ValidationResult)
def finalize_term_endpoint(term_id: int, db: Session = Depends(get_db)):
    """
    Validate and finalize a term. If no hard conflicts exist, sets the
    term status to "final". Returns the validation result either way.
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    return finalize_term(db, term_id)
