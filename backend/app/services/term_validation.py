"""
Term validation and finalization for the UWRF Course Scheduler.

Combines hard conflict detection and soft warning detection to validate
a term schedule. Provides finalization logic that sets the term status
to "final" if no hard conflicts are found.
"""

from sqlalchemy.orm import Session

from app.models.term import Term, TermStatus
from app.schemas.schemas import ValidationResult
from app.services.conflict_engine import detect_hard_conflicts
from app.services.soft_constraints import detect_soft_warnings


def validate_term(db: Session, term_id: int) -> ValidationResult:
    """
    Validate a term by running both hard conflict detection and soft
    warning detection.

    Args:
        db: SQLAlchemy session.
        term_id: The term to validate.

    Returns:
        ValidationResult with hard_conflicts, soft_warnings, and valid flag.
    """
    hard_conflicts = detect_hard_conflicts(db, term_id)
    soft_warnings = detect_soft_warnings(db, term_id)

    return ValidationResult(
        valid=len(hard_conflicts) == 0,
        hard_conflicts=hard_conflicts,
        soft_warnings=soft_warnings,
    )


def finalize_term(db: Session, term_id: int) -> ValidationResult:
    """
    Validate a term and, if no hard conflicts exist, set its status to "final".

    Args:
        db: SQLAlchemy session.
        term_id: The term to finalize.

    Returns:
        ValidationResult. If valid is True, the term status has been updated.
    """
    result = validate_term(db, term_id)

    if result.valid:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term:
            term.status = TermStatus.final
            db.commit()
            db.refresh(term)

    return result
