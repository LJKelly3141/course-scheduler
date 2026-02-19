import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term } from "../api/types";

interface TermForm {
  name: string;
  type: string;
  start_date: string;
  end_date: string;
}

interface CopyForm extends TermForm {
  include_assignments: boolean;
}

const emptyForm: TermForm = { name: "", type: "fall", start_date: "", end_date: "" };

export function TermsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TermForm>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [copyingTerm, setCopyingTerm] = useState<Term | null>(null);
  const [copyForm, setCopyForm] = useState<CopyForm>({
    ...emptyForm,
    include_assignments: true,
  });

  const { data: terms = [], isLoading: loadingTerms } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get<Term[]>("/terms"),
  });

  const createMutation = useMutation({
    mutationFn: (data: TermForm) => api.post("/terms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      setForm(emptyForm);
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TermForm }) =>
      api.put(`/terms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      setEditingId(null);
      setForm(emptyForm);
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["terms"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/terms/${id}`),
    onSettled: invalidateAll,
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/terms/batch-delete", { ids }),
    onSettled: () => {
      invalidateAll();
      setSelectedIds(new Set());
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CopyForm }) =>
      api.post(`/terms/${id}/copy`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      setCopyingTerm(null);
    },
  });

  const startEdit = (term: Term) => {
    setEditingId(term.id);
    setForm({
      name: term.name,
      type: term.type,
      start_date: term.start_date,
      end_date: term.end_date,
    });
    setShowAdd(false);
  };

  const startCopy = (term: Term) => {
    setCopyingTerm(term);
    setCopyForm({
      name: `${term.name} (Copy)`,
      type: term.type,
      start_date: "",
      end_date: "",
      include_assignments: true,
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAdd(false);
    setForm(emptyForm);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === terms.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(terms.map((t) => t.id)));
  };

  const formRow = (
    <tr className="border-b border-border bg-blue-50/50">
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2">
        <input
          placeholder="e.g. Fall 2026"
          className="border border-border rounded px-2 py-1.5 text-sm w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <select
          className="border border-border rounded px-2 py-1.5 text-sm"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="fall">Fall</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="winter">Winter</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className="border border-border rounded px-2 py-1.5 text-sm"
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className="border border-border rounded px-2 py-1.5 text-sm"
          value={form.end_date}
          onChange={(e) => setForm({ ...form, end_date: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!form.name || !form.start_date || !form.end_date}
            className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
          >
            {editingId ? "Update" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="text-muted-foreground text-xs hover:underline"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Terms</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} term(s)?`))
                  batchDeleteMutation.mutate([...selectedIds]);
              }}
              className="bg-destructive text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            + Add Term
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={terms.length > 0 && selectedIds.size === terms.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">End Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {showAdd && formRow}
            {terms.map((term) =>
              editingId === term.id ? (
                <>{formRow}</>
              ) : (
                <tr key={term.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(term.id)}
                      onChange={() => toggleSelect(term.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{term.name}</td>
                  <td className="px-4 py-2.5 capitalize">{term.type}</td>
                  <td className="px-4 py-2.5">{term.start_date}</td>
                  <td className="px-4 py-2.5">{term.end_date}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startCopy(term)}
                        className="text-primary text-xs hover:underline"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => startEdit(term)}
                        className="text-primary text-xs hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${term.name}"?`))
                            deleteMutation.mutate(term.id);
                        }}
                        className="text-destructive text-xs hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {loadingTerms && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading terms...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loadingTerms && terms.length === 0 && !showAdd && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No terms yet. Click "+ Add Term" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(deleteMutation.isError || batchDeleteMutation.isError) && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-destructive">
            {((deleteMutation.error || batchDeleteMutation.error) as Error)?.message || "Failed to delete term(s)"}
          </p>
        </div>
      )}

      {/* Copy Term Dialog */}
      {copyingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCopyingTerm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-slate-50 border-b border-border px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Copy Term</h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Copying from <span className="font-medium">{copyingTerm.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setCopyingTerm(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  className="border border-border rounded px-3 py-2 text-sm w-full"
                  value={copyForm.name}
                  onChange={(e) => setCopyForm({ ...copyForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  className="border border-border rounded px-3 py-2 text-sm w-full"
                  value={copyForm.type}
                  onChange={(e) => setCopyForm({ ...copyForm, type: e.target.value })}
                >
                  <option value="fall">Fall</option>
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="winter">Winter</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="border border-border rounded px-3 py-2 text-sm w-full"
                    value={copyForm.start_date}
                    onChange={(e) => setCopyForm({ ...copyForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="border border-border rounded px-3 py-2 text-sm w-full"
                    value={copyForm.end_date}
                    onChange={(e) => setCopyForm({ ...copyForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyForm.include_assignments}
                  onChange={(e) =>
                    setCopyForm({ ...copyForm, include_assignments: e.target.checked })
                  }
                />
                <span className="text-sm text-slate-700">Include instructor & room assignments</span>
              </label>
            </div>

            <div className="border-t border-border px-6 py-3 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setCopyingTerm(null)}
                className="px-4 py-1.5 text-sm border border-border rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  copyMutation.mutate({ id: copyingTerm.id, data: copyForm })
                }
                disabled={
                  !copyForm.name || !copyForm.start_date || !copyForm.end_date || copyMutation.isPending
                }
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-medium disabled:opacity-50"
              >
                {copyMutation.isPending ? "Copying..." : "Copy Term"}
              </button>
            </div>

            {copyMutation.isError && (
              <div className="px-6 pb-3">
                <p className="text-sm text-destructive">
                  {(copyMutation.error as Error)?.message || "Failed to copy term"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
