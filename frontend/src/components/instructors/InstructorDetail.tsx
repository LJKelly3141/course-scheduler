import { useState } from "react";
import type { Instructor, InstructorWorkload, Term } from "@/api/types";
import { ProfileTab } from "./ProfileTab";
import { AvailabilityTab } from "./AvailabilityTab";
import { WorkloadTab } from "./WorkloadTab";
import { NotesTab } from "./NotesTab";
import { useDeleteInstructor } from "@/hooks/useInstructorHub";
import { toast } from "sonner";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "availability", label: "Availability" },
  { key: "workload", label: "Workload" },
  { key: "notes", label: "Notes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface InstructorDetailProps {
  instructor: Instructor;
  workload: InstructorWorkload | undefined;
  workloadLoading: boolean;
  selectedTermId: number | null;
  terms: Term[];
  onDeleted: () => void;
}

export function InstructorDetail({
  instructor,
  workload,
  workloadLoading,
  selectedTermId,
  terms,
  onDeleted,
}: InstructorDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const deleteMutation = useDeleteInstructor();

  const typeLabel = instructor.instructor_type
    ? instructor.instructor_type.charAt(0).toUpperCase() + instructor.instructor_type.slice(1)
    : "";
  const rankLabel = instructor.rank
    ? instructor.rank.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const tenureLabel = instructor.tenure_status
    ? instructor.tenure_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
  const subtitle = [typeLabel, rankLabel, tenureLabel].filter(Boolean).join(" · ");

  const handleDelete = () => {
    if (!confirm(`Delete ${instructor.name}? This cannot be undone.`)) return;
    deleteMutation.mutate(instructor.id, {
      onSuccess: () => {
        toast.success("Instructor deleted");
        onDeleted();
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {instructor.first_name} {instructor.last_name}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="text-xs text-red-400 border border-border px-3 py-1.5 rounded-md hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex gap-0 border-b border-border px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && <ProfileTab instructor={instructor} />}
      {activeTab === "availability" && <AvailabilityTab instructor={instructor} />}
      {activeTab === "workload" && (
        <WorkloadTab workload={workload} isLoading={workloadLoading} />
      )}
      {activeTab === "notes" && (
        <NotesTab
          instructor={instructor}
          termId={selectedTermId}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}
    </div>
  );
}
