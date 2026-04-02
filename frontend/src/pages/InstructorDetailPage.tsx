import { useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type {
  Instructor,
  InstructorAvailability,
  InstructorNote,
  Term,
  AcademicYear,
  WorkloadResponse,
} from "../api/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StyledSelect } from "@/components/ui/styled-select";
import { ArrowLeft, Save, X, AlertTriangle, Check } from "lucide-react";

const RANK_LABELS: Record<string, string> = {
  professor: "Professor",
  associate_professor: "Associate Professor",
  assistant_professor: "Assistant Professor",
  senior_lecturer: "Senior Lecturer",
  lecturer: "Lecturer",
  adjunct_instructor: "Adjunct Instructor",
};

const TENURE_LABELS: Record<string, string> = {
  tenured: "Tenured",
  tenure_track: "Tenure Track",
  non_tenure: "Non-Tenure",
};

const TYPE_LABELS: Record<string, string> = {
  faculty: "Faculty",
  ias: "IAS",
  adjunct: "Adjunct",
  nias: "NIAS",
};

export function InstructorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "schedule" | "workload">("profile");

  const { data: instructor, isLoading } = useQuery({
    queryKey: ["instructor", id],
    queryFn: () => api.get<Instructor>(`/instructors/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!instructor) {
    return <p className="text-muted-foreground">Instructor not found.</p>;
  }

  const tabs = [
    { key: "profile" as const, label: "Profile" },
    { key: "schedule" as const, label: "Schedule & Availability" },
    { key: "workload" as const, label: "Workload" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/instructors")} aria-label="Back to instructors list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{instructor.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {instructor.instructor_type && (
              <Badge variant="outline" className="text-xs">
                {TYPE_LABELS[instructor.instructor_type] ?? instructor.instructor_type}
              </Badge>
            )}
            {instructor.rank && (
              <Badge variant="secondary" className="text-xs">
                {RANK_LABELS[instructor.rank] ?? instructor.rank}
              </Badge>
            )}
            {!instructor.is_active && (
              <Badge variant="destructive" className="text-xs">Inactive</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-border" role="tablist">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "profile" && (
        <ProfileTab instructor={instructor} />
      )}
      {activeTab === "schedule" && (
        <ScheduleTab instructor={instructor} selectedTerm={selectedTerm} />
      )}
      {activeTab === "workload" && (
        <WorkloadTab instructor={instructor} selectedTerm={selectedTerm} />
      )}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────

function ProfileTab({ instructor }: { instructor: Instructor }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: instructor.first_name ?? "",
    last_name: instructor.last_name ?? "",
    email: instructor.email ?? "",
    phone: instructor.phone ?? "",
    office_location: instructor.office_location ?? "",
    department: instructor.department ?? "",
    instructor_type: instructor.instructor_type ?? "",
    rank: instructor.rank ?? "",
    tenure_status: instructor.tenure_status ?? "",
    hire_date: instructor.hire_date ?? "",
    modality_constraint: instructor.modality_constraint ?? "any",
    max_credits: instructor.max_credits ?? 12,
    is_active: instructor.is_active ?? true,
  });
  const [toast, setToast] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/instructors/${instructor.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor", String(instructor.id)] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      setToast("Saved.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      instructor_type: form.instructor_type || null,
      rank: form.rank || null,
      tenure_status: form.tenure_status || null,
      hire_date: form.hire_date || null,
      phone: form.phone || null,
      office_location: form.office_location || null,
    });
  };

  const field = (label: string, key: keyof typeof form, type = "text") => {
    const fieldId = `profile-${key}`;
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium mb-1">{label}</label>
        <input
          id={fieldId}
          type={type}
          className="w-full border border-border rounded-md px-3 py-2 text-sm"
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Contact Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {field("First Name", "first_name")}
          {field("Last Name", "last_name")}
        </div>
        {field("Email", "email", "email")}
        {field("Phone", "phone", "tel")}
        {field("Office Location", "office_location")}
        {field("Department", "department")}
      </section>

      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Employment
        </h3>
        <div>
          <label htmlFor="profile-instructor-type" className="block text-sm font-medium mb-1">Type</label>
          <StyledSelect
            id="profile-instructor-type"
            className="w-full"
            value={form.instructor_type}
            onChange={(e) => setForm({ ...form, instructor_type: e.target.value })}
          >
            <option value="">—</option>
            <option value="faculty">Faculty</option>
            <option value="ias">IAS</option>
            <option value="adjunct">Adjunct</option>
            <option value="nias">NIAS</option>
          </StyledSelect>
        </div>
        <div>
          <label htmlFor="profile-rank" className="block text-sm font-medium mb-1">Academic Rank</label>
          <StyledSelect
            id="profile-rank"
            className="w-full"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
          >
            <option value="">—</option>
            {Object.entries(RANK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </StyledSelect>
        </div>
        <div>
          <label htmlFor="profile-tenure-status" className="block text-sm font-medium mb-1">Tenure Status</label>
          <StyledSelect
            id="profile-tenure-status"
            className="w-full"
            value={form.tenure_status}
            onChange={(e) => setForm({ ...form, tenure_status: e.target.value })}
          >
            <option value="">—</option>
            {Object.entries(TENURE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </StyledSelect>
        </div>
        {field("Hire Date", "hire_date", "date")}
        <div>
          <label htmlFor="profile-modality" className="block text-sm font-medium mb-1">Modality Constraint</label>
          <StyledSelect
            id="profile-modality"
            className="w-full"
            value={form.modality_constraint}
            onChange={(e) => setForm({ ...form, modality_constraint: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="online_only">Online Only</option>
            <option value="mwf_only">MWF Only</option>
            <option value="tth_only">TTh Only</option>
          </StyledSelect>
        </div>
        <div>
          <label htmlFor="profile-max-credits" className="block text-sm font-medium mb-1">Max Credits</label>
          <input
            id="profile-max-credits"
            type="number"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            value={form.max_credits}
            onChange={(e) => setForm({ ...form, max_credits: parseInt(e.target.value) || 0 })}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            aria-label="Active status"
          />
          <span className="text-sm">Active</span>
        </label>
      </section>

      <div className="lg:col-span-2 flex items-center gap-3">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
        {toast && (
          <span className="text-sm text-success font-medium">{toast}</span>
        )}
      </div>

      <NotesSection instructorId={instructor.id} />
    </div>
  );
}

// ─── Notes Section ────────────────────────────────────────────────────

function NotesSection({ instructorId }: { instructorId: number }) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  const { data: notes = [] } = useQuery({
    queryKey: ["instructor-notes", instructorId],
    queryFn: () => api.get<InstructorNote[]>(`/instructors/${instructorId}/notes`),
  });

  const createMutation = useMutation({
    mutationFn: (data: { category: string; content: string }) =>
      api.post(`/instructors/${instructorId}/notes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-notes", instructorId] });
      setNewNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: number) =>
      api.delete(`/instructors/${instructorId}/notes/${noteId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["instructor-notes", instructorId] }),
  });

  const CATEGORY_LABELS: Record<string, string> = {
    general: "General",
    contract: "Contract",
    performance: "Performance",
    scheduling: "Scheduling",
  };

  return (
    <section className="lg:col-span-2 bg-card rounded-lg border border-border p-6 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Notes
      </h3>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label htmlFor="note-content" className="sr-only">Note content</label>
          <textarea
            id="note-content"
            className="w-full border border-border rounded-md px-3 py-2 text-sm resize-y"
            rows={2}
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="note-category" className="sr-only">Note category</label>
          <StyledSelect
            id="note-category"
            className="text-xs"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </StyledSelect>
          <Button
            size="sm"
            onClick={() => createMutation.mutate({ category: newCategory, content: newNote })}
            disabled={!newNote.trim() || createMutation.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      {notes.length === 0 && (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      )}

      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-md group">
            <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
              {CATEGORY_LABELS[note.category] ?? note.category}
            </Badge>
            <p className="text-sm flex-1 whitespace-pre-wrap">{note.content}</p>
            <button
              onClick={() => deleteMutation.mutate(note.id)}
              className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Delete note: ${note.content.substring(0, 30)}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────

function ScheduleTab({
  instructor,
  selectedTerm,
}: {
  instructor: Instructor;
  selectedTerm: Term | null;
}) {
  const queryClient = useQueryClient();

  const { data: availability = [] } = useQuery({
    queryKey: ["availability", instructor.id, selectedTerm?.id],
    queryFn: () =>
      api.get<InstructorAvailability[]>(
        `/instructors/${instructor.id}/availability?term_id=${selectedTerm!.id}`
      ),
    enabled: !!selectedTerm,
  });

  const saveMutation = useMutation({
    mutationFn: (items: { day_of_week: string; start_time: string; end_time: string; type: string }[]) =>
      api.put(`/instructors/${instructor.id}/availability?term_id=${selectedTerm!.id}`, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["availability"] }),
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground text-sm">Select a term to view availability.</p>;
  }

  const days = ["M", "T", "W", "Th", "F"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const getBlockType = (day: string, hour: number): string | null => {
    const slot = availability.find(
      (a) =>
        a.day_of_week === day &&
        a.start_time <= `${String(hour).padStart(2, "0")}:00` &&
        a.end_time > `${String(hour).padStart(2, "0")}:00`
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
      newAvail = [
        ...availability.map((a) => ({
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          type: a.type,
        })),
        { day_of_week: day, start_time: startTime, end_time: endTime, type: "unavailable" },
      ];
    } else if (existing.type === "unavailable") {
      newAvail = availability.map((a) => {
        if (a.day_of_week === day && a.start_time === startTime) {
          return { ...a, type: "prefer_avoid" };
        }
        return { day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, type: a.type };
      });
    } else {
      newAvail = availability
        .filter((a) => !(a.day_of_week === day && a.start_time === startTime))
        .map((a) => ({
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          type: a.type,
        }));
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
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-2">
          Availability — {selectedTerm.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Click to cycle: <span className="inline-flex items-center gap-0.5"><Check className="h-3 w-3 text-success" /> Available</span> → <span className="inline-flex items-center gap-0.5"><X className="h-3 w-3 text-destructive" /> Unavailable</span> → <span className="inline-flex items-center gap-0.5"><AlertTriangle className="h-3 w-3 text-warning" /> Prefer Avoid</span> → Available
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1"></th>
                {days.map((d) => (
                  <th key={d} className="px-3 py-1">{d}</th>
                ))}
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
    </div>
  );
}

// ─── Workload Tab ─────────────────────────────────────────────────────

function WorkloadTab({
  instructor,
  selectedTerm,
}: {
  instructor: Instructor;
  selectedTerm: Term | null;
}) {
  const { data: workload } = useQuery({
    queryKey: ["workload", selectedTerm?.id],
    queryFn: () =>
      api.get<WorkloadResponse>(`/analytics/instructor-workload?term_id=${selectedTerm!.id}`),
    enabled: !!selectedTerm,
  });

  if (!selectedTerm) {
    return <p className="text-muted-foreground text-sm">Select a term to view workload.</p>;
  }

  const instWorkload = workload?.instructors?.find(
    (w) => w.instructor_id === instructor.id
  );

  if (!instWorkload) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">
          No workload data for {instructor.name} in {selectedTerm.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sections" value={instWorkload.section_count} />
        <StatCard label="Teaching Credits" value={instWorkload.total_teaching_credits} />
        <StatCard
          label="Equivalent Credits"
          value={instWorkload.total_equivalent_credits}
          warn={instWorkload.is_overloaded}
        />
        <StatCard label="SCH" value={instWorkload.total_sch} />
      </div>

      {instWorkload.is_overloaded && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
          <p className="text-sm text-destructive font-medium">
            Overloaded: {instWorkload.total_equivalent_credits} equivalent credits exceeds max of{" "}
            {instWorkload.max_credits}
          </p>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="font-semibold text-sm mb-3">Sections — {selectedTerm.name}</h3>
        {instWorkload.sections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sections assigned.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-3">Course</th>
                <th className="pb-2 pr-3">Sec</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3 text-right">Cr</th>
                <th className="pb-2 pr-3 text-right">Equiv</th>
                <th className="pb-2 pr-3 text-right">Cap</th>
                <th className="pb-2 pr-3">Schedule</th>
                <th className="pb-2">Modality</th>
              </tr>
            </thead>
            <tbody>
              {instWorkload.sections.map((s) => (
                <tr key={s.section_id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {s.department_code} {s.course_number}
                  </td>
                  <td className="py-1.5 pr-3">{s.section_number}</td>
                  <td className="py-1.5 pr-3 truncate max-w-[200px]">{s.title}</td>
                  <td className="py-1.5 pr-3 text-right">{s.actual_credits}</td>
                  <td className="py-1.5 pr-3 text-right">{s.equivalent_credits}</td>
                  <td className="py-1.5 pr-3 text-right">{s.enrollment_cap}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{s.schedule_info}</td>
                  <td className="py-1.5 capitalize">{s.modality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {instWorkload.adjustments.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="font-semibold text-sm mb-3">Load Adjustments</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3 text-right">Credits</th>
                <th className="pb-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {instWorkload.adjustments.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-3">{a.description}</td>
                  <td className="py-1.5 pr-3 text-right">{a.equivalent_credits}</td>
                  <td className="py-1.5 capitalize">{a.adjustment_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={`bg-card rounded-lg border p-4 ${
        warn ? "border-destructive/50" : "border-border"
      }`}
    >
      <p className={`text-2xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
