from __future__ import annotations

from pydantic import BaseModel
from typing import Optional
from datetime import date, time


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

class TermRead(TermBase):
    id: int
    status: str
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
    email: str
    department: str
    modality_constraint: str = "any"
    max_credits: int = 12
    is_active: bool = True

class InstructorCreate(InstructorBase):
    pass

class InstructorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    modality_constraint: Optional[str] = None
    max_credits: Optional[int] = None
    is_active: Optional[bool] = None

class InstructorRead(InstructorBase):
    id: int
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

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    department_code: Optional[str] = None
    course_number: Optional[str] = None
    title: Optional[str] = None
    credits: Optional[int] = None

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
    instructor_id: Optional[int] = None

class SectionCreate(SectionBase):
    pass

class SectionUpdate(BaseModel):
    section_number: Optional[str] = None
    enrollment_cap: Optional[int] = None
    modality: Optional[str] = None
    status: Optional[str] = None
    instructor_id: Optional[int] = None

class SectionRead(SectionBase):
    id: int
    status: str
    instructor_id: Optional[int] = None
    instructor: Optional[InstructorRead] = None
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
    days_of_week: str
    start_time: time
    end_time: time
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


# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"

class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: str
    model_config = {"from_attributes": True}


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

class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    errors: list[str] = []


# --- AppSetting ---
class AppSettingRead(BaseModel):
    key: str
    value: str
    model_config = {"from_attributes": True}

class AppSettingWrite(BaseModel):
    key: str
    value: str
