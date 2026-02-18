export interface Term {
  id: number;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface Building {
  id: number;
  name: string;
  abbreviation: string;
}

export interface Room {
  id: number;
  building_id: number;
  room_number: string;
  capacity: number;
  building?: Building;
}

export interface Instructor {
  id: number;
  name: string;
  email: string;
  department: string;
  modality_constraint: string;
  max_credits: number;
  is_active: boolean;
}

export interface InstructorAvailability {
  id: number;
  instructor_id: number;
  term_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  type: string;
}

export interface Course {
  id: number;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
}

export interface Section {
  id: number;
  course_id: number;
  term_id: number;
  section_number: string;
  enrollment_cap: number;
  modality: string;
  status: string;
  instructor_id: number | null;
  course?: Course;
  instructor?: Instructor;
}

export interface TimeBlock {
  id: number;
  pattern: string;
  days_of_week: string;
  start_time: string;
  end_time: string;
  label: string;
}

export interface Meeting {
  id: number;
  section_id: number;
  days_of_week: string;
  start_time: string;
  end_time: string;
  time_block_id: number | null;
  room_id: number | null;
  instructor_id: number | null;
  section?: Section;
  room?: Room;
  instructor?: Instructor;
  time_block?: TimeBlock;
}

export interface ConflictItem {
  type: string;
  severity: string;
  description: string;
  meeting_ids: number[];
}

export interface ValidationResult {
  valid: boolean;
  hard_conflicts: ConflictItem[];
  soft_warnings: ConflictItem[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AppSetting {
  key: string;
  value: string;
}
