import { useState, useMemo } from "react";
import type { Instructor, InstructorWorkload } from "@/api/types";

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "faculty", label: "Faculty" },
  { value: "ias", label: "IAS" },
  { value: "adjunct", label: "Adjunct" },
  { value: "nias", label: "NIAS" },
] as const;

interface InstructorRosterProps {
  instructors: Instructor[];
  workloads: Map<number, InstructorWorkload>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewInstructor: () => void;
  onExportXlsx: () => void;
}

export function InstructorRoster({
  instructors,
  workloads,
  selectedId,
  onSelect,
  onNewInstructor,
  onExportXlsx,
}: InstructorRosterProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = instructors;
    if (typeFilter !== "all") {
      result = result.filter((i) => i.instructor_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.email && i.email.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => {
      const aName = a.last_name || a.name;
      const bName = b.last_name || b.name;
      return aName.localeCompare(bName);
    });
  }, [instructors, search, typeFilter]);

  return (
    <div className="w-[300px] border-r border-border flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-sm text-primary">Instructors</span>
        <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">
          {instructors.length}
        </span>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          placeholder="Search instructors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-border text-xs">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-2 py-0.5 rounded ${
              typeFilter === f.value
                ? "bg-accent text-white"
                : "text-secondary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((inst) => {
          const wl = workloads.get(inst.id);
          const eqCredits = wl?.total_equivalent_credits ?? 0;
          const isOverloaded = wl?.is_overloaded ?? false;
          const sectionCount = wl?.section_count ?? 0;
          const isSelected = inst.id === selectedId;

          return (
            <button
              key={inst.id}
              onClick={() => onSelect(inst.id)}
              className={`w-full text-left px-4 py-2.5 border-l-[3px] transition-colors ${
                isSelected
                  ? "bg-surface-alt border-l-accent"
                  : "border-l-transparent hover:bg-surface-alt/50"
              }`}
            >
              <div
                className={`text-sm ${
                  isSelected
                    ? "font-semibold text-primary"
                    : inst.is_active
                    ? "text-primary"
                    : "text-tertiary italic"
                }`}
              >
                {inst.last_name ? `${inst.last_name}, ${inst.first_name}` : inst.name}
              </div>
              <div className="text-xs text-secondary mt-0.5">
                {inst.instructor_type
                  ? inst.instructor_type.charAt(0).toUpperCase() + inst.instructor_type.slice(1)
                  : "—"}
                {" · "}
                {!inst.is_active ? (
                  <span>Inactive</span>
                ) : (
                  <>
                    <span className={isOverloaded ? "text-red-400" : "text-emerald-400"}>
                      {eqCredits}/{inst.max_credits} cr
                    </span>
                    {" · "}
                    <span className={sectionCount === 0 ? "text-tertiary" : "text-emerald-400"}>
                      {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                    </span>
                    {isOverloaded && " ⚠"}
                  </>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-tertiary">
            No instructors found
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex flex-col gap-2">
        <button
          onClick={onExportXlsx}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          Export All — XLSX
        </button>
        <button
          onClick={onNewInstructor}
          className="w-full bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          + New Instructor
        </button>
      </div>
    </div>
  );
}
