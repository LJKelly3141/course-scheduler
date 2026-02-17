import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import type { Instructor, InstructorAvailability, Term } from "../api/types";

export function InstructorsPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Instructor>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => api.get<Instructor[]>("/instructors"),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["availability", editingId, selectedTerm?.id],
    queryFn: () =>
      api.get<InstructorAvailability[]>(
        `/instructors/${editingId}/availability?term_id=${selectedTerm!.id}`
      ),
    enabled: !!editingId && !!selectedTerm,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Instructor>) => api.post("/instructors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      setForm({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Instructor> }) =>
      api.put(`/instructors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      setEditingId(null);
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["instructors"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/instructors/${id}`),
    onSettled: invalidateAll,
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/instructors/batch-delete", { ids }),
    onSettled: () => {
      invalidateAll();
      setSelectedIds(new Set());
    },
  });

  const [showAdd, setShowAdd] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === instructors.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(instructors.map((i) => i.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Instructors</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} instructor(s)?`))
                  batchDeleteMutation.mutate([...selectedIds]);
              }}
              className="bg-destructive text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            + Add Instructor
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Name" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Email" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Department" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <select className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.modality_constraint ?? "any"} onChange={(e) => setForm({ ...form, modality_constraint: e.target.value })}>
              <option value="any">Any</option>
              <option value="online_only">Online Only</option>
              <option value="mwf_only">MWF Only</option>
              <option value="tth_only">TTh Only</option>
            </select>
          </div>
          <button onClick={() => createMutation.mutate(form)}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm">
            Save
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={instructors.length > 0 && selectedIds.size === instructors.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Modality</th>
              <th className="px-4 py-3">Max Credits</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((inst) => (
              <tr key={inst.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inst.id)}
                    onChange={() => toggleSelect(inst.id)}
                  />
                </td>
                <td className="px-4 py-2.5">{inst.name}</td>
                <td className="px-4 py-2.5">{inst.email}</td>
                <td className="px-4 py-2.5">{inst.department}</td>
                <td className="px-4 py-2.5 capitalize">{inst.modality_constraint.replace("_", " ")}</td>
                <td className="px-4 py-2.5">{inst.max_credits}</td>
                <td className="px-4 py-2.5">{inst.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <button onClick={() => setEditingId(editingId === inst.id ? null : inst.id)}
                    className="text-primary text-xs hover:underline">
                    {editingId === inst.id ? "Close" : "Availability"}
                  </button>
                  <button onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(inst.id); }}
                    className="text-destructive text-xs hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && selectedTerm && (
        <AvailabilityEditor
          instructorId={editingId}
          termId={selectedTerm.id}
          availability={availability}
        />
      )}
    </div>
  );
}

function AvailabilityEditor({
  instructorId,
  termId,
  availability,
}: {
  instructorId: number;
  termId: number;
  availability: InstructorAvailability[];
}) {
  const queryClient = useQueryClient();
  const days = ["M", "T", "W", "Th", "F"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

  const saveMutation = useMutation({
    mutationFn: (items: { day_of_week: string; start_time: string; end_time: string; type: string }[]) =>
      api.put(`/instructors/${instructorId}/availability?term_id=${termId}`, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["availability"] }),
  });

  const getBlockType = (day: string, hour: number): string | null => {
    const slot = availability.find(
      (a) => a.day_of_week === day && a.start_time <= `${String(hour).padStart(2, "0")}:00` && a.end_time > `${String(hour).padStart(2, "0")}:00`
    );
    return slot?.type ?? null;
  };

  const toggleBlock = (day: string, hour: number) => {
    const startTime = `${String(hour).padStart(2, "0")}:00:00`;
    const endTime = `${String(hour + 1).padStart(2, "0")}:00:00`;
    const existing = availability.find(
      (a) => a.day_of_week === day && a.start_time === startTime
    );

    let newAvail;
    if (!existing) {
      newAvail = [...availability.map(a => ({ day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, type: a.type })),
        { day_of_week: day, start_time: startTime, end_time: endTime, type: "unavailable" }];
    } else if (existing.type === "unavailable") {
      newAvail = availability.map(a => {
        if (a.day_of_week === day && a.start_time === startTime) {
          return { day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, type: "prefer_avoid" };
        }
        return { day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, type: a.type };
      });
    } else {
      newAvail = availability
        .filter(a => !(a.day_of_week === day && a.start_time === startTime))
        .map(a => ({ day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, type: a.type }));
    }
    saveMutation.mutate(newAvail);
  };

  return (
    <div className="bg-white rounded-lg border border-border p-4">
      <h3 className="font-semibold mb-3">Availability Grid</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Click to cycle: Available → Unavailable (red) → Prefer Avoid (yellow) → Available
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1"></th>
              {days.map((d) => <th key={d} className="px-3 py-1">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <td className="px-2 py-0.5 text-muted-foreground">
                  {h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}
                </td>
                {days.map((d) => {
                  const type = getBlockType(d, h);
                  return (
                    <td key={d} className="px-1 py-0.5">
                      <button
                        onClick={() => toggleBlock(d, h)}
                        className={`w-10 h-6 rounded border ${
                          type === "unavailable"
                            ? "bg-red-200 border-red-300"
                            : type === "prefer_avoid"
                            ? "bg-yellow-200 border-yellow-300"
                            : "bg-green-50 border-green-200"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
