import { ReleasePlanningView } from "@/components/instructors/ReleasePlanningView";

export function ReassignmentPlanPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold mb-4">Reassignment Plan</h2>
      <ReleasePlanningView />
    </div>
  );
}
