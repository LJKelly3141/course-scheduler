import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/client";
import type { Term } from "../api/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DataPoint {
  academic_year: string;
  semester: string;
  total_enrolled: number;
  total_cap: number;
  num_sections: number;
  fill_rate: number;
}

interface CourseTrend {
  course_id: number;
  department_code: string;
  course_number: string;
  title: string;
  data_points: DataPoint[];
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
  history: number[];
}

interface FillByLevel {
  level: number;
  fill_rate: number;
  enrolled: number;
  sections: number;
}

interface SlotInfo {
  top_slot: string;
  top_count: number;
  bottom_slot: string;
  bottom_count: number;
}

interface Summary {
  avg_annual_headcount: number;
  avg_annual_sch: number;
  sch_per_fte: number;
  avg_annual_fte: number;
  num_years: number;
  fill_by_level: FillByLevel[];
  mwf: SlotInfo;
  tth: SlotInfo;
}

interface HeatmapCell {
  day: string;
  hour: number;
  minute: number;
  avg_enrollment: number;
  sections: number;
  total_enrolled: number;
}

type SemesterFilter = "Fall" | "Spring" | "Summer" | "All";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FILL_GREEN = "#16a34a";
const FILL_AMBER = "#d97706";
const FILL_RED = "#dc2626";

