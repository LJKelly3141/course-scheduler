import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term, TermSession } from "../api/types";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Lock, LockOpen, ClipboardPaste } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Badge } from "@/components/ui/badge";

interface TermForm {
  name: string;
  type: string;
  start_date: string;
  end_date: string;
}

interface CopyForm extends TermForm {
  include_assignments: boolean;
}

interface SessionRow {
  id?: number;
  name: string;
  start_date: string;
  end_date: string;
  head_count_days: string;
  head_count_date: string;
  notes: string;
}

const emptyForm: TermForm = { name: "", type: "fall", start_date: "", end_date: "" };

function sessionToRow(s: TermSession): SessionRow {
  return {
    id: s.id,
    name: s.name,
    start_date: s.start_date ?? "",
    end_date: s.end_date ?? "",
    head_count_days: s.head_count_days?.toString() ?? "",
    head_count_date: s.head_count_date ?? "",
    notes: s.notes ?? "",
  };
}

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
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; id: number; name: string } | { type: "batch" } | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTermId, setPasteTermId] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");

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

  const toggleLockMutation = useMutation({
    mutationFn: (id: number) => api.post<Term>(`/terms/${id}/toggle-lock`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["terms"] }),
  });

  const saveSessionsMutation = useMutation({
    mutationFn: ({ termId, sessions }: { termId: number; sessions: Array<{
      name: string;
      start_date: string | null;
      end_date: string | null;
      head_count_days: number | null;
      head_count_date: string | null;
      notes: string | null;
    }> }) =>
      api.put(`/terms/${termId}/sessions`, sessions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: ({ termId, sessionId }: { termId: number; sessionId: number }) =>
      api.delete(`/terms/${termId}/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const importSessionsMutation = useMutation({
    mutationFn: ({ termId, text, mode }: { termId: number; text: string; mode: string }) =>
      api.post(`/terms/${termId}/sessions/import`, { text, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setShowPasteDialog(false);
      setPasteText("");
      // Re-expand to show updated sessions
      if (pasteTermId) {
        const updated = terms.find(t => t.id === pasteTermId);
        if (updated) {
          // Refresh will update expandedTermId data via query invalidation
        }
      }
    },
  });

  const expandSessions = (term: Term) => {
    if (expandedTermId === term.id) {
      setExpandedTermId(null);
      return;
    }
    setExpandedTermId(term.id);
    setSessionRows((term.sessions ?? []).map(sessionToRow));
  };

  const saveSessions = (termId: number) => {
    const sessions = sessionRows.map((r) => ({
      name: r.name,
      start_date: r.start_date || null,
      end_date: r.end_date || null,
      head_count_days: r.head_count_days ? parseInt(r.head_count_days) : null,
      head_count_date: r.head_count_date || null,
      notes: r.notes || null,
    }));
    saveSessionsMutation.mutate({ termId, sessions });
  };

  const updateSessionRow = (index: number, field: keyof SessionRow, value: string) => {
    setSessionRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addSessionRow = () => {
    setSessionRows(prev => [...prev, {
      name: "",
      start_date: "",
      end_date: "",
      head_count_days: "",
      head_count_date: "",
      notes: "",
    }]);
  };

  const removeSessionRow = (index: number, termId: number) => {
    const row = sessionRows[index];
    if (row.id) {
      deleteSessionMutation.mutate({ termId, sessionId: row.id });
    }
    setSessionRows(prev => prev.filter((_, i) => i !== index));
  };

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
    <tr className="border-b border-border bg-blue-50/50 dark:bg-blue-950/50">
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
      <td className="px-4 py-2 text-xs text-muted-foreground">Auto</td>
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
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.name || !form.start_date || !form.end_date}
          >
            {editingId ? "Update" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
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
            <Button
              variant="destructive"
              onClick={() => setDeleteTarget({ type: "batch" })}
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button
            onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm); }}
          >
            <Plus className="h-4 w-4" />
            Add Term
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
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
              <th className="px-4 py-3">Academic Year</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">End Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {showAdd && formRow}
            {terms.map((term) =>
              editingId === term.id ? (
                <React.Fragment key={term.id}>{formRow}</React.Fragment>
              ) : (
                <React.Fragment key={term.id}>
                <tr className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(term.id)}
                      onChange={() => toggleSelect(term.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {term.name}
                    <Button variant="link" size="sm" className="h-auto px-1 ml-1 text-xs"
                      onClick={() => expandSessions(term)}>
                      {expandedTermId === term.id ? "▼ Sessions" : "▶ Sessions"}
                    </Button>
                  </td>
                  <td className="px-4 py-2.5 capitalize">{term.type}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {term.academic_year?.label ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">{term.start_date}</td>
                  <td className="px-4 py-2.5">{term.end_date}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 gap-1.5"
                      onClick={() => toggleLockMutation.mutate(term.id)}
                      disabled={toggleLockMutation.isPending}
                    >
                      {term.status === "final" ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <Badge variant="secondary" className="text-xs">Locked</Badge>
                        </>
                      ) : (
                        <>
                          <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Draft</span>
                        </>
                      )}
                    </Button>
                    <HelpTooltip
                      content="Locking finalizes the term. All hard conflicts must be resolved first. Unlock to edit again."
                      side="right"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => startCopy(term)}>
                        Copy
                      </Button>
                      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => startEdit(term)} disabled={term.status === "final"}>
                        Edit
                      </Button>
                      <Button variant="link" size="sm" className="h-auto px-0 text-destructive" onClick={() => setDeleteTarget({ type: "single", id: term.id, name: term.name })} disabled={term.status === "final"}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedTermId === term.id && (
                  <tr>
                    <td colSpan={8} className="px-8 py-3 bg-blue-50/50 dark:bg-blue-950/50 border-b border-border">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sessions</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setPasteTermId(term.id);
                              setShowPasteDialog(true);
                            }} disabled={term.status === "final"}>
                              <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                              Paste Sessions
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-border rounded">
                            <thead>
                              <tr className="bg-muted/30 border-b border-border">
                                <th className="px-2 py-1.5 text-left w-24">Session</th>
                                <th className="px-2 py-1.5 text-left">Start Date</th>
                                <th className="px-2 py-1.5 text-left">End Date</th>
                                <th className="px-2 py-1.5 text-left w-20">HC Days</th>
                                <th className="px-2 py-1.5 text-left">HC Date</th>
                                <th className="px-2 py-1.5 text-left">Notes</th>
                                <th className="px-2 py-1.5 w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionRows.map((row, i) => (
                                <tr key={i} className="border-b border-border/50">
                                  <td className="px-2 py-1">
                                    <input
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.name}
                                      onChange={(e) => updateSessionRow(i, "name", e.target.value)}
                                      disabled={term.status === "final"}
                                      placeholder="e.g. 1-3"
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="date"
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.start_date}
                                      onChange={(e) => updateSessionRow(i, "start_date", e.target.value)}
                                      disabled={term.status === "final"}
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="date"
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.end_date}
                                      onChange={(e) => updateSessionRow(i, "end_date", e.target.value)}
                                      disabled={term.status === "final"}
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="number"
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.head_count_days}
                                      onChange={(e) => updateSessionRow(i, "head_count_days", e.target.value)}
                                      disabled={term.status === "final"}
                                      placeholder=""
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="date"
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.head_count_date}
                                      onChange={(e) => updateSessionRow(i, "head_count_date", e.target.value)}
                                      disabled={term.status === "final"}
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      className="border border-border rounded px-1.5 py-1 text-xs w-full"
                                      value={row.notes}
                                      onChange={(e) => updateSessionRow(i, "notes", e.target.value)}
                                      disabled={term.status === "final"}
                                      placeholder=""
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    {term.status !== "final" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-destructive"
                                        onClick={() => removeSessionRow(i, term.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {term.status !== "final" && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={addSessionRow}>
                              <Plus className="h-3 w-3 mr-1" />
                              Add Session
                            </Button>
                            <Button size="sm" onClick={() => saveSessions(term.id)} disabled={saveSessionsMutation.isPending}>
                              {saveSessionsMutation.isPending ? "Saving..." : "Save Sessions"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )
            )}
            {loadingTerms && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading terms...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loadingTerms && terms.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No terms yet. Click "+ Add Term" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(deleteMutation.isError || batchDeleteMutation.isError) && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
          <p className="text-sm text-destructive">
            {((deleteMutation.error || batchDeleteMutation.error) as Error)?.message || "Failed to delete term(s)"}
          </p>
        </div>
      )}

      {/* Copy Term Dialog */}
      <Dialog open={!!copyingTerm} onOpenChange={(open) => { if (!open) setCopyingTerm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Term</DialogTitle>
            <DialogDescription>
              Copying from <span className="font-medium">{copyingTerm?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                className="border border-border rounded px-3 py-2 text-sm w-full"
                value={copyForm.name}
                onChange={(e) => setCopyForm({ ...copyForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
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
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  className="border border-border rounded px-3 py-2 text-sm w-full"
                  value={copyForm.start_date}
                  onChange={(e) => setCopyForm({ ...copyForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
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
              <span className="text-sm">Include instructor & room assignments</span>
            </label>

            {copyMutation.isError && (
              <p className="text-sm text-destructive">
                {(copyMutation.error as Error)?.message || "Failed to copy term"}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyingTerm(null)}>Cancel</Button>
            <Button
              onClick={() => copyingTerm && copyMutation.mutate({ id: copyingTerm.id, data: copyForm })}
              disabled={!copyForm.name || !copyForm.start_date || !copyForm.end_date || copyMutation.isPending}
            >
              {copyMutation.isPending ? "Copying..." : "Copy Term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste Sessions Dialog */}
      <Dialog open={showPasteDialog} onOpenChange={(open) => { if (!open) { setShowPasteDialog(false); setPasteText(""); setImportMode("merge"); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste Session Table</DialogTitle>
            <DialogDescription>
              Paste a tab-separated or comma-separated table.
              Expected columns: Session, Start Date, End Date, HC Days, HC Date, Notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">Merge</span>
                  <p className="text-xs text-muted-foreground">Add new sessions and update existing ones by name</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">Replace</span>
                  <p className="text-xs text-muted-foreground">Remove all existing sessions and import fresh. Sections on removed sessions will be unassigned.</p>
                </div>
              </label>
            </div>
            <textarea
              className="border border-border rounded px-3 py-2 text-sm w-full font-mono h-48 resize-y"
              placeholder={"Session\tStart Date\tEnd Date\tHC Days\tHC Date\tNotes\n1-3\t6/9/2025\t6/27/2025\t5\t6/13/2025\t\n1-6\t6/9/2025\t7/18/2025\t10\t6/19/2025\t"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            {importSessionsMutation.isError && (
              <p className="text-sm text-destructive">
                {(importSessionsMutation.error as Error)?.message || "Failed to import sessions"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasteDialog(false); setPasteText(""); setImportMode("merge"); }}>
              Cancel
            </Button>
            <Button
              onClick={() => pasteTermId && importSessionsMutation.mutate({ termId: pasteTermId, text: pasteText, mode: importMode })}
              disabled={!pasteText.trim() || importSessionsMutation.isPending}
            >
              {importSessionsMutation.isPending ? "Importing..." : "Import Sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.type === "batch" ? `Delete ${selectedIds.size} term(s)?` : `Delete "${deleteTarget?.type === "single" ? deleteTarget.name : ""}"?`}
        description="This will permanently delete the term(s) and all associated sections and meetings."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget?.type === "batch") {
            batchDeleteMutation.mutate([...selectedIds]);
          } else if (deleteTarget?.type === "single") {
            deleteMutation.mutate(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
