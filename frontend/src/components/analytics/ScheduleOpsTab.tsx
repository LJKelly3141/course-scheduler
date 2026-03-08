import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { TrendBadge, ConfidenceBadge } from "./ForecastBadges";
import { pct, FILL_GREEN, FILL_AMBER, FILL_RED } from "./analyticsHelpers";
import type { CourseForecast, Section, RoomPressureResponse } from "@/api/types";

interface Props {
  termId: number;
}

export function ScheduleOpsTab({ termId }: Props) {
  const { data: forecastData, isLoading: loadingForecast } = useQuery({
    queryKey: ["analytics", "forecast", termId],
    queryFn: () =>
      api.get<{ forecasts: CourseForecast[] }>(
        `/analytics/enrollment-forecast?term_id=${termId}`
      ),
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections", termId],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${termId}`),
  });

  const { data: roomPressure } = useQuery({
    queryKey: ["analytics", "room-pressure", termId],
    queryFn: () =>
      api.get<RoomPressureResponse>(
        `/analytics/room-pressure?term_id=${termId}`
      ),
  });

  if (loadingForecast) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading schedule ops...</span>
      </div>
    );
  }

  const forecasts = forecastData?.forecasts ?? [];
  const sections = sectionsData ?? [];

  // Group sections by course_id to count current sections and total cap
  const sectionsByCourse: Record<
    number,
    { count: number; totalCap: number }
  > = {};
  for (const s of sections) {
    if (!sectionsByCourse[s.course_id]) {
      sectionsByCourse[s.course_id] = { count: 0, totalCap: 0 };
    }
    sectionsByCourse[s.course_id].count += 1;
    sectionsByCourse[s.course_id].totalCap += s.enrollment_cap;
  }

  // Add Section Candidates: forecast > current capacity
  const addCandidates = forecasts
    .filter((f) => f.confidence !== "none" && f.suggested_seats > 0)
    .map((f) => {
      const current = sectionsByCourse[f.course_id] ?? {
        count: 0,
        totalCap: 0,
      };
      const shortfall = f.suggested_seats - current.totalCap;
      return {
        ...f,
        currentSections: current.count,
        currentCap: current.totalCap,
        shortfall,
      };
    })
    .filter((f) => f.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall);

  // Cancel Risk: forecast < 5 enrollment
  const cancelRisk = forecasts
    .filter(
      (f) =>
        f.confidence !== "none" &&
        f.forecast_enrollment > 0 &&
        f.forecast_enrollment < 5
    )
    .sort((a, b) => a.forecast_enrollment - b.forecast_enrollment);

  // Room pressure data
  const rpData = (roomPressure?.time_blocks ?? [])
    .filter((tb) => tb.rooms_in_use > 0)
    .map((tb) => ({
      label: tb.label,
      utilization: tb.utilization,
      rooms_in_use: tb.rooms_in_use,
      total_rooms: tb.total_rooms,
    }));

  const hasData = addCandidates.length > 0 || cancelRisk.length > 0 || rpData.length > 0;

  if (!hasData && forecasts.length === 0) {
    return (
      <p className="text-muted-foreground py-8">
        No enrollment data found. Import enrollment history from the Import page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Section Candidates */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="font-semibold mb-4">Add Section Candidates</h3>
        {addCandidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2 pr-4 text-right">Forecast</th>
                  <th className="pb-2 pr-4 text-right">Current Cap</th>
                  <th className="pb-2 pr-4 text-right">Shortfall</th>
                  <th className="pb-2 pr-4 text-right">Current Sections</th>
                  <th className="pb-2 pr-4 text-right">Suggested Sections</th>
                  <th className="pb-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {addCandidates.map((f) => (
                  <tr
                    key={f.course_id}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {f.department_code} {f.course_number}
                      <span className="text-muted-foreground font-normal ml-2 text-xs">
                        {f.title}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {f.forecast_enrollment}
                    </td>
                    <td className="py-2 pr-4 text-right">{f.currentCap}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-amber-600 dark:text-amber-400">
                      +{f.shortfall}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {f.currentSections}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      {f.suggested_sections}
                    </td>
                    <td className="py-2">
                      <ConfidenceBadge confidence={f.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No courses currently need additional sections based on forecasts.
          </p>
        )}
      </div>

      {/* Cap Recommendations */}
      <CapRecommendationsPanel
        forecasts={forecasts}
        sections={sections}
        sectionsByCourse={sectionsByCourse}
        termId={termId}
      />

      {/* Cancel Risk */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="font-semibold mb-4">Cancel Risk (Forecast &lt; 5)</h3>
        {cancelRisk.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2 pr-4 text-right">Forecast</th>
                  <th className="pb-2 pr-4">Trend</th>
                  <th className="pb-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {cancelRisk.map((f) => (
                  <tr
                    key={f.course_id}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {f.department_code} {f.course_number}
                      <span className="text-muted-foreground font-normal ml-2 text-xs">
                        {f.title}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-red-600 dark:text-red-400">
                      {f.forecast_enrollment}
                    </td>
                    <td className="py-2 pr-4">
                      <TrendBadge trend={f.trend} />
                    </td>
                    <td className="py-2">
                      <ConfidenceBadge confidence={f.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No courses currently at risk of cancellation.
          </p>
        )}
      </div>

      {/* Room Pressure */}
      {rpData.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Room Pressure by Time Block</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, rpData.length * 32)}>
            <BarChart
              data={rpData}
              layout="vertical"
              margin={{ left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                domain={[0, 1]}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  `${pct(Number(value ?? 0))}`,
                  "Utilization",
                ]}
              />
              <Bar
                dataKey="utilization"
                name="Room Utilization"
                radius={[0, 4, 4, 0]}
              >
                {rpData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.utilization > 0.85
                        ? FILL_RED
                        : entry.utilization > 0.6
                          ? FILL_AMBER
                          : FILL_GREEN
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CapRecommendationsPanel({
  forecasts,
  sections,
  sectionsByCourse,
  termId,
}: {
  forecasts: CourseForecast[];
  sections: Section[];
  sectionsByCourse: Record<number, { count: number; totalCap: number }>;
  termId: number;
}) {
  const queryClient = useQueryClient();
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const updateCapMutation = useMutation({
    mutationFn: ({ sectionId, cap }: { sectionId: number; cap: number }) =>
      api.put(`/sections/${sectionId}`, { enrollment_cap: cap }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  // Build recommendations: courses where current per-section cap differs from suggested
  const recommendations = forecasts
    .filter((f) => f.confidence !== "none" && f.suggested_seats > 0)
    .map((f) => {
      const current = sectionsByCourse[f.course_id];
      if (!current || current.count === 0) return null;
      const currentPerSection = Math.round(current.totalCap / current.count);
      const suggestedPerSection = f.suggested_sections > 0
        ? Math.round(f.suggested_seats / f.suggested_sections)
        : f.suggested_seats;
      const diff = suggestedPerSection - currentPerSection;
      if (Math.abs(diff) < 3) return null; // Skip small differences
      const courseSections = sections.filter((s) => s.course_id === f.course_id);
      return {
        ...f,
        currentPerSection,
        suggestedPerSection,
        diff,
        courseSections,
      };
    })
    .filter(Boolean) as (CourseForecast & {
      currentPerSection: number;
      suggestedPerSection: number;
      diff: number;
      courseSections: Section[];
    })[];

  const applyOne = (rec: typeof recommendations[0]) => {
    for (const s of rec.courseSections) {
      updateCapMutation.mutate({ sectionId: s.id, cap: rec.suggestedPerSection });
    }
    setAppliedIds((prev) => new Set([...prev, rec.course_id]));
  };

  const applyAll = () => {
    for (const rec of recommendations) {
      if (!appliedIds.has(rec.course_id)) {
        applyOne(rec);
      }
    }
  };

  if (recommendations.length === 0) return null;

  const unapplied = recommendations.filter((r) => !appliedIds.has(r.course_id));

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Cap Recommendations</h3>
        {unapplied.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={applyAll}
            disabled={updateCapMutation.isPending}
          >
            Apply All ({unapplied.length})
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4">Course</th>
              <th className="pb-2 pr-4 text-right">Current Cap/Sec</th>
              <th className="pb-2 pr-4 text-right">Suggested</th>
              <th className="pb-2 pr-4 text-right">Change</th>
              <th className="pb-2 pr-4">Confidence</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec) => (
              <tr key={rec.course_id} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium">
                  {rec.department_code} {rec.course_number}
                  <span className="text-muted-foreground font-normal ml-2 text-xs">
                    {rec.title}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">{rec.currentPerSection}</td>
                <td className="py-2 pr-4 text-right font-semibold">{rec.suggestedPerSection}</td>
                <td className={`py-2 pr-4 text-right font-semibold ${rec.diff > 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {rec.diff > 0 ? "+" : ""}{rec.diff}
                </td>
                <td className="py-2 pr-4">
                  <ConfidenceBadge confidence={rec.confidence} />
                </td>
                <td className="py-2">
                  {appliedIds.has(rec.course_id) ? (
                    <span className="text-xs text-green-600 dark:text-green-400">Applied</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyOne(rec)}
                      disabled={updateCapMutation.isPending}
                    >
                      Apply
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
