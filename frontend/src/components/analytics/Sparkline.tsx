import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

export function Sparkline({ data }: { data: number[] }) {
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
            stroke="var(--primary)"
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
