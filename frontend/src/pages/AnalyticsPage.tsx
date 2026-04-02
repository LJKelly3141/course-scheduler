import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StyledSelect } from "@/components/ui/styled-select";
import { api } from "@/api/client";
import type { Term, Course, Section, PrereqWarning } from "@/api/types";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { CourseDetailTab } from "@/components/analytics/CourseDetailTab";
import { ScheduleOpsTab } from "@/components/analytics/ScheduleOpsTab";
import { WorkloadTab } from "@/components/analytics/WorkloadTab";
import { PrerequisiteGraph } from "@/components/courses/PrerequisiteGraph";

export function AnalyticsPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const [department, setDepartment] = useState<string>("");
  const [level, setLevel] = useState<string>("");

  // Fetch courses to populate department/level filters
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const departments = useMemo(() => {
    if (!courses) return [];
    return [...new Set(courses.map((c) => c.department_code))].sort();
  }, [courses]);

  const levels = useMemo(() => {
    if (!courses) return [];
    const lvls = new Set<number>();
    for (const c of courses) {
      try {
        lvls.add(parseInt(c.course_number[0]) * 100);
      } catch {
        // skip
      }
    }
    return [...lvls].sort();
  }, [courses]);

  if (!selectedTerm) {
    return (
      <p className="text-muted-foreground">
        Select a term to view analytics.
      </p>
    );
  }

  // Sections for the selected term (to know which courses are offered)
  const { data: sections } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const offeredCourseIds = useMemo(() => {
    if (!sections) return new Set<number>();
    return new Set(sections.map((s) => s.course_id));
  }, [sections]);

  // Prerequisite warnings
  const { data: prereqWarnings } = useQuery({
    queryKey: ["prerequisites", "warnings", selectedTerm?.id],
    queryFn: () =>
      api.get<{ warnings: PrereqWarning[] }>(
        `/prerequisites/warnings?term_id=${selectedTerm!.id}`
      ),
    enabled: !!selectedTerm,
  });

  const deptFilter = department || undefined;
  const levelFilter = level ? parseInt(level) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Analytics</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-department-filter" className="sr-only">Department</label>
          <StyledSelect
            id="analytics-department-filter"
            className="text-sm"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </StyledSelect>
          <label htmlFor="analytics-level-filter" className="sr-only">Level</label>
          <StyledSelect
            id="analytics-level-filter"
            className="text-sm"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">All Levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}-level
              </option>
            ))}
          </StyledSelect>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="course-detail">Course Detail</TabsTrigger>
          <TabsTrigger value="schedule-ops">Schedule Ops</TabsTrigger>
          <TabsTrigger value="prerequisites">Prerequisites</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            termId={selectedTerm.id}
            department={deptFilter}
            level={levelFilter}
          />
        </TabsContent>

        <TabsContent value="course-detail" className="mt-4">
          <CourseDetailTab
            termId={selectedTerm.id}
            department={deptFilter}
            level={levelFilter}
          />
        </TabsContent>

        <TabsContent value="schedule-ops" className="mt-4">
          <ScheduleOpsTab termId={selectedTerm.id} />
        </TabsContent>

        <TabsContent value="prerequisites" className="mt-4">
          <div className="space-y-4">
            {(prereqWarnings?.warnings?.length ?? 0) > 0 && (
              <div className="bg-warning border border-warning rounded-lg p-4" aria-live="polite">
                <h3 className="font-semibold text-warning-foreground mb-2">
                  Prerequisite Warnings
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-warning-foreground">
                  {prereqWarnings!.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <PrerequisiteGraph
              department={deptFilter}
              offeredCourseIds={offeredCourseIds}
            />
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-3 rounded bg-green-100 border border-green-500" /> Offered this term
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-3 rounded bg-gray-100 border border-gray-300" /> Not offered
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-8 border-t-2 border-gray-400 border-dashed" /> Corequisite
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="workload" className="mt-4">
          <WorkloadTab termId={selectedTerm.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
