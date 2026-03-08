interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
}

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-card rounded-lg border border-border p-4"
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">
            {item.label}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {typeof item.value === "number"
              ? item.value.toLocaleString()
              : item.value}
          </p>
          {item.sub && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
