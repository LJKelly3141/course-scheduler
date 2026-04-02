import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

// ── Types ──

export interface TermInstructorInfo {
  id: number;
  name: string;
  section_count: number;
}

export interface TermInstructorGroup {
  instructor_type: string;
  label: string;
  instructors: TermInstructorInfo[];
}

export interface TermInstructorsResult {
  term_id: number;
  term_name: string;
  groups: TermInstructorGroup[];
  untyped_instructors: TermInstructorInfo[];
}

// ── Component ──

export function InstructorSelectionStep({
  data,
  includedIds,
  onToggleInstructor,
  onToggleGroup,
  emptyMessage = "No instructors found.",
}: {
  data: TermInstructorsResult;
  includedIds: Set<number>;
  onToggleInstructor: (id: number) => void;
  onToggleGroup: (instructorIds: number[], include: boolean) => void;
  emptyMessage?: string;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const toggleCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const allGroups = [
    ...data.groups,
    ...(data.untyped_instructors.length > 0
      ? [
          {
            instructor_type: "_other",
            label: "Other",
            instructors: data.untyped_instructors,
          },
        ]
      : []),
  ];

  if (allGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {allGroups.map((group) => {
        const groupIds = group.instructors.map((i) => i.id);
        const allIncluded = groupIds.every((id) => includedIds.has(id));
        const isCollapsed = collapsedGroups.has(group.instructor_type);

        return (
          <div
            key={group.instructor_type}
            className="border border-border rounded-md overflow-hidden"
          >
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
              <button
                type="button"
                onClick={() => toggleCollapse(group.instructor_type)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={isCollapsed ? "Expand group" : "Collapse group"}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
              <span className="text-sm font-medium flex-1">
                {group.label}
                <span className="text-muted-foreground font-normal ml-1.5">
                  ({group.instructors.length})
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => onToggleGroup(groupIds, !allIncluded)}
              >
                {allIncluded ? "Set All TBD" : "Include All"}
              </Button>
            </div>

            {/* Instructor list */}
            {!isCollapsed && (
              <div className="divide-y divide-border/30">
                {group.instructors.map((inst) => {
                  const isIncluded = includedIds.has(inst.id);
                  return (
                    <label
                      key={inst.id}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/20 ${
                        isIncluded ? "" : "text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => onToggleInstructor(inst.id)}
                        className="rounded"
                      />
                      <span
                        className={`text-sm flex-1 ${isIncluded ? "font-medium" : "italic"}`}
                      >
                        {isIncluded ? inst.name : `${inst.name} \u2192 TBD`}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {inst.section_count} sec
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
