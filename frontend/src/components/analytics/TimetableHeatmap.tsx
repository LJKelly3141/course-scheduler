import { ResponsiveContainer } from "recharts";

interface HeatmapCell {
  day: string;
  hour: number;
  minute: number;
  avg_enrollment: number;
  sections: number;
  total_enrolled: number;
}

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
  if (count === 0 || max === 0) return "#f9fafb";
  const intensity = count / max;
  if (intensity > 0.75) return "#1e40af";
  if (intensity > 0.5) return "#2563eb";
  if (intensity > 0.25) return "#60a5fa";
  return "#bfdbfe";
}

function formatSlotTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

export function TimetableHeatmap({
  cells,
  maxValue,
}: {
  cells: HeatmapCell[];
  maxValue: number;
}) {
  const lookup = new Map<string, HeatmapCell>();
  for (const c of cells) {
    lookup.set(`${c.day}-${c.hour}-${c.minute}`, c);
  }

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
                        className="border border-white/60 dark:border-slate-800/60 flex items-center justify-center"
                        style={{
                          backgroundColor: heatColor(avg, maxValue),
                          height: 18,
                          color:
                            avg > maxValue * 0.5
                              ? "white"
                              : avg > 0
                                ? "#1e3a5f"
                                : "transparent",
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

      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>Lower</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
          <div
            key={intensity}
            className="w-4 h-4 rounded-sm border border-border/30"
            style={{
              backgroundColor: heatColor(intensity * maxValue, maxValue),
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
