import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import type { CourseTrend, CourseForecast } from "@/api/types";

interface Props {
  trend: CourseTrend;
  forecast?: CourseForecast;
  height?: number;
}

export function EnrollmentTrendChart({ trend, forecast, height = 300 }: Props) {
  const chartData = trend.data_points
    .sort((a, b) =>
      `${a.academic_year} ${a.semester}`.localeCompare(
        `${b.academic_year} ${b.semester}`
      )
    )
    .map((dp) => ({
      label: `${dp.academic_year} ${dp.semester.charAt(0)}`,
      enrollment: dp.total_enrolled,
      capacity: dp.total_cap,
      fill_rate: Math.round(dp.fill_rate * 100),
      p25: forecast?.p25 ?? 0,
      p75: forecast?.p75 ?? 0,
    }));

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof chartData)[0];
            return (
              <div className="bg-popover text-popover-foreground border border-border rounded-md p-2 shadow-md text-xs space-y-0.5">
                <p className="font-medium">{d.label}</p>
                <p>
                  Enrolled: <strong>{d.enrollment}</strong>
                </p>
                <p>Capacity: {d.capacity}</p>
                <p>Fill rate: {d.fill_rate}%</p>
                {d.p25 > 0 && (
                  <p>
                    Range: {d.p25} - {d.p75}
                  </p>
                )}
              </div>
            );
          }}
        />
        <Legend />
        {forecast && forecast.p25 > 0 && (
          <Area
            type="monotone"
            dataKey="p75"
            fill="var(--chart-band, #dbeafe)"
            stroke="none"
            name="p75"
            legendType="none"
          />
        )}
        {forecast && forecast.p25 > 0 && (
          <Area
            type="monotone"
            dataKey="p25"
            fill="var(--card)"
            stroke="none"
            name="p25 range"
            legendType="none"
          />
        )}
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
      </ComposedChart>
    </ResponsiveContainer>
  );
}
