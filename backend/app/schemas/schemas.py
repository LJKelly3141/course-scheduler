from __future__ import annotations

from pydantic import BaseModel
from typing import Optional
from datetime import date, time


# --- Academic Year ---
class AcademicYearCreate(BaseModel):
    label: str
    start_date: date
    end_date: date
    is_current: bool = False

class AcademicYearRead(BaseModel):
    id: int
    label: str
    start_date: date
    end_date: date
    is_current: bool
    model_config = {"from_attributes": True}


# --- Term ---
class TermBase(BaseModel):
    name: str
    type: str
    start_date: date
    end_date: date

class TermCreate(TermBase):
    pass

class TermUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    academic_year_id: Optional[int] = None

class TermSessionCreate(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    head_count_days: Optional[int] = None
    head_count_date: Optional[date] = None
    notes: Optional[str] = None

class TermSessionRead(BaseModel):
    id: int
    term_id: int
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    head_count_days: Optional[int] = None
    head_count_date: Optional[date] = None
    notes: Optional[str] = None
    model_config = {"from_attributes": True}

class TermRead(TermBase):
    id: int
    status: str
    academic_year_id: Optional[int] = None
    academic_year: Optional[AcademicYearRead] = None
    sessions: list[TermSessionRead] = []
    model_config = {"from_attributes": True}


# --- Building ---
class BuildingBase(BaseModel):
    name: str
    abbreviation: str

class BuildingCreate(BuildingBase):
    pass

class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    abbreviation: Optional[str] = None

class BuildingRead(BuildingBase):
    id: int
    model_config = {"from_attributes": True}


# --- Room ---
class RoomBase(BaseModel):
    building_id: int
    room_number: str
    capacity: int

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    building_id: Optional[int] = None
    room_number: Optional[str] = None
    capacity: Optional[int] = None

class RoomRead(RoomBase):
    id: int
    model_config = {"from_attributes": True}

class RoomReadWithBuilding(RoomRead):
    building: Optional[BuildingRead] = None


# --- Instructor ---
class InstructorBase(BaseModel):
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    office_location: Optional[str] = None
    department: str
    modality_constraint: str = "any"
    max_credits: int = 12
    is_active: bool = True
    instructor_type: Optional[str] = None
    rank: Optional[str] = None
    tenure_status: Optional[str] = None
    hire_date: Optional[date] = None
    emergency_contact: Optional[str] = None
    available_summer: bool = True
    available_winter: bool = True

class InstructorCreate(InstructorBase):
    pass

class InstructorUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    office_location: Optional[str] = None
    department: Optional[str] = None
    modality_constraint: Optional[str] = None
    max_credits: Optional[int] = None
    is_active: Optional[bool] = None
    instructor_type: Optional[str] = None
    rank: Optional[str] = None
    tenure_status: Optional[str] = None
    hire_date: Optional[date] = None
    emergency_contact: Optional[str] = None
    available_summer: Optional[bool] = None
    available_winter: Optional[bool] = None

class InstructorRead(InstructorBase):
    id: int
    model_config = {"from_attributes": True}


# --- InstructorNote ---
class InstructorNoteCreate(BaseModel):
    term_id: Optional[int] = None
    category: str = "general"
    content: str = ""

class InstructorNoteUpdate(BaseModel):
    term_id: Optional[int] = None
    category: Optional[str] = None
    content: Optional[str] = None

class InstructorNoteRead(BaseModel):
    id: int
    instructor_id: int
    term_id: Optional[int] = None
    category: str
    content: str
    model_config = {"from_attributes": True}


# --- InstructorAvailability ---
class InstructorAvailabilityBase(BaseModel):
    instructor_id: int
    term_id: int
    day_of_week: str
    start_time: time
    end_time: time
    type: str

class InstructorAvailabilityCreate(BaseModel):
    day_of_week: str
    start_time: time
    end_time: time
    type: str

class InstructorAvailabilityRead(InstructorAvailabilityBase):
    id: int
    model_config = {"from_attributes": True}


# --- Course ---
class CourseBase(BaseModel):
    department_code: str
    course_number: str
    title: str
    credits: int = 3
    counts_toward_load: bool = True

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    department_code: Optional[str] = None
    course_number: Optional[str] = None
    title: Optional[str] = None
    credits: Optional[int] = None
    counts_toward_load: Optional[bool] = None

class CourseRead(CourseBase):
    id: int
    model_config = {"from_attributes": True}


# --- Section ---
class SectionBase(BaseModel):
    course_id: int
    term_id: int
    section_number: str
    enrollment_cap: int = 30
    modality: str = "in_person"
    session: str = "regular"
    term_session_id: Optional[int] = None
    instructor_id: Optional[int] = None
    duration_weeks: Optional[int] = None
    equivalent_credits: Optional[int] = None
    lecture_hours: Optional[float] = None
    special_course_fee: Optional[float] = None
    instruction_type: Optional[str] = None
    notes: Optional[str] = None

class SectionCreate(SectionBase):
    pass

class SectionUpdate(BaseModel):
    section_number: Optional[str] = None
    enrollment_cap: Optional[int] = None
    modality: Optional[str] = None
    session: Optional[str] = None
    term_session_id: Optional[int] = None
    status: Optional[str] = None
    instructor_id: Optional[int] = None
    duration_weeks: Optional[int] = None
    equivalent_credits: Optional[int] = None
    lecture_hours: Optional[float] = None
    special_course_fee: Optional[float] = None
    instruction_type: Optional[str] = None
    notes: Optional[str] = None

class SectionRead(SectionBase):
    id: int
    status: str
    session: str = "regular"
    term_session_id: Optional[int] = None
    instructor_id: Optional[int] = None
    instructor: Optional[InstructorRead] = None
    term_session: Optional[TermSessionRead] = None
    duration_weeks: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    equivalent_credits: Optional[int] = None
    lecture_hours: Optional[float] = None
    special_course_fee: Optional[float] = None
    instruction_type: Optional[str] = None
    notes: Optional[str] = None
    model_config = {"from_attributes": True}

class SectionReadWithCourse(SectionRead):
    course: Optional[CourseRead] = None


# --- TimeBlock ---
class TimeBlockRead(BaseModel):
    id: int
    pattern: str
    days_of_week: str
    start_time: time
    end_time: time
    label: str
    model_config = {"from_attributes": True}


# --- Meeting ---
class MeetingBase(BaseModel):
    section_id: int
    days_of_week: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    time_block_id: Optional[int] = None
    room_id: Optional[int] = None
    instructor_id: Optional[int] = None

class MeetingCreate(MeetingBase):
    pass

class MeetingUpdate(BaseModel):
    days_of_week: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    time_block_id: Optional[int] = None
    room_id: Optional[int] = None
    instructor_id: Optional[int] = None

class MeetingRead(MeetingBase):
    id: int
    model_config = {"from_attributes": True}

class MeetingReadFull(MeetingRead):
    section: Optional[SectionReadWithCourse] = None
    room: Optional[RoomReadWithBuilding] = None
    instructor: Optional[InstructorRead] = None
    time_block: Optional[TimeBlockRead] = None


# --- Validation ---
class ConflictItem(BaseModel):
    type: str
    severity: str  # "hard" or "soft"
    description: str
    meeting_ids: list[int] = []

class ValidationResult(BaseModel):
    valid: bool
    hard_conflicts: list[ConflictItem] = []
    soft_warnings: list[ConflictItem] = []



# --- Import ---
class BatchDeleteRequest(BaseModel):
    ids: list[int]


class ImportPreview(BaseModel):
    rows: list[dict]
    errors: list[str] = []
    valid_count: int = 0

class InstructorMatch(BaseModel):
    name: str
    matches: list[dict] = []

class ScheduleImportPreview(ImportPreview):
    suggested_term: Optional[dict] = None
    instructor_matches: list[InstructorMatch] = []
    file_headers: list[str] = []
    column_mapping: dict = {}

class ColumnDetectResponse(BaseModel):
    file_headers: list[str] = []
    column_mapping: dict = {}
    canonical_columns: list[str] = []
    warnings: list[str] = []

class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    errors: list[str] = []


# --- Schedule Comparison ---
class FieldDiff(BaseModel):
    field: str
    registrar_value: str
    department_value: str

class ChangedSection(BaseModel):
    crn: Optional[int] = None
    department_code: str
    course_number: str
    section_number: str
    title: str
    diffs: list[FieldDiff] = []

class NewSection(BaseModel):
    department_code: str
    course_number: str
    section_number: str
    title: str
    details: str
    time: str = ""
    room: str = ""
    instructor: str = ""
    modality: str = ""

class RemovedSection(BaseModel):
    crn: Optional[int] = None
    department_code: str
    course_number: str
    section_number: str
    title: str
    details: str
    time: str = ""
    room: str = ""
    instructor: str = ""
    modality: str = ""

class CompareResult(BaseModel):
    term_name: str
    changed: list[ChangedSection] = []
    new_sections: list[NewSection] = []
    removed: list[RemovedSection] = []
    unchanged_count: int = 0


# --- AppSetting ---
class AppSettingRead(BaseModel):
    key: str
    value: str
    model_config = {"from_attributes": True}

class AppSettingWrite(BaseModel):
    key: str
    value: str


# --- Load Adjustments ---
class LoadAdjustmentCreate(BaseModel):
    term_id: int
    description: str
    equivalent_credits: float = 0.0
    adjustment_type: str = "other"

class LoadAdjustmentUpdate(BaseModel):
    description: Optional[str] = None
    equivalent_credits: Optional[float] = None
    adjustment_type: Optional[str] = None

class LoadAdjustmentRead(BaseModel):
    id: int
    instructor_id: int
    term_id: int
    description: str
    equivalent_credits: float
    adjustment_type: str
    model_config = {"from_attributes": True}


# --- Workload ---
class WorkloadSectionRow(BaseModel):
    section_id: int
    department_code: str
    course_number: str
    section_number: str
    title: str
    actual_credits: int
    equivalent_credits: int
    enrollment_cap: int
    sch: int
    modality: str
    instruction_type: str = "LEC"
    schedule_info: str
    status: str
    counts_toward_load: bool

class WorkloadAdjustmentRow(BaseModel):
    id: int
    description: str
    equivalent_credits: float
    adjustment_type: str

class InstructorWorkload(BaseModel):
    instructor_id: int
    name: str
    last_name: str
    first_name: str
    instructor_type: Optional[str] = None
    department: str
    max_credits: int
    section_count: int
    sections: list[WorkloadSectionRow] = []
    adjustments: list[WorkloadAdjustmentRow] = []
    total_teaching_credits: int = 0
    total_equivalent_credits: float = 0.0
    total_sch: int = 0
    is_overloaded: bool = False

class WorkloadResponse(BaseModel):
    instructors: list[InstructorWorkload] = []
    unassigned_sections: list[WorkloadSectionRow] = []
    term_totals: dict = {}
