import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term } from "../api/types";

type ImportType = "rooms" | "instructors" | "courses" | "schedule";

interface InstructorMatchEntry {
  id: number;
  name: string;
  email: string;
  score: number;
}

interface InstructorMatch {
  name: string;
  matches: InstructorMatchEntry[];
}

interface SchedulePreview {
  rows: Record<string, string>[];
  errors: string[];
  valid_count: number;
  suggested_term?: { name: string; type: string; start_date: string; end_date: string } | null;
  instructor_matches?: InstructorMatch[];
}

export function ImportPage() {
  const { selectedTerm } = useOutletContext<{ selectedTerm: Term | null }>();
  const queryClient = useQueryClient();
  const [importType, setImportType] = useState<ImportType>("rooms");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Term selection for schedule import
  const [termMode, setTermMode] = useState<"existing" | "new">("existing");
  const [newTerm, setNewTerm] = useState({ name: "", type: "semester", start_date: "", end_date: "" });
  const [importTermId, setImportTermId] = useState<number | null>(null);

  // Instructor mappings: imported name -> existing instructor id (null = create new)
  const [instructorMappings, setInstructorMappings] = useState<Record<string, number | null>>({});

  const { data: terms = [] } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get<Term[]>("/terms"),
  });

  const isSchedule = importType === "schedule";
  const effectiveTermId = isSchedule
    ? (termMode === "existing" ? (importTermId ?? selectedTerm?.id ?? null) : null)
    : null;

  const handleUpload = async () => {
    if (!file) return;
    if (isSchedule && termMode === "existing" && !effectiveTermId && terms.length > 0) {
      setPreview({ rows: [], errors: ["Please select a term"], valid_count: 0 });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // For schedule preview, we need a term_id but it's just for the endpoint signature
      // We use the selected term or the first available term
      const termIdForPreview = effectiveTermId ?? terms[0]?.id ?? 0;
      const termParam = isSchedule ? `&term_id=${termIdForPreview}` : "";
      const res = await api.upload<SchedulePreview>(
        `/import/${importType}?preview=true${termParam}`, formData
      );
      setPreview(res);

      if (isSchedule && res.suggested_term) {
        // Pre-fill new term form with suggested values
        setNewTerm(res.suggested_term);
        // If no existing terms match, default to new term mode
        if (terms.length === 0) {
          setTermMode("new");
        }
      }

      // Initialize instructor mappings from preview matches
      if (isSchedule && res.instructor_matches) {
        const initialMappings: Record<string, number | null> = {};
        for (const match of res.instructor_matches) {
          if (match.matches.length > 0 && match.matches[0].score === 1.0) {
            // Exact match: auto-link
            initialMappings[match.name] = match.matches[0].id;
          } else {
            // No exact match: default to create new
            initialMappings[match.name] = null;
          }
        }
        setInstructorMappings(initialMappings);
      }
    } catch (e) {
      setPreview({ rows: [], errors: [e instanceof Error ? e.message : "Upload failed"], valid_count: 0 });
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      let termId = effectiveTermId;

      // If creating a new term, do that first
      if (isSchedule && termMode === "new") {
        const created = await api.post<Term>("/terms", newTerm);
        termId = created.id;
        queryClient.invalidateQueries({ queryKey: ["terms"] });
      }

      if (isSchedule && !termId) {
        setResult({ created: 0, errors: ["No term selected"] });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      let url = `/import/${importType}?preview=false`;
      if (isSchedule) {
        url += `&term_id=${termId}`;
        // Send instructor mappings
        const mappingsJson = JSON.stringify(instructorMappings);
        url += `&instructor_mappings=${encodeURIComponent(mappingsJson)}`;
      }

      const res = await api.upload<{ created: number; errors: string[] }>(url, formData);
      setResult(res);
      setPreview(null);
      setFile(null);
      if (isSchedule) {
        queryClient.invalidateQueries({ queryKey: ["terms"] });
        queryClient.invalidateQueries({ queryKey: ["sections"] });
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        queryClient.invalidateQueries({ queryKey: ["instructors"] });
      }
    } catch (e) {
      setResult({ created: 0, errors: [e instanceof Error ? e.message : "Import failed"] });
    }
    setLoading(false);
  };

  const resetState = () => {
    setPreview(null);
    setResult(null);
    setFile(null);
    setInstructorMappings({});
    setTermMode("existing");
    setNewTerm({ name: "", type: "semester", start_date: "", end_date: "" });
    setImportTermId(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Data Import</h2>

      <div className="bg-white rounded-lg border border-border p-6 space-y-4">
        <div className="flex gap-4 items-center flex-wrap">
          <select className="border border-border rounded-md px-3 py-2 text-sm"
            value={importType} onChange={(e) => { setImportType(e.target.value as ImportType); resetState(); }}>
            <option value="rooms">Rooms (CSV)</option>
            <option value="instructors">Instructors (CSV)</option>
            <option value="courses">Courses (CSV)</option>
            <option value="schedule">Schedule (XLSX)</option>
          </select>

          <input
            type="file"
            accept={isSchedule ? ".xlsx" : ".csv"}
            className="text-sm"
            key={importType}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }}
          />

          <button onClick={handleUpload} disabled={!file || loading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? "Processing..." : "Preview"}
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Expected columns:</p>
          {importType === "rooms" && <p>building_name, building_abbreviation, room_number, capacity</p>}
          {importType === "instructors" && <p>name, email, department, modality_constraint, max_credits</p>}
          {importType === "courses" && <p>department_code, course_number, title, credits</p>}
          {importType === "schedule" && (
            <p>XLSX file with columns: Class, Course, Section, Days &amp; Times, Room, Instructor</p>
          )}
        </div>

        {/* Term selection for schedule import - shown after preview */}
        {isSchedule && preview && preview.valid_count > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
            <p className="text-sm font-medium">Select Term for Import</p>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="termMode"
                  checked={termMode === "existing"}
                  onChange={() => setTermMode("existing")}
                />
                Existing term
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="termMode"
                  checked={termMode === "new"}
                  onChange={() => setTermMode("new")}
                />
                Create new term
              </label>
            </div>

            {termMode === "existing" ? (
              <select
                className="border border-border rounded px-3 py-2 text-sm"
                value={importTermId ?? selectedTerm?.id ?? ""}
                onChange={(e) => setImportTermId(Number(e.target.value))}
              >
                {terms.length === 0 && <option value="">No terms available</option>}
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.status === "final" ? "(Final)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <input
                  placeholder="Term name"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.name}
                  onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })}
                />
                <select
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.type}
                  onChange={(e) => setNewTerm({ ...newTerm, type: e.target.value })}
                >
                  <option value="semester">Semester</option>
                  <option value="quarter">Quarter</option>
                </select>
                <input
                  type="date"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.start_date}
                  onChange={(e) => setNewTerm({ ...newTerm, start_date: e.target.value })}
                />
                <input
                  type="date"
                  className="border border-border rounded px-2 py-1.5 text-sm"
                  value={newTerm.end_date}
                  onChange={(e) => setNewTerm({ ...newTerm, end_date: e.target.value })}
                />
              </div>
            )}

            {preview.suggested_term && termMode === "existing" && (
              <p className="text-xs text-blue-600">
                Detected dates suggest: {preview.suggested_term.name} ({preview.suggested_term.start_date} to {preview.suggested_term.end_date}).{" "}
                <button
                  className="underline font-medium"
                  onClick={() => { setTermMode("new"); setNewTerm(preview.suggested_term!); }}
                >
                  Create this term
                </button>
              </p>
            )}
          </div>
        )}

        {/* Instructor matching section */}
        {isSchedule && preview && preview.instructor_matches && preview.instructor_matches.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-3">
            <p className="text-sm font-medium">Instructor Matching</p>
            <p className="text-xs text-muted-foreground">
              Review how imported instructors map to existing records. Adjust as needed before confirming.
            </p>
            <div className="space-y-2">
              {preview.instructor_matches.map((match) => (
                <div key={match.name} className="flex items-center gap-3 text-sm">
                  <span className="w-56 font-medium truncate" title={match.name}>{match.name}</span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    className="border border-border rounded px-2 py-1.5 text-sm flex-1 max-w-sm"
                    value={instructorMappings[match.name] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInstructorMappings({
                        ...instructorMappings,
                        [match.name]: val === "" ? null : Number(val),
                      });
                    }}
                  >
                    <option value="">Create new instructor</option>
                    {match.matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email}) — {Math.round(m.score * 100)}% match
                      </option>
                    ))}
                  </select>
                  {instructorMappings[match.name] === null && (
                    <span className="text-xs text-amber-600 font-medium">New</span>
                  )}
                  {instructorMappings[match.name] !== null && instructorMappings[match.name] !== undefined && (
                    <span className="text-xs text-green-600 font-medium">Linked</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{preview.valid_count} valid rows found</p>
            {preview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                {preview.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              </div>
            )}
            {preview.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {Object.keys(preview.rows[0]).map((k) => (
                        <th key={k} className="px-2 py-1 text-left">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1">{String(v ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing first 10 of {preview.rows.length} rows
                  </p>
                )}
              </div>
            )}
            {preview.valid_count > 0 && (
              <button onClick={handleConfirm}
                disabled={loading || (isSchedule && termMode === "existing" && !effectiveTermId && terms.length === 0) || (isSchedule && termMode === "new" && !newTerm.name)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">
                Confirm Import ({preview.valid_count} rows)
              </button>
            )}
          </div>
        )}

        {result && (
          <div className={`p-3 rounded ${result.errors.length > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
            <p className="text-sm font-medium">Import complete: {result.created} records created</p>
            {result.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
