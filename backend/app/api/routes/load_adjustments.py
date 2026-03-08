"""CRUD endpoints for instructor load adjustments."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.load_adjustment import LoadAdjustment, AdjustmentType
from app.schemas.schemas import LoadAdjustmentCreate, LoadAdjustmentUpdate, LoadAdjustmentRead

router = APIRouter()


@router.get("", response_model=list[LoadAdjustmentRead])
def list_adjustments(
    term_id: int = Query(...),
    instructor_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LoadAdjustment).filter(LoadAdjustment.term_id == term_id)
    if instructor_id is not None:
        q = q.filter(LoadAdjustment.instructor_id == instructor_id)
    return q.all()


@router.post("/{instructor_id}", response_model=LoadAdjustmentRead)
def create_adjustment(
    instructor_id: int,
    payload: LoadAdjustmentCreate,
    db: Session = Depends(get_db),
):
    adj = LoadAdjustment(
        instructor_id=instructor_id,
        term_id=payload.term_id,
        description=payload.description,
        equivalent_credits=payload.equivalent_credits,
        adjustment_type=payload.adjustment_type,
    )
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return adj


@router.put("/{adjustment_id}", response_model=LoadAdjustmentRead)
def update_adjustment(
    adjustment_id: int,
    payload: LoadAdjustmentUpdate,
    db: Session = Depends(get_db),
):
    adj = db.query(LoadAdjustment).filter(LoadAdjustment.id == adjustment_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(adj, field, value)

    db.commit()
    db.refresh(adj)
    return adj


@router.delete("/{adjustment_id}")
def delete_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
):
    adj = db.query(LoadAdjustment).filter(LoadAdjustment.id == adjustment_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    db.delete(adj)
    db.commit()
    return {"ok": True}
