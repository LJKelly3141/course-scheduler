import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import type { Term, InstructorWorkload } from "@/api/types";
import { useTerm } from "@/hooks/useTerm";
import { useInstructors, useInstructorWorkload } from "@/hooks/useInstructorHub";
import { InstructorRoster } from "@/components/instructors/InstructorRoster";
import { InstructorDetail } from "@/components/instructors/InstructorDetail";
import { NewInstructorWizard } from "@/components/instructors/NewInstructorWizard";
import { api } from "@/api/client";

export function InstructorHubPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null; isReadOnly: boolean }>();
  const { terms } = useTerm();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const { data: instructors = [] } = useInstructors();
  const { data: workloadData, isLoading: workloadLoading } = useInstructorWorkload(
    selectedTerm?.id ?? null
  );

  const workloadMap = useMemo(() => {
    const map = new Map<number, InstructorWorkload>();
    if (workloadData?.instructors) {
      for (const w of workloadData.instructors) {
        map.set(w.instructor_id, w);
      }
    }
    return map;
  }, [workloadData]);

  const selectedInstructor = instructors.find((i) => i.id === selectedId) ?? null;
  const selectedWorkload = selectedId ? workloadMap.get(selectedId) : undefined;

  const handleExportXlsx = async () => {
    if (!selectedTerm) return;
    try {
      const resp = await api.getRaw(`/analytics/instructor-workload/export?term_id=${selectedTerm.id}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `load-report-${selectedTerm.name.replace(/\s+/g, "-")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail if export endpoint not available
    }
  };

  return (
    <div className="flex h-full">
      <InstructorRoster
        instructors={instructors}
        workloads={workloadMap}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewInstructor={() => setShowWizard(true)}
        onExportXlsx={handleExportXlsx}
      />

      {selectedInstructor ? (
        <InstructorDetail
          instructor={selectedInstructor}
          workload={selectedWorkload}
          workloadLoading={workloadLoading}
          selectedTermId={selectedTerm?.id ?? null}
          terms={terms}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg mb-1">Select an instructor</p>
            <p className="text-sm">Choose from the roster or add a new one</p>
          </div>
        </div>
      )}

      {showWizard && (
        <NewInstructorWizard
          onClose={() => setShowWizard(false)}
          onCreated={(id) => {
            setShowWizard(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
