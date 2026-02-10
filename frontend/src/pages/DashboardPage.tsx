import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, Section, Meeting, Instructor, Room } from "../api/types";

export function DashboardPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", selectedTerm?.id],
    queryFn: () => api.get<Section[]>(`/sections?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", selectedTerm?.id],
    queryFn: () => api.get<Meeting[]>(`/terms/${selectedTerm!.id}/meetings`),
    enabled: !!selectedTerm,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  const { data: validation } = useQuery({
    queryKey: ["validation", selectedTerm?.id],
    queryFn: () => api.get<{ valid: boolean; hard_conflicts: unknown[]; soft_warnings: unknown[] }>(`/terms/${selectedTerm!.id}/validate`),
    enabled: !!selectedTerm,
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground">Select a term to view the dashboard.</p>;
  }

  const scheduled = sections.filter((s) => s.status !== "unscheduled").length;
  const unscheduled = sections.filter((s) => s.status === "unscheduled");
  const totalConflicts = validation?.hard_conflicts?.length ?? 0;
  const totalWarnings = validation?.soft_warnings?.length ?? 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{selectedTerm.name} Dashboard</h2>

      {/* Scheduling Progress */}
      <div className="bg-white rounded-lg border border-border p-6">
        <h3 className="font-semibold mb-4">Scheduling Progress</h3>
        <div className="flex items-center gap-6 mb-4">
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: sections.length ? `${(scheduled / sections.length) * 100}%` : "0%" }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {scheduled} of {sections.length} sections scheduled
            </p>
          </div>
          <div className="flex gap-3">
            {totalConflicts > 0 && (
              <span className="px-2 py-1 bg-red-100 text-destructive rounded-full text-xs font-medium">
                {totalConflicts} conflicts
              </span>
            )}
            {totalWarnings > 0 && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                {totalWarnings} warnings
              </span>
            )}
          </div>
        </div>
        {unscheduled.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Unscheduled Sections:</p>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((s) => (
                <span key={s.id} className="px-2 py-1 bg-muted rounded text-xs">
                  {s.course?.department_code} {s.course?.course_number}-{s.section_number}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructor Workload */}
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Instructor Workload</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2">Instructor</th>
                  <th className="pb-2">Credits</th>
                  <th className="pb-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {instructors.filter(i => i.is_active).map((inst) => {
                  const instMeetings = meetings.filter((m) => m.instructor_id === inst.id);
                  const credits = instMeetings.reduce((sum, m) => sum + (m.section?.course?.credits ?? 3), 0);
                  const over = credits >= inst.max_credits;
                  return (
                    <tr key={inst.id} className={over ? "bg-yellow-50" : ""}>
                      <td className="py-1.5">{inst.name}</td>
                      <td className="py-1.5">{credits}</td>
                      <td className="py-1.5">{inst.max_credits}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Room Utilization */}
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Room Utilization</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2">Room</th>
                  <th className="pb-2">Capacity</th>
                  <th className="pb-2">Meetings</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const roomMeetings = meetings.filter((m) => m.room_id === room.id).length;
                  return (
                    <tr key={room.id}>
                      <td className="py-1.5">{room.building?.abbreviation} {room.room_number}</td>
                      <td className="py-1.5">{room.capacity}</td>
                      <td className="py-1.5">{roomMeetings}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
