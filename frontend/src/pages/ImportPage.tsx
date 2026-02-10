import { useState } from "react";
import { api } from "../api/client";

type ImportType = "rooms" | "instructors" | "courses";

export function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("rooms");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: Record<string, string>[]; errors: string[]; valid_count: number } | null>(null);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{ rows: Record<string, string>[]; errors: string[]; valid_count: number }>(
        `/import/${importType}?preview=true`, formData
      );
      setPreview(res);
    } catch (e) {
      setPreview({ rows: [], errors: [e instanceof Error ? e.message : "Upload failed"], valid_count: 0 });
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{ created: number; errors: string[] }>(
        `/import/${importType}`, formData
      );
      setResult(res);
      setPreview(null);
      setFile(null);
    } catch (e) {
      setResult({ created: 0, errors: [e instanceof Error ? e.message : "Import failed"] });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">CSV Import</h2>

      <div className="bg-white rounded-lg border border-border p-6 space-y-4">
        <div className="flex gap-4 items-center">
          <select className="border border-border rounded-md px-3 py-2 text-sm"
            value={importType} onChange={(e) => { setImportType(e.target.value as ImportType); setPreview(null); setResult(null); }}>
            <option value="rooms">Rooms</option>
            <option value="instructors">Instructors</option>
            <option value="courses">Courses</option>
          </select>

          <input type="file" accept=".csv" className="text-sm"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }} />

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
        </div>

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
                          <td key={j} className="px-2 py-1">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.valid_count > 0 && (
              <button onClick={handleConfirm} disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90">
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
