import type { InstructorWorkload } from "@/api/types";

interface WorkloadTabProps {
  workload: InstructorWorkload | undefined;
  isLoading: boolean;
}

export function WorkloadTab({ workload, isLoading }: WorkloadTabProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading workload...
      </div>
    );
  }

  if (!workload) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a term to view workload data.
      </div>
    );
  }

  const eqCredits = workload.total_equivalent_credits;
  const maxCredits = workload.max_credits;
  const overAmount = eqCredits - maxCredits;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Sections</div>
          <div className="text-2xl font-bold text-foreground mt-1">{workload.section_count}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Teaching Credits</div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {workload.total_teaching_credits}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Equivalent Credits</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              workload.is_overloaded ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {eqCredits}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">of {maxCredits} max</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Student Credit Hours</div>
          <div className="text-2xl font-bold text-foreground mt-1">{workload.total_sch}</div>
        </div>
      </div>

      <section className="mb-6">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Assigned Sections
        </h4>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Course</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Title</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Credits</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Equiv</th>
                <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Cap</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Schedule</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Modality</th>
              </tr>
            </thead>
            <tbody>
              {workload.sections.map((s, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 text-foreground font-medium">
                    {s.department_code} {s.course_number}-{s.section_number}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{s.title}</td>
                  <td className="px-3 py-2.5 text-foreground text-center">{s.actual_credits}</td>
                  <td className="px-3 py-2.5 text-foreground text-center">
                    {s.equivalent_credits ?? s.actual_credits}
                  </td>
                  <td className="px-3 py-2.5 text-foreground text-center">{s.enrollment_cap}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.schedule_info ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.modality ?? "—"}</td>
                </tr>
              ))}
              {workload.sections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No sections assigned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Load Adjustments
          </h4>
        </div>
        {workload.adjustments.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Description</th>
                  <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                    Equiv Credits
                  </th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {workload.adjustments.map((a, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 text-foreground">{a.description}</td>
                    <td className="px-3 py-2.5 text-foreground text-center">
                      {a.equivalent_credits}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.adjustment_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg px-3 py-4 text-sm text-muted-foreground text-center">
            No load adjustments
          </div>
        )}
      </section>

      <div
        className={`p-3 rounded-lg border flex justify-between items-center ${
          workload.is_overloaded
            ? "bg-red-900/20 border-red-800"
            : "bg-blue-900/20 border-blue-800"
        }`}
      >
        <div>
          <span
            className={`text-sm font-medium ${
              workload.is_overloaded ? "text-red-300" : "text-blue-300"
            }`}
          >
            Total Equivalent Credits: {eqCredits} / {maxCredits}
          </span>
          <span className="text-xs text-muted-foreground ml-3">
            ({workload.total_teaching_credits} teaching
            {workload.adjustments.length > 0
              ? ` + ${eqCredits - workload.total_teaching_credits} adjustments`
              : ""}
            )
          </span>
        </div>
        <span
          className={`text-xs font-medium ${
            workload.is_overloaded ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {workload.is_overloaded
            ? `⚠ Overloaded by ${overAmount} credit${overAmount !== 1 ? "s" : ""}`
            : "✓ Within limit"}
        </span>
      </div>
    </div>
  );
}
