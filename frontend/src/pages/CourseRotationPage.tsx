import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Save,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Copy,
  Download,
} from "lucide-react";
import { StyledSelect } from "@/components/ui/styled-select";
import { ImportFromTermDialog, type TermExtractEntry } from "@/components/rotation/ImportFromTermDialog";
import { InstructorSelectionStep, type TermInstructorsResult } from "@/components/rotation/InstructorSelectionStep";
import type {
  Term,
  Course,
  Instructor,
  Room,
  RotationEntry,
  ApplyRotationResult,
  TimeBlock,
} from "@/api/types";

const SEMESTERS = ["fall", "spring", "summer", "winter"] as const;
export const SEMESTER_LABELS: Record<string, string> = {
  fall: "Fall",
  spring: "Spring",
  summer: "Summer",
  winter: "Winter",
};
const PARITY_OPTIONS = [
  { value: "every_year", label: "Every Year" },
  { value: "even_years", label: "Even Years" },
  { value: "odd_years", label: "Odd Years" },
];
const PARITY_LABELS: Record<string, string> = {
  every_year: "Every Year",
  even_years: "Even Years",
  odd_years: "Odd Years",
};
const PARITY_DOT: Record<string, string> = {
  every_year: "bg-green-500",
  even_years: "bg-blue-500",
  odd_years: "bg-purple-500",
};
const MODALITY_OPTIONS = [
  { value: "in_person", label: "In Person" },
  { value: "online_async", label: "Online Async" },
  { value: "online_sync", label: "Online Sync" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
  { value: "hyflex", label: "HyFlex" },
];
export const MODALITY_LABELS: Record<string, string> = {
  in_person: "In Person",
  online: "Online",
  online_sync: "Online Sync",
  online_async: "Online Async",
  hybrid: "Hybrid",
  hyflex: "HyFlex",
};
const SESSION_LABELS: Record<string, string> = {
  regular: "Regular",
  session_a: "Session A",
  session_b: "Session B",
  session_c: "Session C",
  session_d: "Session D",
};
const SESSION_OPTIONS = [
  { value: "", label: "None" },
  { value: "regular", label: "Regular" },
  { value: "session_a", label: "Session A" },
  { value: "session_b", label: "Session B" },
  { value: "session_c", label: "Session C" },
  { value: "session_d", label: "Session D" },
];

/** Unique key for a cell: courseId:semester */
export type CellKey = `${number}:${string}`;
export function cellKey(courseId: number, semester: string): CellKey {
  return `${courseId}:${semester}`;
}

/** One offering group within a cell */
export interface OfferingGroup {
  id?: number;
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

export type CellData = OfferingGroup[];

export function CourseRotationPage() {
  const queryClient = useQueryClient();

  const [hasChanges, setHasChanges] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyRotationResult | null>(
    null
  );
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [localGrid, setLocalGrid] = useState<Map<CellKey, CellData>>(
    new Map()
  );
  const [gridInitialized, setGridInitialized] = useState(false);

  // Track which course cards are collapsed
  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(
    new Set()
  );

  // ── Data fetching ──

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const { data: rotationEntries, isLoading } = useQuery({
    queryKey: ["rotation"],
    queryFn: () => api.get<RotationEntry[]>("/rotation"),
  });

  const { data: terms } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get<Term[]>("/terms"),
  });

  const { data: timeBlocks } = useQuery({
    queryKey: ["timeblocks"],
    queryFn: () => api.get<TimeBlock[]>("/timeblocks"),
  });

  const { data: instructors } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  // ── Initialize grid from server data ──

  useEffect(() => {
    if (rotationEntries && !gridInitialized) {
      const grid = new Map<CellKey, CellData>();
      for (const entry of rotationEntries) {
        const key = cellKey(entry.course_id, entry.semester);
        const existing = grid.get(key) || [];
        existing.push({
          id: entry.id,
          year_parity: entry.year_parity,
          num_sections: entry.num_sections,
          enrollment_cap: entry.enrollment_cap,
          modality: entry.modality,
          time_block_id: entry.time_block_id,
          time_block_label: entry.time_block_label,
          days_of_week: entry.days_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          notes: entry.notes,
          instructor_id: entry.instructor_id,
          instructor_name: entry.instructor_name,
          room_id: entry.room_id,
          room_label: entry.room_label,
          session: entry.session,
        });
        grid.set(key, existing);
      }
      setLocalGrid(grid);
      setGridInitialized(true);
    }
  }, [rotationEntries, gridInitialized]);

  // ── Unsaved changes guard ──

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ── Cmd/Ctrl+S to save ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saveMutation.isPending) {
          saveMutation.mutate();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Derived data ──

  // Course IDs that have at least one rotation entry in localGrid
  const plannedCourseIds = useMemo(() => {
    const ids = new Set<number>();
    for (const key of localGrid.keys()) {
      ids.add(parseInt(key.split(":")[0]));
    }
    return ids;
  }, [localGrid]);

  const courseMap = useMemo(() => {
    if (!courses) return new Map<number, Course>();
    return new Map(courses.map((c) => [c.id, c]));
  }, [courses]);

  // Planned courses sorted by dept + number
  const plannedCourses = useMemo(() => {
    if (!courses) return [];
    return courses
      .filter((c) => plannedCourseIds.has(c.id))
      .sort((a, b) => {
        const deptCmp = a.department_code.localeCompare(b.department_code);
        if (deptCmp !== 0) return deptCmp;
        return a.course_number.localeCompare(b.course_number);
      });
  }, [courses, plannedCourseIds]);

  // ── Grid mutation helpers ──

  const addOffering = useCallback(
    (courseId: number, semester: string, group: OfferingGroup) => {
      const key = cellKey(courseId, semester);
      setLocalGrid((prev) => {
        const next = new Map(prev);
        const existing = next.get(key) || [];
        next.set(key, [...existing, group]);
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  const updateOffering = useCallback(
    (
      courseId: number,
      semester: string,
      index: number,
      updates: Partial<OfferingGroup>
    ) => {
      const key = cellKey(courseId, semester);
      setLocalGrid((prev) => {
        const next = new Map(prev);
        const groups = [...(next.get(key) || [])];
        if (groups[index]) {
          groups[index] = { ...groups[index], ...updates };
          next.set(key, groups);
        }
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  const removeOffering = useCallback(
    (courseId: number, semester: string, index: number) => {
      const key = cellKey(courseId, semester);
      setLocalGrid((prev) => {
        const next = new Map(prev);
        const groups = [...(next.get(key) || [])];
        groups.splice(index, 1);
        if (groups.length === 0) {
          next.delete(key);
        } else {
          next.set(key, groups);
        }
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  /** Remove all offerings for a course */
  const removeCourseFromPlan = useCallback((courseId: number) => {
    setLocalGrid((prev) => {
      const next = new Map(prev);
      for (const key of [...next.keys()]) {
        if (key.startsWith(`${courseId}:`)) {
          next.delete(key);
        }
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  /** Copy an offering to another semester */
  const copyToSemester = useCallback(
    (courseId: number, group: OfferingGroup, targetSemester: string) => {
      const key = cellKey(courseId, targetSemester);
      setLocalGrid((prev) => {
        const next = new Map(prev);
        const existing = next.get(key) || [];
        next.set(key, [...existing, { ...group, id: undefined }]);
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  /** Add a course to the plan with a default offering */
  const addCourseToPlan = useCallback(
    (courseId: number) => {
      // Add a default fall offering
      addOffering(courseId, "fall", {
        year_parity: "every_year",
        num_sections: 1,
        enrollment_cap: 30,
        modality: "in_person",
        time_block_id: null,
        time_block_label: null,
        days_of_week: null,
        start_time: null,
        end_time: null,
        notes: null,
        instructor_id: null,
        instructor_name: null,
        room_id: null,
        room_label: null,
        session: null,
      });
      // Make sure the card is expanded
      setCollapsedCourses((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    },
    [addOffering]
  );

  /** Import entries from a term schedule into the grid */
  const importEntries = useCallback(
    (entries: TermExtractEntry[]) => {
      setLocalGrid((prev) => {
        const next = new Map(prev);
        // Clear existing entries for imported courses in this semester
        // so re-importing replaces rather than duplicates
        const importedKeys = new Set<CellKey>();
        for (const e of entries) {
          importedKeys.add(cellKey(e.course_id, e.semester));
        }
        for (const key of importedKeys) {
          next.delete(key);
        }
        for (const e of entries) {
          const key = cellKey(e.course_id, e.semester);
          const existing = next.get(key) || [];
          next.set(key, [
            ...existing,
            {
              year_parity: e.year_parity,
              num_sections: e.num_sections,
              enrollment_cap: e.enrollment_cap,
              modality: e.modality,
              time_block_id: e.time_block_id,
              time_block_label: e.time_block_label,
              days_of_week: e.days_of_week,
              start_time: e.start_time,
              end_time: e.end_time,
              notes: e.notes,
              instructor_id: e.instructor_id,
              instructor_name: e.instructor_name,
              room_id: e.room_id,
              room_label: e.room_label,
              session: e.session,
            },
          ]);
        }
        return next;
      });
      // Expand imported course cards
      setCollapsedCourses((prev) => {
        const next = new Set(prev);
        for (const e of entries) {
          next.delete(e.course_id);
        }
        return next;
      });
      setHasChanges(true);
    },
    []
  );

  // ── Save ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: Record<string, unknown>[] = [];

      const courseIdsInGrid = new Set<number>();
      for (const [key, groups] of localGrid) {
        const courseId = parseInt(key.split(":")[0]);
        const semester = key.split(":")[1];
        courseIdsInGrid.add(courseId);
        for (const g of groups) {
          entries.push({
            course_id: courseId,
            semester,
            year_parity: g.year_parity,
            num_sections: g.num_sections,
            enrollment_cap: g.enrollment_cap,
            modality: g.modality,
            time_block_id: g.time_block_id,
            days_of_week: g.days_of_week,
            start_time: g.start_time,
            end_time: g.end_time,
            notes: g.notes,
            instructor_id: g.instructor_id,
            room_id: g.room_id,
            session: g.session,
          });
        }
      }

      // Delete entries for courses that were fully cleared
      if (rotationEntries) {
        const clearedCourseIds = new Set<number>();
        for (const e of rotationEntries) {
          if (!courseIdsInGrid.has(e.course_id)) {
            clearedCourseIds.add(e.course_id);
          }
        }
        for (const cid of clearedCourseIds) {
          const originalEntries = rotationEntries.filter(
            (e) => e.course_id === cid
          );
          for (const oe of originalEntries) {
            await api.delete(`/rotation/${oe.id}`);
          }
        }
      }

      if (entries.length > 0) {
        await api.post("/rotation/batch", entries);
      }
    },
    onSuccess: () => {
      setHasChanges(false);
      // Keep localGrid as-is — it already reflects what was saved.
      // Invalidate the query cache so rotationEntries stays in sync
      // for future operations (e.g., detecting cleared courses on next save).
      queryClient.invalidateQueries({ queryKey: ["rotation"] });
    },
    onError: (error: Error) => {
      alert(`Failed to save rotation plan: ${error.message}`);
    },
  });

  // ── Apply to term ──

  const applyMutation = useMutation({
    mutationFn: (params: { termId: number; includeInstructorIds?: number[] }) =>
      api.post<ApplyRotationResult>("/rotation/apply", {
        term_id: params.termId,
        include_instructor_ids: params.includeInstructorIds ?? null,
      }),
    onSuccess: (result) => {
      setApplyResult(result);
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const draftTerms = useMemo(() => {
    if (!terms) return [];
    return terms.filter((t) => t.status !== "final");
  }, [terms]);

  // ── Grand totals ──

  const grandTotals = useMemo(() => {
    let sections = 0;
    let sch = 0;
    for (const [key, groups] of localGrid) {
      const courseId = parseInt(key.split(":")[0]);
      const course = courseMap.get(courseId);
      const credits = course?.credits ?? 0;
      for (const g of groups) {
        sections += g.num_sections;
        sch += g.num_sections * g.enrollment_cap * credits;
      }
    }
    return { sections, sch, courses: plannedCourseIds.size };
  }, [localGrid, courseMap, plannedCourseIds]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading rotation plan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Course Plan</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCourse(true)}
          >
            <Plus className="size-4 mr-1" />
            Add Course
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
          >
            <Download className="size-4 mr-1" />
            Import from Term
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApplyDialog(true)}
            disabled={saveMutation.isPending}
          >
            <Play className="size-4 mr-1" />
            Apply to Term
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="size-4 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save Plan"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-warning border border-warning rounded-lg px-3 py-2 text-sm text-warning-foreground">
          You have unsaved changes. Press <strong>Ctrl+S</strong> or click{" "}
          <strong>Save Plan</strong> to persist.
        </div>
      )}

      {/* Course Cards */}
      {plannedCourses.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <p className="text-muted-foreground">
            No courses in the rotation plan yet.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddCourse(true)}
            >
              <Plus className="size-4 mr-1" />
              Add Course
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
            >
              <Download className="size-4 mr-1" />
              Import from Term
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {plannedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              localGrid={localGrid}
              timeBlocks={timeBlocks || []}
              instructors={instructors || []}
              rooms={rooms || []}
              collapsed={collapsedCourses.has(course.id)}
              onToggleCollapse={() => {
                setCollapsedCourses((prev) => {
                  const next = new Set(prev);
                  if (next.has(course.id)) next.delete(course.id);
                  else next.add(course.id);
                  return next;
                });
              }}
              onAddOffering={addOffering}
              onUpdateOffering={updateOffering}
              onRemoveOffering={removeOffering}
              onRemoveCourse={removeCourseFromPlan}
              onCopyTo={copyToSemester}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {plannedCourses.length > 0 && (
        <div className="flex gap-6 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{grandTotals.courses}</strong>{" "}
            courses planned
          </span>
          <span>
            <strong className="text-foreground">{grandTotals.sections}</strong>{" "}
            total sections
          </span>
          <span>
            <strong className="text-foreground">
              {grandTotals.sch.toLocaleString()}
            </strong>{" "}
            max SCH
          </span>
        </div>
      )}

      {/* Add Course Dialog */}
      <AddCourseDialog
        open={showAddCourse}
        onOpenChange={setShowAddCourse}
        courses={courses || []}
        plannedCourseIds={plannedCourseIds}
        onAdd={addCourseToPlan}
      />

      {/* Import from Term Dialog */}
      <ImportFromTermDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        terms={terms || []}
        onImport={importEntries}
        localGrid={localGrid}
        courseMap={courseMap}
      />

      {/* Apply to Term Dialog */}
      <ApplyToTermDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        terms={draftTerms}
        applyMutation={applyMutation}
        result={applyResult}
        onClearResult={() => setApplyResult(null)}
        hasUnsavedChanges={hasChanges}
      />
    </div>
  );
}

// ─── Course Card ────────────────────────────────────────────────────────────

function CourseCard({
  course,
  localGrid,
  timeBlocks,
  instructors,
  rooms,
  collapsed,
  onToggleCollapse,
  onAddOffering,
  onUpdateOffering,
  onRemoveOffering,
  onRemoveCourse,
  onCopyTo,
}: {
  course: Course;
  localGrid: Map<CellKey, CellData>;
  timeBlocks: TimeBlock[];
  instructors: Instructor[];
  rooms: Room[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddOffering: (
    courseId: number,
    semester: string,
    group: OfferingGroup
  ) => void;
  onUpdateOffering: (
    courseId: number,
    semester: string,
    index: number,
    updates: Partial<OfferingGroup>
  ) => void;
  onRemoveOffering: (
    courseId: number,
    semester: string,
    index: number
  ) => void;
  onRemoveCourse: (courseId: number) => void;
  onCopyTo: (
    courseId: number,
    group: OfferingGroup,
    targetSemester: string
  ) => void;
}) {
  // Count total sections across all semesters
  let totalSections = 0;
  let activeSemesters = 0;
  for (const sem of SEMESTERS) {
    const groups = localGrid.get(cellKey(course.id, sem)) || [];
    if (groups.length > 0) activeSemesters++;
    for (const g of groups) {
      totalSections += g.num_sections;
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleCollapse}
        role="button"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">
            {course.department_code} {course.course_number}
          </span>
          <span className="text-muted-foreground ml-2 text-sm">
            {course.title}
          </span>
          <span className="text-muted-foreground/60 ml-1.5 text-xs">
            ({course.credits} cr)
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {totalSections} section{totalSections !== 1 ? "s" : ""} across{" "}
            {activeSemesters} semester{activeSemesters !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCourse(course.id);
            }}
            title="Remove course from plan"
            aria-label="Remove course from plan"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Card Body */}
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {SEMESTERS.map((sem) => {
            const groups = localGrid.get(cellKey(course.id, sem)) || [];

            return (
              <SemesterSection
                key={sem}
                courseId={course.id}
                semester={sem}
                groups={groups}
                timeBlocks={timeBlocks}
                instructors={instructors}
                rooms={rooms}
                onAdd={(group) => onAddOffering(course.id, sem, group)}
                onUpdate={(index, updates) =>
                  onUpdateOffering(course.id, sem, index, updates)
                }
                onRemove={(index) => onRemoveOffering(course.id, sem, index)}
                onCopyTo={(group, targetSem) =>
                  onCopyTo(course.id, group, targetSem)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Semester Section ───────────────────────────────────────────────────────

function SemesterSection({
  courseId,
  semester,
  groups,
  timeBlocks,
  instructors,
  rooms,
  onAdd,
  onUpdate,
  onRemove,
  onCopyTo,
}: {
  courseId: number;
  semester: string;
  groups: OfferingGroup[];
  timeBlocks: TimeBlock[];
  instructors: Instructor[];
  rooms: Room[];
  onAdd: (group: OfferingGroup) => void;
  onUpdate: (index: number, updates: Partial<OfferingGroup>) => void;
  onRemove: (index: number) => void;
  onCopyTo: (group: OfferingGroup, targetSemester: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-3">
        {/* Semester label */}
        <div className="w-16 shrink-0 pt-0.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {SEMESTER_LABELS[semester]}
          </span>
        </div>

        {/* Offerings */}
        <div className="flex-1 space-y-1.5">
          {groups.length === 0 && !showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors flex items-center gap-1"
            >
              <Plus className="size-3" />
              Add {SEMESTER_LABELS[semester]} offering
            </button>
          ) : (
            <>
              {groups.map((group, idx) => (
                <OfferingRow
                  key={idx}
                  group={group}
                  currentSemester={semester}
                  timeBlocks={timeBlocks}
                  instructors={instructors}
                  rooms={rooms}
                  onUpdate={(updates) => onUpdate(idx, updates)}
                  onRemove={() => onRemove(idx)}
                  onCopyTo={(targetSem) => onCopyTo(group, targetSem)}
                />
              ))}
              {showAddForm ? (
                <InlineAddForm
                  timeBlocks={timeBlocks}
                  instructors={instructors}
                  rooms={rooms}
                  existingGroups={groups}
                  onAdd={(group) => {
                    onAdd(group);
                    setShowAddForm(false);
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="size-3" />
                  Add
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Offering Row ───────────────────────────────────────────────────────────

function OfferingRow({
  group,
  currentSemester,
  timeBlocks,
  instructors,
  rooms,
  onUpdate,
  onRemove,
  onCopyTo,
}: {
  group: OfferingGroup;
  currentSemester: string;
  timeBlocks: TimeBlock[];
  instructors: Instructor[];
  rooms: Room[];
  onUpdate: (updates: Partial<OfferingGroup>) => void;
  onRemove: () => void;
  onCopyTo: (targetSemester: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const dotColor = PARITY_DOT[group.year_parity] || "bg-gray-400";
  const timeLabel =
    group.time_block_label ||
    (group.days_of_week
      ? `${group.days_of_week} ${group.start_time?.slice(0, 5) || ""}-${group.end_time?.slice(0, 5) || ""}`
      : null);

  if (editing) {
    return (
      <InlineEditForm
        group={group}
        currentSemester={currentSemester}
        timeBlocks={timeBlocks}
        instructors={instructors}
        rooms={rooms}
        onSave={(updates) => {
          onUpdate(updates);
          setEditing(false);
        }}
        onRemove={() => {
          onRemove();
          setEditing(false);
        }}
        onCopyTo={(targetSem) => {
          onCopyTo(targetSem);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors group"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}
        title={PARITY_LABELS[group.year_parity]}
      />
      <span className="text-sm font-medium min-w-[80px]">
        {group.num_sections}× {MODALITY_LABELS[group.modality] || group.modality}
      </span>
      {timeLabel && (
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
          {timeLabel}
        </span>
      )}
      {group.room_label && (
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
          {group.room_label}
        </span>
      )}
      {group.instructor_name && (
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
          {group.instructor_name}
        </span>
      )}
      {!group.instructor_id && !group.instructor_name && (
        <span className="text-xs text-muted-foreground/50 bg-background/40 px-2 py-0.5 rounded italic">
          TBD
        </span>
      )}
      {group.session && group.session !== "regular" && (
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
          {SESSION_LABELS[group.session] || group.session}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        cap {group.enrollment_cap}
      </span>
      <span className="text-xs text-muted-foreground/60">
        · {PARITY_LABELS[group.year_parity]}
      </span>
      {group.notes && (
        <span className="text-xs text-muted-foreground/60 italic truncate max-w-[120px]">
          · {group.notes}
        </span>
      )}
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Delete offering"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Inline Add Form ────────────────────────────────────────────────────────

function InlineAddForm({
  timeBlocks,
  instructors,
  rooms,
  existingGroups,
  onAdd,
  onCancel,
}: {
  timeBlocks: TimeBlock[];
  instructors: Instructor[];
  rooms: Room[];
  existingGroups: OfferingGroup[];
  onAdd: (group: OfferingGroup) => void;
  onCancel: () => void;
}) {
  // Smart defaults: copy from existing offerings in this cell, or use sensible defaults
  const defaults = existingGroups.length > 0 ? existingGroups[0] : null;

  const [numSections, setNumSections] = useState(
    defaults?.num_sections || 1
  );
  const [enrollmentCap, setEnrollmentCap] = useState(
    defaults?.enrollment_cap || 30
  );
  const [modality, setModality] = useState(defaults?.modality || "in_person");
  const [timeBlockId, setTimeBlockId] = useState<number | null>(
    defaults?.time_block_id ?? null
  );
  const [yearParity, setYearParity] = useState(
    defaults?.year_parity || "every_year"
  );
  const [notes, setNotes] = useState("");
  const [instructorId, setInstructorId] = useState<number | null>(
    defaults?.instructor_id ?? null
  );
  const [roomId, setRoomId] = useState<number | null>(
    defaults?.room_id ?? null
  );
  const [session, setSession] = useState(defaults?.session || "");

  const selectedTb = timeBlocks.find((tb) => tb.id === timeBlockId);
  const selectedInstructor = instructors.find((i) => i.id === instructorId);
  const selectedRoom = rooms.find((r) => r.id === roomId);

  const handleSubmit = () => {
    onAdd({
      year_parity: yearParity,
      num_sections: Math.max(1, numSections),
      enrollment_cap: Math.max(1, enrollmentCap),
      modality,
      time_block_id: timeBlockId,
      time_block_label: selectedTb?.label || null,
      days_of_week: selectedTb?.days_of_week || null,
      start_time: selectedTb?.start_time || null,
      end_time: selectedTb?.end_time || null,
      notes: notes || null,
      instructor_id: instructorId,
      instructor_name: selectedInstructor?.name || null,
      room_id: roomId,
      room_label: selectedRoom
        ? `${selectedRoom.building?.abbreviation || ""} ${selectedRoom.room_number}`.trim()
        : null,
      session: session || null,
    });
  };

  return (
    <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <label htmlFor="add-sections" className="text-[11px] text-muted-foreground font-medium">
            Sections
          </label>
          <Input
            id="add-sections"
            type="number"
            min={1}
            max={20}
            value={numSections}
            onChange={(e) => setNumSections(parseInt(e.target.value) || 1)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="add-enrollment-cap" className="text-[11px] text-muted-foreground font-medium">
            Enrollment Cap
          </label>
          <Input
            id="add-enrollment-cap"
            type="number"
            min={1}
            value={enrollmentCap}
            onChange={(e) => setEnrollmentCap(parseInt(e.target.value) || 30)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="add-modality" className="text-[11px] text-muted-foreground font-medium">
            Modality
          </label>
          <StyledSelect
            id="add-modality"
            className="w-full h-8 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            {MODALITY_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-year-parity" className="text-[11px] text-muted-foreground font-medium">
            Year Parity
          </label>
          <StyledSelect
            id="add-year-parity"
            className="w-full h-8 text-sm"
            value={yearParity}
            onChange={(e) => setYearParity(e.target.value)}
          >
            {PARITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </StyledSelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="add-time-block" className="text-[11px] text-muted-foreground font-medium">
            Time Block
          </label>
          <StyledSelect
            id="add-time-block"
            className="w-full h-8 text-sm"
            value={timeBlockId ?? ""}
            onChange={(e) =>
              setTimeBlockId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">No time assigned</option>
            {timeBlocks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-notes" className="text-[11px] text-muted-foreground font-medium">
            Notes
          </label>
          <Input
            id="add-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional..."
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label htmlFor="add-instructor" className="text-[11px] text-muted-foreground font-medium">
            Instructor
          </label>
          <StyledSelect
            id="add-instructor"
            className="w-full h-8 text-sm"
            value={instructorId ?? ""}
            onChange={(e) =>
              setInstructorId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">TBD</option>
            {instructors
              .filter((i) => i.is_active)
              .sort((a, b) => (a.last_name || a.name).localeCompare(b.last_name || b.name))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.last_name ? `${i.last_name}, ${i.first_name}` : i.name}
                </option>
              ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-room" className="text-[11px] text-muted-foreground font-medium">
            Room
          </label>
          <StyledSelect
            id="add-room"
            className="w-full h-8 text-sm"
            value={roomId ?? ""}
            onChange={(e) =>
              setRoomId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">No room</option>
            {rooms
              .sort((a, b) => {
                const aLabel = `${a.building?.abbreviation || ""} ${a.room_number}`;
                const bLabel = `${b.building?.abbreviation || ""} ${b.room_number}`;
                return aLabel.localeCompare(bLabel);
              })
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.building?.abbreviation || ""} {r.room_number} ({r.capacity})
                </option>
              ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-session" className="text-[11px] text-muted-foreground font-medium">
            Session
          </label>
          <StyledSelect
            id="add-session"
            className="w-full h-8 text-sm"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          >
            {SESSION_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </StyledSelect>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={handleSubmit}>
          <Plus className="size-3 mr-1" />
          Add Offering
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Inline Edit Form ───────────────────────────────────────────────────────

function InlineEditForm({
  group,
  currentSemester,
  timeBlocks,
  instructors,
  rooms,
  onSave,
  onRemove,
  onCopyTo,
  onCancel,
}: {
  group: OfferingGroup;
  currentSemester: string;
  timeBlocks: TimeBlock[];
  instructors: Instructor[];
  rooms: Room[];
  onSave: (updates: Partial<OfferingGroup>) => void;
  onRemove: () => void;
  onCopyTo: (targetSemester: string) => void;
  onCancel: () => void;
}) {
  const [numSections, setNumSections] = useState(group.num_sections);
  const [enrollmentCap, setEnrollmentCap] = useState(group.enrollment_cap);
  const [modality, setModality] = useState(group.modality);
  const [timeBlockId, setTimeBlockId] = useState<number | null>(
    group.time_block_id
  );
  const [yearParity, setYearParity] = useState(group.year_parity);
  const [notes, setNotes] = useState(group.notes || "");
  const [instructorId, setInstructorId] = useState<number | null>(
    group.instructor_id
  );
  const [roomId, setRoomId] = useState<number | null>(group.room_id);
  const [session, setSession] = useState(group.session || "");

  const selectedTb = timeBlocks.find((tb) => tb.id === timeBlockId);
  const selectedInstructor = instructors.find((i) => i.id === instructorId);
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const otherSemesters = SEMESTERS.filter((s) => s !== currentSemester);

  const handleSave = () => {
    onSave({
      year_parity: yearParity,
      num_sections: Math.max(1, numSections),
      enrollment_cap: Math.max(1, enrollmentCap),
      modality,
      time_block_id: timeBlockId,
      time_block_label: selectedTb?.label || null,
      days_of_week: selectedTb?.days_of_week || null,
      start_time: selectedTb?.start_time || null,
      end_time: selectedTb?.end_time || null,
      notes: notes || null,
      instructor_id: instructorId,
      instructor_name: selectedInstructor?.name || null,
      room_id: roomId,
      room_label: selectedRoom
        ? `${selectedRoom.building?.abbreviation || ""} ${selectedRoom.room_number}`.trim()
        : null,
      session: session || null,
    });
  };

  return (
    <div className="border border-primary/30 rounded-md p-3 bg-primary/5 space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <label htmlFor="edit-sections" className="text-[11px] text-muted-foreground font-medium">
            Sections
          </label>
          <Input
            id="edit-sections"
            type="number"
            min={1}
            max={20}
            value={numSections}
            onChange={(e) => setNumSections(parseInt(e.target.value) || 1)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-enrollment-cap" className="text-[11px] text-muted-foreground font-medium">
            Enrollment Cap
          </label>
          <Input
            id="edit-enrollment-cap"
            type="number"
            min={1}
            value={enrollmentCap}
            onChange={(e) => setEnrollmentCap(parseInt(e.target.value) || 30)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-modality" className="text-[11px] text-muted-foreground font-medium">
            Modality
          </label>
          <StyledSelect
            id="edit-modality"
            className="w-full h-8 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            {MODALITY_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-year-parity" className="text-[11px] text-muted-foreground font-medium">
            Year Parity
          </label>
          <StyledSelect
            id="edit-year-parity"
            className="w-full h-8 text-sm"
            value={yearParity}
            onChange={(e) => setYearParity(e.target.value)}
          >
            {PARITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </StyledSelect>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="edit-time-block" className="text-[11px] text-muted-foreground font-medium">
            Time Block
          </label>
          <StyledSelect
            id="edit-time-block"
            className="w-full h-8 text-sm"
            value={timeBlockId ?? ""}
            onChange={(e) =>
              setTimeBlockId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">No time assigned</option>
            {timeBlocks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-notes" className="text-[11px] text-muted-foreground font-medium">
            Notes
          </label>
          <Input
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional..."
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label htmlFor="edit-instructor" className="text-[11px] text-muted-foreground font-medium">
            Instructor
          </label>
          <StyledSelect
            id="edit-instructor"
            className="w-full h-8 text-sm"
            value={instructorId ?? ""}
            onChange={(e) =>
              setInstructorId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">TBD</option>
            {instructors
              .filter((i) => i.is_active)
              .sort((a, b) => (a.last_name || a.name).localeCompare(b.last_name || b.name))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.last_name ? `${i.last_name}, ${i.first_name}` : i.name}
                </option>
              ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-room" className="text-[11px] text-muted-foreground font-medium">
            Room
          </label>
          <StyledSelect
            id="edit-room"
            className="w-full h-8 text-sm"
            value={roomId ?? ""}
            onChange={(e) =>
              setRoomId(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">No room</option>
            {rooms
              .sort((a, b) => {
                const aLabel = `${a.building?.abbreviation || ""} ${a.room_number}`;
                const bLabel = `${b.building?.abbreviation || ""} ${b.room_number}`;
                return aLabel.localeCompare(bLabel);
              })
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.building?.abbreviation || ""} {r.room_number} ({r.capacity})
                </option>
              ))}
          </StyledSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-session" className="text-[11px] text-muted-foreground font-medium">
            Session
          </label>
          <StyledSelect
            id="edit-session"
            className="w-full h-8 text-sm"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          >
            {SESSION_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </StyledSelect>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
          Save
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={onRemove}
        >
          <Trash2 className="size-3 mr-1" />
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">Copy to:</span>
        {otherSemesters.map((sem) => (
          <Button
            key={sem}
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => onCopyTo(sem)}
          >
            <Copy className="size-2.5 mr-0.5" />
            {SEMESTER_LABELS[sem]}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Add Course Dialog ──────────────────────────────────────────────────────

function AddCourseDialog({
  open,
  onOpenChange,
  courses,
  plannedCourseIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  plannedCourseIds: Set<number>;
  onAdd: (courseId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch("");
    }
  }, [open]);

  const availableCourses = useMemo(() => {
    const unplanned = courses.filter((c) => !plannedCourseIds.has(c.id));
    if (!search) return unplanned.slice(0, 50);
    const q = search.toLowerCase();
    return unplanned
      .filter(
        (c) =>
          c.department_code.toLowerCase().includes(q) ||
          c.course_number.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [courses, plannedCourseIds, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Course to Rotation Plan</DialogTitle>
          <DialogDescription>
            Search for a course to add to the rotation plan.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by code, number, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-border rounded-md divide-y divide-border/50">
          {availableCourses.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {search
                ? "No matching courses found."
                : "All courses are already in the plan."}
            </div>
          ) : (
            availableCourses.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-2"
                onClick={() => {
                  onAdd(c.id);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium text-sm">
                  {c.department_code} {c.course_number}
                </span>
                <span className="text-sm text-muted-foreground flex-1 truncate">
                  {c.title}
                </span>
                <span className="text-xs text-muted-foreground/60 shrink-0">
                  {c.credits} cr
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Apply to Term Dialog ────────────────────────────────────────────────────

function ApplyToTermDialog({
  open,
  onOpenChange,
  terms,
  applyMutation,
  result,
  onClearResult,
  hasUnsavedChanges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: Term[];
  applyMutation: ReturnType<
    typeof useMutation<
      ApplyRotationResult,
      Error,
      { termId: number; includeInstructorIds?: number[] }
    >
  >;
  result: ApplyRotationResult | null;
  onClearResult: () => void;
  hasUnsavedChanges: boolean;
}) {
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [step, setStep] = useState<"select" | "instructors" | "result">(
    result ? "result" : "select"
  );
  const [instructorData, setInstructorData] =
    useState<TermInstructorsResult | null>(null);
  const [includedInstructorIds, setIncludedInstructorIds] = useState<
    Set<number>
  >(new Set());
  const [loading, setLoading] = useState(false);

  // When result arrives from mutation, show result step
  const prevResult = useRef(result);
  if (result && result !== prevResult.current) {
    prevResult.current = result;
    if (step !== "result") {
      setStep("result");
    }
  }

  const goToInstructors = async () => {
    if (!selectedTermId) return;
    setLoading(true);
    try {
      const data = await api.get<TermInstructorsResult>(
        `/rotation/apply/instructors/${selectedTermId}`
      );
      setInstructorData(data);
      setIncludedInstructorIds(new Set()); // default: all TBD
      setStep("instructors");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!selectedTermId) return;
    applyMutation.mutate({
      termId: parseInt(selectedTermId),
      includeInstructorIds: Array.from(includedInstructorIds),
    });
  };

  const toggleInstructor = (id: number) => {
    setIncludedInstructorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: number[], include: boolean) => {
    setIncludedInstructorIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (include) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    onClearResult();
    setSelectedTermId("");
    setStep("select");
    setInstructorData(null);
    setIncludedInstructorIds(new Set());
    prevResult.current = null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Apply Rotation to Term"}
            {step === "instructors" && "Select Instructors to Include"}
            {step === "result" && "Apply Rotation to Term"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" &&
              "Create sections in a term based on the saved rotation plan. Only matching semester and year parity entries will be applied."}
            {step === "instructors" &&
              "Choose which instructors to include by name. Unchecked instructors will appear as TBD in the new sections."}
            {step === "result" && "Results of applying the rotation plan."}
          </DialogDescription>
        </DialogHeader>

        {hasUnsavedChanges && step !== "result" && (
          <div className="bg-warning border border-warning rounded-lg px-3 py-2 text-sm text-warning-foreground">
            You have unsaved changes. Save the plan first to apply the latest
            version.
          </div>
        )}

        {/* Step 1: Select term */}
        {step === "select" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="apply-term-select"
                className="text-sm font-medium"
              >
                Select Term
              </label>
              <StyledSelect
                id="apply-term-select"
                className="w-full h-9 text-sm"
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
              >
                <option value="">Choose a term...</option>
                {terms.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </StyledSelect>
              {terms.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No draft terms available. Create a term first.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={goToInstructors}
                disabled={!selectedTermId || loading}
              >
                {loading ? "Loading..." : "Next"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Select instructors */}
        {step === "instructors" && instructorData && (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              <strong>{instructorData.term_name}</strong> &mdash;{" "}
              {instructorData.groups.reduce(
                (sum, g) => sum + g.instructors.length,
                0
              ) + instructorData.untyped_instructors.length}{" "}
              instructor
              {instructorData.groups.reduce(
                (sum, g) => sum + g.instructors.length,
                0
              ) +
                instructorData.untyped_instructors.length !==
                1 && "s"}{" "}
              in rotation plan.{" "}
              <span className="text-muted-foreground">
                Check instructors to include by name; unchecked will be TBD.
              </span>
            </div>

            <InstructorSelectionStep
              data={instructorData}
              includedIds={includedInstructorIds}
              onToggleInstructor={toggleInstructor}
              onToggleGroup={toggleGroup}
              emptyMessage="No instructors assigned in the rotation plan for this term."
            />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select")}
              >
                Back
              </Button>
              <Button
                onClick={handleApply}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? "Applying..." : "Apply"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "result" && result && (
          <div className="space-y-3">
            <div className="bg-success border border-success rounded-lg p-3">
              <p className="text-sm font-medium text-success-foreground">
                Applied to {result.term_name}
              </p>
              <p className="text-sm text-success-foreground mt-1">
                {result.entries_matched} rotation entries matched,{" "}
                {result.sections_created} new sections created
                {result.meetings_created > 0 &&
                  `, ${result.meetings_created} meetings scheduled`}
                .
              </p>
            </div>
            {result.details.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 px-2">Course</th>
                      <th className="text-left py-1 px-2">Section</th>
                      <th className="text-left py-1 px-2">Cap</th>
                      <th className="text-left py-1 px-2">Modality</th>
                      <th className="text-left py-1 px-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.map((d, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1 px-2">{d.course}</td>
                        <td className="py-1 px-2">{d.section_number}</td>
                        <td className="py-1 px-2">{d.enrollment_cap}</td>
                        <td className="py-1 px-2">{d.modality}</td>
                        <td className="py-1 px-2 text-muted-foreground">
                          {d.time || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.sections_created === 0 && result.entries_matched > 0 && (
              <p className="text-xs text-muted-foreground">
                All matching sections already exist in this term.
              </p>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
