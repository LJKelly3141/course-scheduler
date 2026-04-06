import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Instructor } from "@/api/types";
import { AvailabilityGrid, type AvailabilitySlot } from "./AvailabilityGrid";
import { TermTypeToggle } from "./TermTypeToggle";
import {
  useAvailabilityTemplates,
  useSaveAvailabilityTemplate,
  useUpdateInstructor,
} from "@/hooks/useInstructorHub";

const TERM_TYPES = ["fall", "spring", "summer", "winter"] as const;
const TERM_TYPE_LABELS: Record<string, string> = {
  fall: "Fall",
  spring: "Spring",
  summer: "Summer",
  winter: "Winter",
};

interface AvailabilityTabProps {
  instructor: Instructor;
}

export function AvailabilityTab({ instructor }: AvailabilityTabProps) {
  const [activeTermType, setActiveTermType] = useState<string>("fall");
  const isGridType = activeTermType === "fall" || activeTermType === "spring";

  const { data: templates = [] } = useAvailabilityTemplates(
    instructor.id,
    isGridType ? activeTermType : undefined
  );
  const saveMutation = useSaveAvailabilityTemplate();
  const updateInstructorMutation = useUpdateInstructor();

  const [localSlots, setLocalSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (isGridType) {
      setLocalSlots(
        templates.map((t) => ({
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time,
          type: t.type as "unavailable" | "prefer_avoid",
        }))
      );
    }
  }, [templates, activeTermType]);

  const handleGridChange = useCallback((slots: AvailabilitySlot[]) => {
    setLocalSlots(slots);
  }, []);

  const handleSaveGrid = () => {
    saveMutation.mutate(
      {
        instructorId: instructor.id,
        termType: activeTermType,
        slots: localSlots,
      },
      {
        onSuccess: () => toast.success(`${TERM_TYPE_LABELS[activeTermType]} availability saved`),
        onError: () => toast.error("Failed to save"),
      }
    );
  };

  const handleToggle = (available: boolean) => {
    const field = activeTermType === "summer" ? "available_summer" : "available_winter";
    updateInstructorMutation.mutate(
      { id: instructor.id, [field]: available },
      {
        onSuccess: () =>
          toast.success(
            `${TERM_TYPE_LABELS[activeTermType]} availability ${available ? "enabled" : "disabled"}`
          ),
      }
    );
  };

  const handleSetAllAvailable = () => {
    setLocalSlots([]);
  };

  const handleClearAll = () => {
    const DAYS = ["M", "T", "W", "Th", "F"];
    const HOURS = Array.from({ length: 10 }, (_, i) => i + 7);
    const allUnavailable: AvailabilitySlot[] = [];
    for (const day of DAYS) {
      for (const hour of HOURS) {
        allUnavailable.push({
          day_of_week: day,
          start_time: `${hour.toString().padStart(2, "0")}:00:00`,
          end_time: `${(hour + 1).toString().padStart(2, "0")}:00:00`,
          type: "unavailable",
        });
      }
    }
    setLocalSlots(allUnavailable);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex gap-0 border-b border-border mb-5">
        {TERM_TYPES.map((tt) => (
          <button
            key={tt}
            onClick={() => setActiveTermType(tt)}
            className={`px-5 py-2 text-sm transition-colors ${
              activeTermType === tt
                ? "text-accent border-b-2 border-accent font-medium"
                : "text-secondary hover:text-primary"
            }`}
          >
            {TERM_TYPE_LABELS[tt]}
          </button>
        ))}
      </div>

      {isGridType ? (
        <>
          <div className="flex gap-3 items-center mb-3 text-xs">
            <span className="text-secondary">Quick:</span>
            <button onClick={handleSetAllAvailable} className="text-accent hover:underline">
              Set all available
            </button>
            <button onClick={handleClearAll} className="text-accent hover:underline">
              Clear all
            </button>
            {activeTermType === "spring" && (
              <button
                onClick={() => {
                  toast.info("Switch to Fall tab first to set Fall availability, then use this to copy");
                }}
                className="text-accent hover:underline"
              >
                Copy Fall → Spring
              </button>
            )}
          </div>

          <AvailabilityGrid slots={localSlots} onChange={handleGridChange} />

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() =>
                setLocalSlots(
                  templates.map((t) => ({
                    day_of_week: t.day_of_week,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    type: t.type as "unavailable" | "prefer_avoid",
                  }))
                )
              }
              className="px-4 py-1.5 text-sm text-secondary border border-border rounded-md hover:bg-surface-alt"
            >
              Undo
            </button>
            <button
              onClick={handleSaveGrid}
              disabled={saveMutation.isPending}
              className="px-4 py-1.5 text-sm text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save Availability"}
            </button>
          </div>
        </>
      ) : (
        <TermTypeToggle
          termType={activeTermType as "summer" | "winter"}
          available={
            activeTermType === "summer"
              ? instructor.available_summer
              : instructor.available_winter
          }
          onChange={handleToggle}
        />
      )}

      <div className="mt-6">
        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
          All Term Types
        </h4>
        <div className="grid grid-cols-4 gap-3">
          {TERM_TYPES.map((tt) => (
            <div key={tt} className="bg-surface border border-border rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span
                  className={`text-sm font-medium ${
                    activeTermType === tt ? "text-accent" : "text-secondary"
                  }`}
                >
                  {TERM_TYPE_LABELS[tt]}
                </span>
                {tt === "summer" || tt === "winter" ? (
                  <span
                    className={`text-xs ${
                      (tt === "summer" ? instructor.available_summer : instructor.available_winter)
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {(tt === "summer" ? instructor.available_summer : instructor.available_winter)
                      ? "✓ Available"
                      : "✗ Not available"}
                  </span>
                ) : (
                  <span className="text-xs text-secondary">
                    {templates.length > 0 && activeTermType === tt
                      ? "✓ Set"
                      : "Default"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