function fillColor(rate: number): string {
  if (rate >= 0.8) return FILL_GREEN;
  if (rate >= 0.6) return FILL_AMBER;
  return FILL_RED;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AnalyticsPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const [semFilter, setSemFilter] = useState<SemesterFilter>("All");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ["analytics", "summary", selectedTerm?.id],
    queryFn: () =>
      api.get<Summary>(`/analytics/summary?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: trendsData } = useQuery({
    queryKey: ["analytics", "trends", selectedTerm?.id],
    queryFn: () =>
      api.get<{ courses: CourseTrend[] }>(
        `/analytics/enrollment-trends?term_id=${selectedTerm!.id}`,
      ),
    enabled: !!selectedTerm,
  });

  const { data: forecastData } = useQuery({
    queryKey: ["analytics", "forecast", selectedTerm?.id],
    queryFn: () =>
      api.get<{ forecasts: CourseForecast[] }>(
        `/analytics/enrollment-forecast?term_id=${selectedTerm!.id}`,
      ),
    enabled: !!selectedTerm,
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["analytics", "heatmap", selectedTerm?.id],
    queryFn: () =>
      api.get<{ cells: HeatmapCell[]; max_value: number }>(
        `/analytics/heatmap?term_id=${selectedTerm!.id}`,
      ),
    enabled: !!selectedTerm,
  });

  if (!selectedTerm) {
    return (
      <p className="text-muted-foreground">
        Select a term to view analytics.
      </p>
    );
  }

  const summary = summaryData;
  const courses = trendsData?.courses ?? [];
  const forecasts = (forecastData?.forecasts ?? []).filter(
    (f) => f.confidence !== "none",
  );
  const hasData =
    courses.length > 0 && courses.some((c) => c.data_points.length > 0);

  if (!hasData) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Enrollment Analytics</h2>
        <div className="bg-white rounded-lg border border-border p-6">
          <p className="text-muted-foreground">
            No enrollment data found. Import enrollment history from the Import
            page to see analytics.
          </p>
        </div>
      </div>
    );
  }

  // Single-course chart data
  const activeCourse =
    courses.find((c) => c.course_id === selectedCourseId) ?? courses[0];

  const singleCourseData = activeCourse
    ? activeCourse.data_points
        .filter((dp) => semFilter === "All" || dp.semester === semFilter)
        .sort((a, b) =>
          `${a.academic_year} ${a.semester}`.localeCompare(
            `${b.academic_year} ${b.semester}`,
          ),
        )
        .map((dp) => ({
          label: `${dp.academic_year} ${dp.semester}`,
          enrollment: dp.total_enrolled,
          capacity: dp.total_cap,
          sections: dp.num_sections,
          fill_rate: Math.round(dp.fill_rate * 100),
        }))
    : [];

  // Sort forecasts by enrollment descending
  const sortedForecasts = [...forecasts].sort(
    (a, b) => b.forecast_enrollment - a.forecast_enrollment,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Enrollment Analytics</h2>

      {/* ---------------------------------------------------------------- */}
      {/* 1. KPI Summary Cards                                             */}
      {/* ---------------------------------------------------------------- */}
      {summary && summary.avg_annual_headcount > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {/* Card 1: Headcount / SCH / SCH per FTE */}
          <div className="bg-white rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Annual Averages{" "}
              <span className="text-muted-foreground/60">
                ({summary.num_years} yr)
              </span>
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Headcount</span>
                <span className="font-bold text-lg">
                  {summary.avg_annual_headcount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">SCH</span>
                <span className="font-bold text-lg">
                  {summary.avg_annual_sch.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">
                  SCH / FTE
                </span>
                <span className="font-bold text-lg">{summary.sch_per_fte}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2">
              FTE = 12 credit instructor load
            </p>
          </div>

          {/* Card 2: Fill rate by level */}
          <div className="bg-white rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Fill Rate by Level{" "}
              <span className="text-muted-foreground/60">(35 = full)</span>
            </p>
            <div className="space-y-1">
              {summary.fill_by_level.map((l) => (
                <div key={l.level} className="flex items-center gap-2">
                  <span className="text-xs w-12 text-muted-foreground">
                    {l.level}-lvl
                  </span>
                  <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round(l.fill_rate * 100))}%`,
                        backgroundColor: fillColor(l.fill_rate),
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-semibold w-10 text-right"
                    style={{ color: fillColor(l.fill_rate) }}
                  >
                    {pct(l.fill_rate)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: MWF top & bottom */}
          <SlotCard title="MWF Slots" data={summary.mwf} />

          {/* Card 4: TTh top & bottom */}
          <SlotCard title="TTh Slots" data={summary.tth} />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 2. Single-Course Enrollment Trends                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">Enrollment Trends</h3>
            <select
              className="border border-border rounded-md px-2 py-1 text-sm bg-white"
              value={activeCourse?.course_id ?? ""}
              onChange={(e) => setSelectedCourseId(Number(e.target.value))}
            >
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.department_code} {c.course_number} &mdash; {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {(["All", "Fall", "Spring", "Summer"] as SemesterFilter[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setSemFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    semFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ),
            )}
          </div>
        </div>

        {singleCourseData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={singleCourseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof singleCourseData)[0];
                  return (
                    <div className="bg-white border border-border rounded-md p-2 shadow-md text-xs space-y-0.5">
                      <p className="font-medium">{d.label}</p>
                      <p>Enrolled: <strong>{d.enrollment}</strong></p>
                      <p>Capacity: {d.capacity}</p>
                      <p>Fill rate: {d.fill_rate}%</p>
                      <p>Sections: {d.sections}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="enrollment"
                name="Enrollment"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="capacity"
                name="Capacity"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">
            No data for the selected semester filter.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Enrollment Forecast                                           */}
      {/* ---------------------------------------------------------------- */}
      {sortedForecasts.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">
            Enrollment Forecast (
            {selectedTerm.type === "fall"
              ? "Fall"
              : selectedTerm.type === "spring"
                ? "Spring"
                : selectedTerm.type === "summer"
                  ? "Summer"
                  : "Fall"}
            )
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2 pr-4">History</th>
                  <th className="pb-2 pr-4 text-right">Forecast</th>
                  <th className="pb-2 pr-4 text-right">Change</th>
                  <th className="pb-2 pr-4 text-right">Sections</th>
                  <th className="pb-2 pr-4 text-right">Avg Size</th>
                  <th className="pb-2 pr-4">Trend</th>
                  <th className="pb-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {sortedForecasts.map((f) => {
                  const lastHist = f.history[0];
                  const change =
                    lastHist > 0
                      ? Math.round(
                          ((f.forecast_enrollment - lastHist) / lastHist) * 100,
                        )
                      : 0;
                  return (
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
                      <td className="py-2 pr-4">
                        <Sparkline data={f.history} />
                      </td>
                      <td
                        className="py-2 pr-4 text-right font-semibold"
                        style={{
                          color:
                            f.trend === "growing"
                              ? FILL_GREEN
                              : f.trend === "declining"
                                ? FILL_AMBER
                                : undefined,
                        }}
                      >
                        {f.forecast_enrollment}
                      </td>
                      <td className="py-2 pr-4 text-right text-xs">
                        {change > 0 ? (
                          <span className="text-green-600">+{change}%</span>
                        ) : change < 0 ? (
                          <span className="text-amber-600">{change}%</span>
                        ) : (
                          <span className="text-muted-foreground">0%</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {f.forecast_sections}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {f.avg_section_size}
                      </td>
                      <td className="py-2 pr-4">
                        <TrendBadge trend={f.trend} />
                      </td>
                      <td className="py-2">
                        <ConfidenceBadge confidence={f.confidence} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. Time Slot Heatmap                                             */}
      {/* ---------------------------------------------------------------- */}
      {heatmapData && heatmapData.cells.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">
            Time Slot Usage{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (avg enrollment per section)
            </span>
          </h3>
          <TimetableHeatmap
            cells={heatmapData.cells}
            maxValue={heatmapData.max_value}
          />
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SlotCard({ title, data }: { title: string; data: SlotInfo }) {
  return (
    <div className="bg-white rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground font-medium mb-2">{title}</p>
      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-green-600 font-medium uppercase tracking-wider">
            Most Used
          </p>
          <p className="text-sm font-semibold">{data.top_slot}</p>
          <p className="text-xs text-muted-foreground">
            {data.top_count} sections
          </p>
        </div>
        <div className="border-t border-border/50 pt-2">
          <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">
            Least Used
          </p>
          <p className="text-sm font-semibold">{data.bottom_slot}</p>
          <p className="text-xs text-muted-foreground">
            {data.bottom_count} sections
          </p>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  // data is most-recent-first, reverse for chronological display
  const points = [...data].reverse().map((v, i) => ({ i, v }));
  if (points.length < 2) {
    return (
      <span className="text-xs text-muted-foreground">
        {data.join(" \u2192 ")}
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-2">
      <ResponsiveContainer width={80} height={24}>
        <LineChart data={points}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="#2563EB"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <span className="text-xs text-muted-foreground tabular-nums">
        {data[0]}
      </span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "growing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        &#8593; Growing
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        &#8595; Declining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      &#8596; Stable
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        High
      </span>
    );
  }
  if (confidence === "medium") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        Medium
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Low
    </span>
  );
}

// ---------------------------------------------------------------------------
// Timetable Heatmap
// ---------------------------------------------------------------------------
const HEATMAP_DAYS = ["M", "T", "W", "Th", "F"];
const HEATMAP_DAY_LABELS: Record<string, string> = {
  M: "Mon",
  T: "Tue",
  W: "Wed",
  Th: "Thu",
  F: "Fri",
};
const HEATMAP_START_HOUR = 7;
const HEATMAP_END_HOUR = 21;

function heatColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "#f9fafb"; // gray-50
  const intensity = count / max;
  // Scale from light blue to dark blue
  if (intensity > 0.75) return "#1e40af"; // blue-800
  if (intensity > 0.5) return "#2563eb";  // blue-600
  if (intensity > 0.25) return "#60a5fa"; // blue-400
  return "#bfdbfe";                       // blue-200
}

function formatSlotTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function TimetableHeatmap({
  cells,
  maxValue,
}: {
  cells: HeatmapCell[];
  maxValue: number;
}) {
  // Build lookups: "day-hour-minute" -> cell data
  const lookup = new Map<string, HeatmapCell>();
  for (const c of cells) {
    lookup.set(`${c.day}-${c.hour}-${c.minute}`, c);
  }

  // Generate 30-min slots
  const slots: { hour: number; minute: number }[] = [];
  for (let h = HEATMAP_START_HOUR; h < HEATMAP_END_HOUR; h++) {
    slots.push({ hour: h, minute: 0 });
    slots.push({ hour: h, minute: 30 });
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 w-16" />
              {HEATMAP_DAYS.map((d) => (
                <th
                  key={d}
                  className="p-1 text-center font-medium text-muted-foreground"
                  style={{ minWidth: 72 }}
                >
                  {HEATMAP_DAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map(({ hour, minute }) => (
              <tr key={`${hour}-${minute}`}>
                <td className="pr-2 py-0 text-right text-muted-foreground whitespace-nowrap text-[10px]">
                  {minute === 0 ? formatSlotTime(hour, minute) : ""}
                </td>
                {HEATMAP_DAYS.map((day) => {
                  const cell = lookup.get(`${day}-${hour}-${minute}`);
                  const avg = cell?.avg_enrollment ?? 0;
                  const displayVal = avg > 0 ? Math.round(avg) : 0;
                  return (
                    <td
                      key={day}
                      className="p-0"
                      title={
                        cell
                          ? `${HEATMAP_DAY_LABELS[day]} ${formatSlotTime(hour, minute)}: ${Math.round(avg)} avg enrollment / section (${cell.sections} sections, ${cell.total_enrolled} total)`
                          : `${HEATMAP_DAY_LABELS[day]} ${formatSlotTime(hour, minute)}: no data`
                      }
                    >
                      <div
                        className="border border-white/60 flex items-center justify-center"
                        style={{
                          backgroundColor: heatColor(avg, maxValue),
                          height: 18,
                          color: avg > maxValue * 0.5 ? "white" : avg > 0 ? "#1e3a5f" : "transparent",
                          fontSize: 10,
                          fontWeight: avg > 0 ? 600 : 400,
                        }}
                      >
                        {displayVal > 0 ? displayVal : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>Lower</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
          <div
            key={intensity}
            className="w-4 h-4 rounded-sm border border-border/30"
            style={{
              backgroundColor: heatColor(
                intensity * maxValue,
                maxValue,
              ),
            }}
          />
        ))}
        <span>Higher</span>
        <span className="ml-2 text-muted-foreground/60">
          (max: {Math.round(maxValue)} students/section)
        </span>
      </div>
    </div>
  );
}
