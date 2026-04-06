import { useCallback } from "react";

const DAYS = ["M", "T", "W", "Th", "F"] as const;
const DAY_LABELS: Record<string, string> = { M: "Mon", T: "Tue", W: "Wed", Th: "Thu", F: "Fri" };
const HOURS = Array.from({ length: 10 }, (_, i) => i + 7); // 7 AM to 4 PM

type SlotState = "available" | "unavailable" | "prefer_avoid";

export interface AvailabilitySlot {
  day_of_week: string;
  start_time: string;
  end_time: string;
  type: "unavailable" | "prefer_avoid";
}

interface AvailabilityGridProps {
  slots: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
  readOnly?: boolean;
}

function timeStr(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00:00`;
}

function getSlotState(
  day: string,
  hour: number,
  slots: AvailabilitySlot[]
): SlotState {
  const match = slots.find(
    (s) => s.day_of_week === day && s.start_time === timeStr(hour)
  );
  if (!match) return "available";
  return match.type;
}

const STATE_CYCLE: Record<SlotState, SlotState> = {
  available: "unavailable",
  unavailable: "prefer_avoid",
  prefer_avoid: "available",
};

const STATE_STYLES: Record<SlotState, string> = {
  available: "bg-emerald-800 text-emerald-300 hover:bg-emerald-700",
  unavailable: "bg-red-900 text-red-300 hover:bg-red-800",
  prefer_avoid: "bg-amber-900 text-amber-300 hover:bg-amber-800",
};

const STATE_ICONS: Record<SlotState, string> = {
  available: "✓",
  unavailable: "✗",
  prefer_avoid: "~",
};

export function AvailabilityGrid({ slots, onChange, readOnly }: AvailabilityGridProps) {
  const toggle = useCallback(
    (day: string, hour: number) => {
      if (readOnly) return;
      const current = getSlotState(day, hour, slots);
      const next = STATE_CYCLE[current];

      const filtered = slots.filter(
        (s) => !(s.day_of_week === day && s.start_time === timeStr(hour))
      );

      if (next !== "available") {
        filtered.push({
          day_of_week: day,
          start_time: timeStr(hour),
          end_time: timeStr(hour + 1),
          type: next,
        });
      }
      onChange(filtered);
    },
    [slots, onChange, readOnly]
  );

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-secondary">
        <span>Click to toggle:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-800 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-900 inline-block" /> Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-900 inline-block" /> Prefer to Avoid
        </span>
      </div>

      {/* Grid */}
      <div
        className="grid border border-border rounded-lg overflow-hidden text-xs"
        style={{ gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`, gap: "1px", background: "var(--color-border)" }}
      >
        {/* Header row */}
        <div className="bg-surface-alt p-2" />
        {DAYS.map((day) => (
          <div key={day} className="bg-surface-alt p-2 text-center font-semibold text-secondary">
            {DAY_LABELS[day]}
          </div>
        ))}

        {/* Time rows */}
        {HOURS.map((hour) => (
          <>
            <div key={`label-${hour}`} className="bg-surface-alt px-2 py-1.5 text-right text-secondary">
              {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
            </div>
            {DAYS.map((day) => {
              const state = getSlotState(day, hour, slots);
              return (
                <button
                  key={`${day}-${hour}`}
                  className={`p-1.5 text-center transition-colors ${STATE_STYLES[state]} ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => toggle(day, hour)}
                  disabled={readOnly}
                  aria-label={`${DAY_LABELS[day]} ${hour}:00 - ${STATE_ICONS[state]}`}
                >
                  {STATE_ICONS[state]}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
