import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { StyledSelect } from "@/components/ui/styled-select";
import { EnrollmentTrendChart } from "./EnrollmentTrendChart";
import { TrendBadge, ConfidenceBadge } from "./ForecastBadges";
import { fillColor, pct } from "./analyticsHelpers";
import type {
  CourseTrend,
  CourseForecast,
  ModalityBreakdownResponse,
  TimeSlotAnalysis,
  Section,
} from "@/api/types";

interface Props {
  termId: number;
  department?: string;
  level?: number;
}

export function CourseDetailTab({ termId, department, level }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data: trendsData, isLoading } = useQuery({
    queryKey: ["analytics", "trends", termId],
    queryFn: () =>
      api.get<{ courses: CourseTrend[] }>(
        `/analytics/enrollment-trends?term_id=${termId}`
      ),
  });

  const { data: forecastData } = useQuery({
    queryKey: ["analytics", "forecast", termId],
    queryFn: () =>
      api.get<{ forecasts: CourseForecast[] }>(
        `/analytics/enrollment-forecast?term_id=${termId}`
      ),
  });

  const courseId = selectedCourseId ?? trendsData?.courses?.[0]?.course_id ?? null;

  const { data: modalityData } = useQuery({
    queryKey: ["analytics", "modality", termId, courseId],
    queryFn: () =>
      api.get<ModalityBreakdownResponse>(
        `/analytics/modality-breakdown?term_id=${termId}&course_id=${courseId}`
      ),
    enabled: courseId != null,
  });

  const { data: timeSlotsData } = useQuery({
    queryKey: ["analytics", "time-slots", termId],
    queryFn: () =>
      api.get<TimeSlotAnalysis>(`/analytics/time-slots?term_id=${termId}`),
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections", termId],
    queryFn: () =>
      api.get<Section[]>(`/sections?term_id=${termId}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading course detail...</span>
      </div>
    );
  }

  const courses = trendsData?.courses ?? [];
  if (courses.length === 0) {
    return (
      <p className="text-muted-foreground py-8">
        No enrollment data found. Import enrollment history from the Import page.
      </p>
    );
  }

  const activeCourse = courses.find((c) => c.course_id === courseId) ?? courses[0];
  const forecast = forecastData?.forecasts?.find(
    (f) => f.course_id === activeCourse.course_id
  );

  // Filter sections for this course
  const courseSections = (sectionsData ?? []).filter(
    (s) => s.course_id === activeCourse.course_id
  );

  // Modality fill rates for bar chart
  const modalityFill = modalityData?.modality_fill ?? [];

  // Time slot data filtered to this course
  const courseLabel = `${activeCourse.department_code} ${activeCourse.course_number}`;
  const courseTimeSlots = (timeSlotsData?.time_slots ?? []).filter((ts) =>
    ts.courses.includes(courseLabel)
  );

  // Recommendations
  const recommendations: string[] = [];
  if (forecast) {
    const currentCap = courseSections.reduce((sum, s) => sum + s.enrollment_cap, 0);
    if (forecast.suggested_seats > currentCap && currentCap > 0) {
      recommendations.push(
        `Consider adding ${forecast.suggested_seats - currentCap} seats (current: ${currentCap}, suggested: ${forecast.suggested_seats})`
      );
    }
    if (forecast.suggested_sections > courseSections.length && courseSections.length > 0) {
      recommendations.push(
        `Consider adding ${forecast.suggested_sections - courseSections.length} section(s) (current: ${courseSections.length}, suggested: ${forecast.suggested_sections})`
      );
    }
  }
  if (modalityFill.length > 1) {
    const best = [...modalityFill].sort((a, b) => b.fill_rate - a.fill_rate)[0];
    if (best.fill_rate > 0.7) {
      recommendations.push(`Best modality: ${best.modality} (${pct(best.fill_rate)} fill rate)`);
    }
  }
  if (courseTimeSlots.length > 1) {
    const best = [...courseTimeSlots].sort(
      (a, b) => b.avg_fill_rate - a.avg_fill_rate
    )[0];
    if (best.avg_fill_rate > 0.7) {
      recommendations.push(
        `Best time block: ${best.pattern} ${best.start_time}-${best.end_time} (${pct(best.avg_fill_rate)} fill rate)`
      );
    }
  }

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Course Selector + Stat Badges */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label htmlFor="course-detail-selector" className="sr-only">Select course</label>
          <StyledSelect
            id="course-detail-selector"
            className="text-sm"
            value={activeCourse.course_id}
            onChange={(e) => setSelectedCourseId(Number(e.target.value))}
          >
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.department_code} {c.course_number} — {c.title}
              </option>
            ))}
          </StyledSelect>
          {forecast && forecast.confidence !== "none" && (
            <div className="flex gap-2">
              <TrendBadge trend={forecast.trend} />
              <ConfidenceBadge confidence={forecast.confidence} />
              {forecast.cohort_fallback && (
                <Badge variant="secondary">Cohort Est.</Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enrollment Trend + p25/p75 band */}
      {activeCourse.data_points.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Enrollment Trend</h3>
          <EnrollmentTrendChart trend={activeCourse} forecast={forecast} />
        </div>
      )}

      {/* Mode Comparison - grouped bar chart */}
      {modalityFill.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Modality Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modalityFill}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="modality" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [pct(Number(value ?? 0)), "Fill Rate"]}
              />
              <Bar dataKey="fill_rate" name="Fill Rate" radius={[4, 4, 0, 0]}>
                {modalityFill.map((entry, index) => (
                  <BarChartCell
                    key={index}
                    fill={fillColor(entry.fill_rate)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Time Pattern Analysis */}
      {courseTimeSlots.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Time Pattern Analysis</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={courseTimeSlots.map((ts) => ({
                label: `${ts.pattern} ${ts.start_time}-${ts.end_time}`,
                fill_rate: ts.avg_fill_rate,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [pct(Number(value ?? 0)), "Avg Fill Rate"]}
              />
              <Bar
                dataKey="fill_rate"
                name="Avg Fill Rate"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Current Sections Table */}
      {courseSections.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Current Sections</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4">Section</th>
                <th className="pb-2 pr-4">Modality</th>
                <th className="pb-2 pr-4 text-right">Enrollment Cap</th>
                <th className="pb-2 pr-4">Instructor</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {courseSections.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{s.section_number}</td>
                  <td className="py-2 pr-4 text-xs">{s.modality}</td>
                  <td className="py-2 pr-4 text-right">{s.enrollment_cap}</td>
                  <td className="py-2 pr-4 text-xs">
                    {s.instructor?.name ?? "—"}
                  </td>
                  <td className="py-2">
                    <Badge variant="secondary">{s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-info border border-info rounded-lg p-4" aria-live="polite">
          <h3 className="font-semibold text-info-foreground mb-2">Recommendations</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-info-foreground">
            {recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Recharts Cell wrapper to avoid import name conflict
function BarChartCell({ fill }: { fill: string }) {
  return <rect fill={fill} />;
}

