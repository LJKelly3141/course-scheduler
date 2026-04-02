export interface AcademicYear {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface TermSession {
  id: number;
  term_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  head_count_days: number | null;
  head_count_date: string | null;
  notes: string | null;
}

export interface Term {
  id: number;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  academic_year_id: number | null;
  academic_year: AcademicYear | null;
  sessions?: TermSession[];
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
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  office_location: string | null;
  department: string;
  modality_constraint: string;
  max_credits: number;
  is_active: boolean;
  instructor_type: string | null;
  rank: string | null;
  tenure_status: string | null;
  hire_date: string | null;
}

export interface InstructorNote {
  id: number;
  instructor_id: number;
  term_id: number | null;
  category: string;
  content: string;
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
  counts_toward_load: boolean;
}

export interface Section {
  id: number;
  course_id: number;
  term_id: number;
  section_number: string;
  enrollment_cap: number;
  modality: string;
  session: string;
  term_session_id: number | null;
  status: string;
  instructor_id: number | null;
  duration_weeks: number | null;
  start_date: string | null;
  end_date: string | null;
  equivalent_credits: number | null;
  lecture_hours: number | null;
  special_course_fee: number | null;
  notes: string | null;
  course?: Course;
  instructor?: Instructor;
  term_session?: TermSession;
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
  days_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
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

export interface AppSetting {
  key: string;
  value: string;
}

export interface FieldDiff {
  field: string;
  registrar_value: string;
  department_value: string;
}

export interface ChangedSection {
  crn: number | null;
  department_code: string;
  course_number: string;
  section_number: string;
  title: string;
  diffs: FieldDiff[];
}

export interface NewSection {
  department_code: string;
  course_number: string;
  section_number: string;
  title: string;
  details: string;
  time: string;
  room: string;
  instructor: string;
  modality: string;
}

export interface RemovedSection {
  crn: number | null;
  department_code: string;
  course_number: string;
  section_number: string;
  title: string;
  details: string;
  time: string;
  room: string;
  instructor: string;
  modality: string;
}

export interface CompareResult {
  term_name: string;
  changed: ChangedSection[];
  new_sections: NewSection[];
  removed: RemovedSection[];
  unchanged_count: number;
}

// ---------------------------------------------------------------------------
// Analytics types
// ---------------------------------------------------------------------------

export interface AnalyticsSummary {
  avg_annual_headcount: number;
  avg_annual_sch: number;
  sch_per_fte: number;
  avg_annual_fte: number;
  num_years: number;
  total_enrolled: number;
  total_seats: number;
  fill_rate: number;
  total_sch: number;
  yoy_enrolled_change: number;
  fill_by_level: {
    level: number;
    fill_rate: number;
    enrolled: number;
    sections: number;
  }[];
  courses_needing_attention: {
    course_id: number;
    department_code: string;
    course_number: string;
    title: string;
    flags: string[];
  }[];
}

export interface AggregateTrend {
  academic_year: string;
  semester: string;
  total_enrolled: number;
  total_cap: number;
  num_sections: number;
  fill_rate: number;
  total_sch: number;
}

export interface CourseTrend {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  data_points: {
    academic_year: string;
    semester: string;
    total_enrolled: number;
    total_cap: number;
    num_sections: number;
    fill_rate: number;
  }[];
}

export interface CourseForecast {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
  forecast_enrollment: number;
  forecast_sections: number;
  avg_section_size: number;
  trend: string;
  confidence: string;
  history: number[];
  p25: number;
  p75: number;
  suggested_seats: number;
  suggested_sections: number;
  cohort_fallback: boolean;
}

export interface YoyChange {
  course_id: number;
  label: string;
  yoy_pct: number;
  current: number;
  previous: number;
}

export interface YoyChanges {
  top_growers: YoyChange[];
  top_decliners: YoyChange[];
}

export interface FillHeatmapCell {
  course_id: number;
  academic_year: string;
  semester: string;
  fill_rate: number;
  enrolled: number;
  capacity: number;
}

export interface FillHeatmapResponse {
  courses: { course_id: number; label: string }[];
  terms: { academic_year: string; semester: string }[];
  cells: FillHeatmapCell[];
}

export interface ModalityFill {
  modality: string;
  fill_rate: number;
  enrolled: number;
  capacity: number;
  sections: number;
}

export interface ModalityBreakdownResponse {
  modalities: Record<string, unknown>[];
  modality_names: string[];
  modality_fill: ModalityFill[];
}

export interface TimeSlot {
  pattern: string;
  start_time: string;
  end_time: string;
  usage_count: number;
  avg_fill_rate: number;
  courses: string[];
}

export interface TimeSlotAnalysis {
  time_slots: TimeSlot[];
}

export interface RoomPressureBlock {
  time_block_id: number;
  label: string;
  pattern: string;
  total_rooms: number;
  rooms_in_use: number;
  utilization: number;
}

export interface RoomPressureResponse {
  time_blocks: RoomPressureBlock[];
}

export interface HeatmapCell {
  day: string;
  hour: number;
  minute: number;
  avg_enrollment: number;
  sections: number;
  total_enrolled: number;
}

// ---------------------------------------------------------------------------
// Course Rotation types
// ---------------------------------------------------------------------------

export interface RotationEntry {
  id: number;
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
  semester: string;
  year_parity: string;
  num_sections: number;
  enrollment_cap: number;
  modality: string;
  time_block_id: number | null;
  time_block_label: string | null;
  days_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  instructor_id: number | null;
  instructor_name: string | null;
  room_id: number | null;
  room_label: string | null;
  session: string | null;
}

export interface ApplyRotationResult {
  term_id: number;
  term_name: string;
  entries_matched: number;
  sections_created: number;
  meetings_created: number;
  details: { course: string; section_number: string; enrollment_cap: number; modality: string; time: string }[];
}

// Analytics-only rotation types (historical view)
export interface RotationColumn {
  academic_year: string;
  semester: string;
  term_id: number | null;
}

export interface RotationCell {
  offered: boolean;
  num_sections: number;
  total_enrollment: number;
  source: "scheduled" | "historical";
}

export interface CourseRotationAnalyticsResponse {
  courses: { id: number; department_code: string; course_number: string; title: string; credits: number }[];
  columns: RotationColumn[];
  grid: Record<string, RotationCell>;
  gaps: { course_id: number; department_code: string; course_number: string; semester: string; last_missing_year: string; consecutive_terms: number }[];
}

// ---------------------------------------------------------------------------
// Prerequisites types
// ---------------------------------------------------------------------------

export interface CoursePrerequisite {
  id: number;
  course_id: number;
  prerequisite_id: number;
  is_corequisite: boolean;
  notes: string | null;
  prerequisite_dept: string;
  prerequisite_number: string;
  prerequisite_title: string;
}

export interface PrereqGraphNode {
  id: string;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
}

export interface PrereqGraphEdge {
  id: string;
  source: string;
  target: string;
  is_corequisite: boolean;
}

export interface PrereqGraph {
  nodes: PrereqGraphNode[];
  edges: PrereqGraphEdge[];
}

export interface PrereqWarning {
  course_id: number;
  course_label: string;
  prerequisite_id: number;
  prerequisite_label: string;
  type: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Workload types
// ---------------------------------------------------------------------------

export interface LoadAdjustment {
  id: number;
  instructor_id: number;
  term_id: number;
  description: string;
  equivalent_credits: number;
  adjustment_type: string;
}

export interface WorkloadSectionRow {
  section_id: number;
  department_code: string;
  course_number: string;
  section_number: string;
  title: string;
  actual_credits: number;
  equivalent_credits: number;
  enrollment_cap: number;
  sch: number;
  modality: string;
  schedule_info: string;
  status: string;
  counts_toward_load: boolean;
}

export interface WorkloadAdjustmentRow {
  id: number;
  description: string;
  equivalent_credits: number;
  adjustment_type: string;
}

export interface InstructorWorkload {
  instructor_id: number;
  name: string;
  last_name: string;
  first_name: string;
  instructor_type: string | null;
  department: string;
  max_credits: number;
  section_count: number;
  sections: WorkloadSectionRow[];
  adjustments: WorkloadAdjustmentRow[];
  total_teaching_credits: number;
  total_equivalent_credits: number;
  total_sch: number;
  is_overloaded: boolean;
}

export interface WorkloadResponse {
  instructors: InstructorWorkload[];
  unassigned_sections: WorkloadSectionRow[];
  term_totals: {
    total_instructors: number;
    total_teaching_credits: number;
    total_sch: number;
    overloaded_count: number;
  };
}
