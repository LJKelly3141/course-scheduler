"""
Meeting CRUD endpoints with inline conflict validation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.meeting import Meeting
from app.models.room import Room
from app.models.section import Section, SectionStatus
from app.schemas.schemas import (
    ConflictItem,
    MeetingCreate,
    MeetingReadFull,
    MeetingUpdate,
)
from app.services.conflict_engine import check_meeting_conflicts

router = APIRouter()


class MeetingCreateResponse(MeetingReadFull):
    """Response model for meeting creation/update that includes detected conflicts."""
    conflicts: list[ConflictItem] = []

    model_config = {"from_attributes": True}


def _get_meeting_full(db: Session, meeting_id: int) -> Meeting | None:
    """Fetch a meeting with all relationships eager-loaded."""
    return (
        db.query(Meeting)
        .options(
            joinedload(Meeting.section).joinedload(Section.course),
            joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Meeting.instructor),
            joinedload(Meeting.time_block),
        )
        .filter(Meeting.id == meeting_id)
        .first()
    )


@router.get("/terms/{term_id}/meetings", response_model=list[MeetingReadFull])
def list_meetings(term_id: int, db: Session = Depends(get_db)):
    """List all meetings for a term, eager-loading relationships."""
    meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Meeting.section).joinedload(Section.course),
            joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Meeting.instructor),
            joinedload(Meeting.time_block),
        )
        .all()
    )
    return meetings


@router.post("/terms/{term_id}/meetings", response_model=MeetingCreateResponse, status_code=201)
def create_meeting(term_id: int, payload: MeetingCreate, db: Session = Depends(get_db)):
    """
    Create a meeting. Run inline conflict checks before saving.
    If hard conflicts are detected, the meeting is still created but
    conflicts are returned in the response.
    """
    # Verify the section belongs to this term
    section = db.query(Section).filter(Section.id == payload.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if section.term_id != term_id:
        raise HTTPException(
            status_code=400,
            detail="Section does not belong to this term",
        )

    # Build a transient meeting object for conflict checking
    meeting = Meeting(
        section_id=payload.section_id,
        days_of_week=payload.days_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        time_block_id=payload.time_block_id,
        room_id=payload.room_id,
        instructor_id=payload.instructor_id,
    )

    # Run conflict detection on the not-yet-persisted meeting
    conflicts = check_meeting_conflicts(db, meeting, term_id)

    # Persist the meeting
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Update section status to scheduled
    if section.status == SectionStatus.unscheduled:
        section.status = SectionStatus.scheduled
        db.commit()

    # Re-fetch with full relationships
    full_meeting = _get_meeting_full(db, meeting.id)

    # Build response with conflicts
    response_data = MeetingCreateResponse.model_validate(full_meeting)
    response_data.conflicts = conflicts
    return response_data


@router.put("/meetings/{meeting_id}", response_model=MeetingCreateResponse)
def update_meeting(meeting_id: int, payload: MeetingUpdate, db: Session = Depends(get_db)):
    """
    Update a meeting. Run inline conflict checks after applying changes.
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meeting, field, value)

    # Determine the term for conflict checking
    section = db.query(Section).filter(Section.id == meeting.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    term_id = section.term_id

    # Run conflict detection (exclude this meeting from pairwise checks)
    conflicts = check_meeting_conflicts(db, meeting, term_id, exclude_meeting_id=meeting_id)

    db.commit()
    db.refresh(meeting)

    # Re-fetch with full relationships
    full_meeting = _get_meeting_full(db, meeting.id)

    response_data = MeetingCreateResponse.model_validate(full_meeting)
    response_data.conflicts = conflicts
    return response_data


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """
    Delete a meeting. If the section has no remaining meetings after deletion,
    set its status back to "unscheduled".
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    section_id = meeting.section_id

    db.delete(meeting)
    db.commit()

    # Check if the section has any remaining meetings
    remaining_count = (
        db.query(Meeting)
        .filter(Meeting.section_id == section_id)
        .count()
    )

    if remaining_count == 0:
        section = db.query(Section).filter(Section.id == section_id).first()
        if section and section.status != SectionStatus.unscheduled:
            section.status = SectionStatus.unscheduled
            db.commit()
