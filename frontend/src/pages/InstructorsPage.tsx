import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Instructor, InstructorAvailability, Term } from "../api/types";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/styled-select";
import { Plus, Trash2, X, AlertTriangle, Check } from "lucide-react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSort } from "../hooks/useSort";
import { SortableHeader } from "@/components/ui/sortable-header";

export function InstructorsPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushUndo } = useUndoRedo();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Instructor>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; id: number } | { type: "batch" } | null>(null);

  const { data: instructors = [], isLoading: loadingInstructors, isError: instructorsError } = useQuery({
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
    mutationFn: (data: Partial<Instructor>) => api.post<Instructor>("/instructors", data),
    onSuccess: (created, data) => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      setForm({});
      let currentId = created.id;
      pushUndo({
        label: `Create instructor ${created.name}`,
        undoFn: async () => { await api.delete(`/instructors/${currentId}`); },
        redoFn: async () => {
          const re = await api.post<Instructor>("/instructors", data);
          currentId = re.id;
        },
        invalidateKeys: [["instructors"], ["meetings"], ["validation"]],
      });
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
    mutationFn: (inst: Instructor) => api.delete(`/instructors/${inst.id}`),
    onSuccess: (_data, inst) => {
      invalidateAll();
      let currentId = inst.id;
      pushUndo({
        label: `Delete instructor ${inst.name}`,
        undoFn: async () => {
          const re = await api.post<Instructor>("/instructors", {
            name: inst.name,
            email: inst.email,
            department: inst.department,
            modality_constraint: inst.modality_constraint,
            max_credits: inst.max_credits,
            is_active: inst.is_active,
            instructor_type: inst.instructor_type,
          });
          currentId = re.id;
        },
        redoFn: async () => { await api.delete(`/instructors/${currentId}`); },
        invalidateKeys: [["instructors"], ["meetings"], ["validation"]],
      });
    },
    onError: () => invalidateAll(),
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

  const filteredInstructors = search
    ? instructors.filter((i) => {
        const q = search.toLowerCase();
        return (
          i.name.toLowerCase().includes(q) ||
          (i.email && i.email.toLowerCase().includes(q)) ||
          (i.department && i.department.toLowerCase().includes(q))
        );
      })
    : instructors;

  const { sortState, toggleSort, sortItems } = useSort<"name" | "email" | "department" | "instructor_type" | "modality_constraint" | "max_credits" | "is_active">("name");

  const sortedInstructors = sortItems(filteredInstructors, (i) => {
    switch (sortState.key) {
      case "name": return i.name;
      case "email": return i.email;
      case "department": return i.department;
      case "instructor_type": return i.instructor_type;
      case "modality_constraint": return i.modality_constraint;
      case "max_credits": return i.max_credits;
      case "is_active": return i.is_active;
      default: return i.name;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Instructors</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search instructors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
            aria-label="Search instructors"
          />
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setDeleteTarget({ type: "batch" })}>
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            Add Instructor
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="add-instructor-name" className="sr-only">Name</label>
              <input id="add-instructor-name" placeholder="Name" className="border border-border rounded px-2 py-1.5 text-sm w-full"
                value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="add-instructor-email" className="sr-only">Email</label>
              <input id="add-instructor-email" placeholder="Email" className="border border-border rounded px-2 py-1.5 text-sm w-full"
                value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label htmlFor="add-instructor-department" className="sr-only">Department</label>
              <input id="add-instructor-department" placeholder="Department" className="border border-border rounded px-2 py-1.5 text-sm w-full"
                value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label htmlFor="add-instructor-modality" className="sr-only">Modality Constraint</label>
              <StyledSelect id="add-instructor-modality"
                value={form.modality_constraint ?? "any"} onChange={(e) => setForm({ ...form, modality_constraint: e.target.value })}>
                <option value="any">Any</option>
                <option value="online_only">Online Only</option>
                <option value="mwf_only">MWF Only</option>
                <option value="tth_only">TTh Only</option>
              </StyledSelect>
            </div>
            <div>
              <label htmlFor="add-instructor-type" className="sr-only">Instructor Type</label>
              <StyledSelect id="add-instructor-type"
                value={form.instructor_type ?? ""} onChange={(e) => setForm({ ...form, instructor_type: e.target.value || null })}>
                <option value="">Type (optional)</option>
                <option value="faculty">Faculty</option>
                <option value="ias">IAS</option>
                <option value="adjunct">Adjunct</option>
                <option value="nias">NIAS</option>
              </StyledSelect>
            </div>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate(form)}>
            Save
          </Button>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={instructors.length > 0 && selectedIds.size === instructors.length}
                  onChange={toggleAll}
                  aria-label="Select all instructors"
                />
              </th>
              <SortableHeader label="Name" sortKey="name" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Email" sortKey="email" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Department" sortKey="department" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Type" sortKey="instructor_type" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Modality" sortKey="modality_constraint" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Max Credits" sortKey="max_credits" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Active" sortKey="is_active" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingInstructors && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading instructors...</span>
                  </div>
                </td>
              </tr>
            )}
            {instructorsError && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <p className="text-sm text-destructive">Failed to load instructors.</p>
                </td>
              </tr>
            )}
            {!loadingInstructors && !instructorsError && instructors.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No instructors yet. Click "+ Add Instructor" to create one.
                </td>
              </tr>
            )}
            {sortedInstructors.map((inst) => (
              <tr key={inst.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inst.id)}
                    onChange={() => toggleSelect(inst.id)}
                    aria-label={`Select ${inst.name}`}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    className="text-primary hover:underline font-medium text-left"
                    onClick={() => navigate(`/instructors/${inst.id}`)}
                  >
                    {inst.name}
                  </button>
                </td>
                <td className="px-4 py-2.5">{inst.email}</td>
                <td className="px-4 py-2.5">{inst.department}</td>
                <td className="px-4 py-2.5 uppercase text-xs">{inst.instructor_type || "—"}</td>
                <td className="px-4 py-2.5 capitalize">{inst.modality_constraint.replace("_", " ")}</td>
                <td className="px-4 py-2.5">{inst.max_credits}</td>
                <td className="px-4 py-2.5">{inst.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate(`/instructors/${inst.id}`)}>
                    Detail
                  </Button>
                  <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setEditingId(editingId === inst.id ? null : inst.id)}>
                    {editingId === inst.id ? "Close" : "Availability"}
                  </Button>
                  <Button variant="link" size="sm" className="h-auto px-0 text-destructive" onClick={() => setDeleteTarget({ type: "single", id: inst.id })}>
                    Delete
                  </Button>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.type === "batch" ? `Delete ${selectedIds.size} instructor(s)?` : "Delete instructor?"}
        description="This will permanently remove the selected instructor(s) and unassign them from any sections."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget?.type === "batch") {
            batchDeleteMutation.mutate([...selectedIds]);
          } else if (deleteTarget?.type === "single") {
            const inst = instructors.find((i) => i.id === deleteTarget.id);
            if (inst) deleteMutation.mutate(inst);
          }
          setDeleteTarget(null);
        }}
      />
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

  const formatTime = (hour: number) => `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"}`;

  const getStatusLabel = (type: string | null) => {
    if (type === "unavailable") return "Unavailable";
    if (type === "prefer_avoid") return "Prefer to avoid";
    return "Available";
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="font-semibold mb-3">Availability Grid</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Click to cycle: <span className="inline-flex items-center gap-0.5"><Check className="h-3 w-3 text-success" /> Available</span> → <span className="inline-flex items-center gap-0.5"><X className="h-3 w-3 text-destructive" /> Unavailable</span> → <span className="inline-flex items-center gap-0.5"><AlertTriangle className="h-3 w-3 text-warning" /> Prefer Avoid</span> → Available
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
                  {formatTime(h)}
                </td>
                {days.map((d) => {
                  const type = getBlockType(d, h);
                  return (
                    <td key={d} className="px-1 py-0.5">
                      <button
                        onClick={() => toggleBlock(d, h)}
                        aria-label={`${d} ${formatTime(h)}: ${getStatusLabel(type)}. Click to change.`}
                        aria-pressed={type !== null}
                        className={`w-10 h-6 rounded border flex items-center justify-center ${
                          type === "unavailable"
                            ? "bg-destructive/20 border-destructive/40"
                            : type === "prefer_avoid"
                            ? "bg-warning/20 border-warning/40"
                            : "bg-success/20 border-success/40"
                        }`}
                      >
                        {type === "unavailable" && <X className="h-3 w-3 text-destructive" />}
                        {type === "prefer_avoid" && <AlertTriangle className="h-3 w-3 text-warning" />}
                        {type === null && <Check className="h-3 w-3 text-success" />}
                      </button>
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
