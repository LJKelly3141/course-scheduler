import { useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, Section, Instructor, ValidationResult, ConflictItem, AcademicYear, PrereqWarning } from "../api/types";
import { Badge } from "@/components/ui/badge";
import { warningKey } from "../components/conflicts/ConflictSidebar";
import {
  Lock,
  BookOpen,
  GraduationCap,
  Users,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  CirclePlus,
} from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";

interface AnalyticsSummary {
  avg_annual_sch: number;
  sch_per_fte: number;
  avg_annual_fte: number;
  num_years: number;
}

interface CourseForecast {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  forecast_enrollment: number;
  forecast_sections: number;
  avg_section_size: number;
  trend: string;
  confidence: string;
}

interface MissingCourse {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  credits: number;
  times_offered: number;
}

export function DashboardPage() {
  const { selectedTerm, isReadOnly } = useOutletContext<{
    selectedTerm: Term | null;
    isReadOnly: boolean;
  }>();
  const queryClient = useQueryClient();

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: validation } = useQuery({
    queryKey: ["validation", selectedTerm?.id],
    queryFn: () => api.get<ValidationResult>(`/terms/${selectedTerm!.id}/validate`),
    enabled: !!selectedTerm,
  });

  const { data: dismissedKeys = [] } = useQuery({
    queryKey: ["dismissed-warnings", selectedTerm?.id],
    queryFn: () => api.get<string[]>(`/terms/${selectedTerm!.id}/dismissed-warnings`),
    enabled: !!selectedTerm,
  });
  const dismissedSet = new Set(dismissedKeys);

  const dismissMutation = useMutation({
    mutationFn: (key: string) =>
      api.post(`/terms/${selectedTerm!.id}/dismissed-warnings`, { warning_key: key }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dismissed-warnings"] }),
  });

  const undismissMutation = useMutation({
    mutationFn: (key: string) =>
      api.delete(`/terms/${selectedTerm!.id}/dismissed-warnings/${encodeURIComponent(key)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dismissed-warnings"] }),
  });

  const { data: currentAY } = useQuery({
    queryKey: ["current-academic-year"],
    queryFn: () => api.get<AcademicYear | null>("/academic-years/current"),
  });

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary", selectedTerm?.id],
    queryFn: () => api.get<AnalyticsSummary>(`/analytics/summary?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: forecastData } = useQuery({
    queryKey: ["analytics-forecast", selectedTerm?.id],
    queryFn: () => api.get<{ forecasts: CourseForecast[] }>(`/analytics/enrollment-forecast?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: missingData } = useQuery({
    queryKey: ["analytics-missing", selectedTerm?.id],
    queryFn: () => api.get<{ courses: MissingCourse[] }>(`/analytics/missing-courses?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: prereqWarnings } = useQuery({
    queryKey: ["prerequisites", "warnings", selectedTerm?.id],
    queryFn: () => api.get<{ warnings: PrereqWarning[] }>(`/prerequisites/warnings?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground">Select a term to view the dashboard.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{selectedTerm.name}</h2>
        <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const totalSections = sections.length;
  const totalCredits = sections.reduce((sum, s) => sum + (s.course?.credits ?? 0), 0);
  const assignedIds = new Set(sections.filter((s) => s.instructor_id).map((s) => s.instructor_id));
  const instructorsAssigned = instructors.filter((i) => i.is_active && assignedIds.has(i.id)).length;

  const hardConflicts = validation?.hard_conflicts ?? [];
  const softWarnings = validation?.soft_warnings ?? [];
  const activeWarnings = softWarnings.filter((w) => !dismissedSet.has(warningKey(w)));
  const dismissed = softWarnings.filter((w) => dismissedSet.has(warningKey(w)));

  // Projected SCH: sum(forecast_enrollment * credits) for courses in term
  const forecasts = forecastData?.forecasts ?? [];
  const projectedSCH = forecasts.reduce((sum, f) => {
    const course = sections.find((s) => s.course_id === f.course_id)?.course;
    return sum + f.forecast_enrollment * (course?.credits ?? 3);
  }, 0);

  const schPerFte = summary?.sch_per_fte ?? 0;
  const missingCourses = missingData?.courses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{selectedTerm.name}</h2>
        {selectedTerm.academic_year && (
          <Badge variant="outline" className="text-xs font-normal">
            {selectedTerm.academic_year.label}
          </Badge>
        )}
        {isReadOnly && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}
      </div>
      {currentAY && (
        <p className="text-sm text-muted-foreground -mt-4">
          Current Academic Year: <span className="font-medium">{currentAY.label}</span>
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card icon={BookOpen} accent="#3b82f6" value={totalSections} label="Sections" />
        <Card icon={GraduationCap} accent="#8b5cf6" value={totalCredits} label="Credits Offered" />
        <Card icon={Users} accent="#0ea5e9" value={instructorsAssigned} label="Instructors" />
        <Card
          icon={TrendingUp}
          accent="#14b8a6"
          value={projectedSCH > 0 ? projectedSCH.toLocaleString() : "—"}
          label="Projected SCH"
        />
        <Card
          icon={TrendingUp}
          accent="#f59e0b"
          value={schPerFte > 0 ? schPerFte.toLocaleString() : "—"}
          label="SCH / FTE"
          sub="historical avg"
        />
        <Card
          icon={AlertCircle}
          accent={hardConflicts.length > 0 ? "#ef4444" : "#22c55e"}
          value={hardConflicts.length}
          label="Conflicts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conflicts & Warnings */}
        <div className="bg-card rounded-lg border border-border p-5 max-h-[500px] overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3">Conflicts & Warnings</h3>

          {hardConflicts.length === 0 && activeWarnings.length === 0 && dismissed.length === 0 && (
            <p className="text-xs text-muted-foreground">No issues found.</p>
          )}

          {hardConflicts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-destructive mb-2">
                Hard Conflicts ({hardConflicts.length})
              </p>
              {hardConflicts.map((c, i) => (
                <ConflictRow key={i} item={c} variant="hard" />
              ))}
            </div>
          )}

          {activeWarnings.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                Warnings ({activeWarnings.length})
              </p>
              {activeWarnings.map((w, i) => (
                <ConflictRow
                  key={i}
                  item={w}
                  variant="warning"
                  onDismiss={() => dismissMutation.mutate(warningKey(w))}
                />
              ))}
            </div>
          )}

          {dismissed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Dismissed ({dismissed.length})
              </p>
              {dismissed.map((w, i) => (
                <ConflictRow
                  key={i}
                  item={w}
                  variant="dismissed"
                  onRestore={() => undismissMutation.mutate(warningKey(w))}
                />
              ))}
            </div>
          )}

          {(prereqWarnings?.warnings?.length ?? 0) > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                Prerequisite Warnings ({prereqWarnings!.warnings.length})
              </p>
              {prereqWarnings!.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 py-1 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing courses */}
        <div className="bg-card rounded-lg border border-border p-5 max-h-[500px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <CirclePlus className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Historically Offered Courses Not in Term</h3>
            <HelpTooltip content="Courses offered in previous terms of this type that don't have sections in the current term" side="right" />
          </div>
          {missingCourses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All historically offered courses are included in this term.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Course</th>
                  <th className="pb-2 pr-3">Title</th>
                  <th className="pb-2 pr-3 text-right">Cr</th>
                  <th className="pb-2 text-right">Times Offered</th>
                </tr>
              </thead>
              <tbody>
                {missingCourses.map((c) => (
                  <tr key={c.course_id} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                      {c.department_code} {c.course_number}
                    </td>
                    <td className="py-1.5 pr-3 truncate max-w-[200px]">{c.title}</td>
                    <td className="py-1.5 pr-3 text-right">{c.credits}</td>
                    <td className="py-1.5 text-right">{c.times_offered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Courses scheduled with projected enrollment */}
      <CourseTable sections={sections} forecasts={forecasts} />
    </div>
  );
}

function CourseTable({ sections, forecasts }: { sections: Section[]; forecasts: CourseForecast[] }) {
  // Group sections by course_id
  const courseMap = new Map<number, { dept: string; num: string; title: string; credits: number; sectionCount: number; totalCap: number }>();
  for (const s of sections) {
    const cid = s.course_id;
    const existing = courseMap.get(cid);
    if (existing) {
      existing.sectionCount += 1;
      existing.totalCap += s.enrollment_cap ?? 0;
    } else {
      courseMap.set(cid, {
        dept: s.course?.department_code ?? "",
        num: s.course?.course_number ?? "",
        title: s.course?.title ?? "",
        credits: s.course?.credits ?? 0,
        sectionCount: 1,
        totalCap: s.enrollment_cap ?? 0,
      });
    }
  }

  const forecastMap = new Map(forecasts.map((f) => [f.course_id, f]));

  const rows = [...courseMap.entries()]
    .sort(([, a], [, b]) => a.dept.localeCompare(b.dept) || a.num.localeCompare(b.num))
    .map(([cid, c]) => {
      const fc = forecastMap.get(cid);
      return { ...c, courseId: cid, forecast: fc };
    });

  const trendIcon = (trend?: string) => {
    if (trend === "growing") return "\u25B2";
    if (trend === "declining") return "\u25BC";
    return "";
  };
  const trendColor = (trend?: string) => {
    if (trend === "growing") return "text-green-600 dark:text-green-400";
    if (trend === "declining") return "text-red-500 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <h3 className="font-semibold text-sm mb-3">Courses in Term with Projected Enrollment</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No courses in this term.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-3">Course</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3 text-right">Cr</th>
                <th className="pb-2 pr-3 text-right">Sections</th>
                <th className="pb-2 pr-3 text-right">Total Cap</th>
                <th className="pb-2 pr-3 text-right">Proj. Enrollment</th>
                <th className="pb-2 text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.courseId} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {r.dept} {r.num}
                  </td>
                  <td className="py-1.5 pr-3 truncate max-w-[250px]">{r.title}</td>
                  <td className="py-1.5 pr-3 text-right">{r.credits}</td>
                  <td className="py-1.5 pr-3 text-right">{r.sectionCount}</td>
                  <td className="py-1.5 pr-3 text-right">{r.totalCap}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {r.forecast ? r.forecast.forecast_enrollment : "—"}
                  </td>
                  <td className={`py-1.5 text-right ${trendColor(r.forecast?.trend)}`}>
                    {r.forecast ? `${trendIcon(r.forecast.trend)} ${r.forecast.trend}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  accent,
  value,
  label,
  sub,
}: {
  icon: React.ElementType;
  accent: string;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border p-5 flex items-center gap-4">
      <div className="rounded-lg p-2.5 shrink-0" style={{ backgroundColor: `${accent}18` }}>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ConflictRow({
  item,
  variant,
  onDismiss,
  onRestore,
}: {
  item: ConflictItem;
  variant: "hard" | "warning" | "dismissed";
  onDismiss?: () => void;
  onRestore?: () => void;
}) {
  const bg = variant === "hard" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" : variant === "warning" ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-60";
  const textColor = variant === "hard" ? "text-destructive" : variant === "warning" ? "text-yellow-700 dark:text-yellow-400" : "text-slate-500 dark:text-slate-400";

  return (
    <div className={`mb-2 p-2 rounded border text-xs group relative ${bg}`}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-1 right-1 text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-sm leading-none px-1"
          title="Dismiss"
        >
          &times;
        </button>
      )}
      {onRestore && (
        <button
          onClick={onRestore}
          className="absolute top-1 right-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs leading-none px-1"
          title="Restore"
        >
          &#x21A9;
        </button>
      )}
      <p className={`font-medium capitalize pr-4 ${textColor}`}>
        {item.type.replace(/_/g, " ")}
      </p>
      <p className="text-muted-foreground mt-0.5">{item.description}</p>
    </div>
  );
}
