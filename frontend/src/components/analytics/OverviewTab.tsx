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
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useState } from "react";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { KpiCards } from "./KpiCards";
import { FillRateHeatmap } from "./FillRateHeatmap";
import { fillColor, pct, FILL_GREEN, FILL_AMBER, FILL_RED } from "./analyticsHelpers";
import type {
  AnalyticsSummary,
  AggregateTrend,
  YoyChanges,
  FillHeatmapResponse,
} from "@/api/types";

interface Props {
  termId: number;
  department?: string;
  level?: number;
}

export function OverviewTab({ termId, department, level }: Props) {
  const [trendMode, setTrendMode] = useState<"headcount" | "sch">("headcount");

  const deptParam = department ? `&department=${department}` : "";
  const levelParam = level != null ? `&level=${level}` : "";
  const filters = deptParam + levelParam;

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["analytics", "summary", termId, department, level],
    queryFn: () =>
      api.get<AnalyticsSummary>(
        `/analytics/summary?term_id=${termId}${filters}`
      ),
  });

  const { data: trendsAgg, isLoading: loadingTrends } = useQuery({
    queryKey: ["analytics", "trends-agg", termId, department, level],
    queryFn: () =>
      api.get<{ data_points: AggregateTrend[] }>(
        `/analytics/enrollment-trends?term_id=${termId}&aggregate=true${filters}`
      ),
  });

  const { data: yoyData } = useQuery({
    queryKey: ["analytics", "yoy", termId],
    queryFn: () =>
      api.get<YoyChanges>(`/analytics/yoy-changes?term_id=${termId}`),
  });

  const { data: fillHeatmap } = useQuery({
    queryKey: ["analytics", "fill-heatmap", termId, department, level],
    queryFn: () =>
      api.get<FillHeatmapResponse>(
        `/analytics/course-fill-heatmap?term_id=${termId}${filters}`
      ),
  });

  if (loadingSummary || loadingTrends) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading overview...</span>
      </div>
    );
  }

  if (!summary || !summary.total_enrolled) {
    return (
      <p className="text-muted-foreground py-8">
        No enrollment data found. Import enrollment history from the Import page
        to see analytics.
      </p>
    );
  }

  const trendData = (trendsAgg?.data_points ?? []).map((dp) => ({
    label: `${dp.academic_year} ${dp.semester.charAt(0)}`,
    headcount: dp.total_enrolled,
    sch: dp.total_sch,
    capacity: dp.total_cap,
    fill_rate: Math.round(dp.fill_rate * 100),
  }));

  // YoY bar data
  const yoyBars = [
    ...(yoyData?.top_growers ?? []).map((g) => ({
      label: g.label,
      value: g.yoy_pct,
      fill: FILL_GREEN,
    })),
    ...(yoyData?.top_decliners ?? []).map((d) => ({
      label: d.label,
      value: d.yoy_pct,
      fill: FILL_RED,
    })),
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6" aria-live="polite">
      {/* KPI Cards */}
      <KpiCards
        items={[
          {
            label: "Total Enrolled",
            value: summary.total_enrolled,
            sub: "latest same semester",
          },
          {
            label: "Total Seats",
            value: summary.total_seats,
          },
          {
            label: "Fill Rate",
            value: pct(summary.fill_rate),
          },
          {
            label: "Credit Hours (SCH)",
            value: summary.total_sch,
          },
          {
            label: "YoY Change",
            value: `${summary.yoy_enrolled_change > 0 ? "+" : ""}${summary.yoy_enrolled_change}%`,
            sub: "vs prior year",
          },
        ]}
      />

      {/* Enrollment Over Terms - Line Chart */}
      {trendData.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Enrollment Over Terms</h3>
            <div className="flex gap-1">
              {(["headcount", "sch"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTrendMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    trendMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {mode === "headcount" ? "Headcount" : "SCH"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey={trendMode}
                name={trendMode === "headcount" ? "Enrollment" : "SCH"}
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {trendMode === "headcount" && (
                <Line
                  type="monotone"
                  dataKey="capacity"
                  name="Capacity"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={{ r: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top/Bottom YoY Changes - Horizontal Bar Chart */}
      {yoyBars.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Year-over-Year Changes</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, yoyBars.length * 36)}>
            <BarChart data={yoyBars} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="%" />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [`${value}%`, "YoY Change"]}
              />
              <Bar dataKey="value" name="YoY %" radius={[0, 4, 4, 0]}>
                {yoyBars.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Course x Term Fill Rate Heatmap */}
      {fillHeatmap && fillHeatmap.courses.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Course x Term Fill Rate</h3>
          <FillRateHeatmap
            courses={fillHeatmap.courses}
            terms={fillHeatmap.terms}
            cells={fillHeatmap.cells}
          />
        </div>
      )}

      {/* Courses Needing Attention */}
      {summary.courses_needing_attention.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Courses Needing Attention</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {summary.courses_needing_attention.map((c) => (
                  <tr
                    key={c.course_id}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {c.department_code} {c.course_number}
                      <span className="text-muted-foreground font-normal ml-2 text-xs">
                        {c.title}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {c.flags.map((flag) => (
                          <Badge
                            key={flag}
                            className={
                              flag === "over_capacity"
                                ? "bg-destructive/10 text-destructive border-destructive"
                                : flag === "cancel_risk"
                                  ? "bg-warning text-warning-foreground border-warning"
                                  : "bg-info text-info-foreground border-info"
                            }
                          >
                            {flag === "over_capacity"
                              ? "Over Capacity"
                              : flag === "cancel_risk"
                                ? "Cancel Risk"
                                : "High Volatility"}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
