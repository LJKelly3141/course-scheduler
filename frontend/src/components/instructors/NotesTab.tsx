import { useState } from "react";
import { toast } from "sonner";
import type { Instructor, InstructorNote } from "@/api/types";
import { useInstructorNotes, useCreateNote, useDeleteNote } from "@/hooks/useInstructorHub";

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-stone-800 text-stone-300" },
  { value: "scheduling", label: "Scheduling", color: "bg-blue-900/60 text-blue-300" },
  { value: "contract", label: "Contract", color: "bg-lime-900/60 text-lime-300" },
  { value: "performance", label: "Performance", color: "bg-orange-900/60 text-orange-300" },
] as const;

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

interface NotesTabProps {
  instructor: Instructor;
  termId: number | null;
  terms: Array<{ id: number; name: string }>;
}

export function NotesTab({ instructor, termId, terms }: NotesTabProps) {
  const [filterCategory, setFilterCategory] = useState("all");
  const [newCategory, setNewCategory] = useState("general");
  const [newTermId, setNewTermId] = useState<number | null>(null);
  const [newContent, setNewContent] = useState("");

  const { data: notes = [] } = useInstructorNotes(instructor.id);
  const createMutation = useCreateNote();
  const deleteMutation = useDeleteNote();

  const filteredNotes = notes
    .filter((n: InstructorNote) => filterCategory === "all" || n.category === filterCategory)
    .sort((a: InstructorNote, b: InstructorNote) => b.id - a.id);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    createMutation.mutate(
      {
        instructorId: instructor.id,
        term_id: newTermId,
        category: newCategory,
        content: newContent.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Note added");
          setNewContent("");
        },
      }
    );
  };

  const handleDelete = (noteId: number) => {
    deleteMutation.mutate(
      { instructorId: instructor.id, noteId },
      { onSuccess: () => toast.success("Note deleted") }
    );
  };

  const termName = (id: number | null) => {
    if (!id) return "General";
    return terms.find((t) => t.id === id)?.name ?? `Term ${id}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="bg-card border border-border rounded-lg p-4 mb-5">
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <select
              className="w-full bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Term (optional)</label>
            <select
              className="w-full bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
              value={newTermId ?? ""}
              onChange={(e) => setNewTermId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">None — general note</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          placeholder="Add a note..."
          className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground min-h-[60px] resize-y mb-3"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || createMutation.isPending}
            className="px-4 py-1.5 text-sm text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            Save Note
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 text-xs">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-2.5 py-1 rounded ${
            filterCategory === "all"
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground border border-border hover:text-foreground"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(c.value)}
            className={`px-2.5 py-1 rounded ${
              filterCategory === c.value
                ? "bg-muted/50 text-foreground"
                : "text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filteredNotes.map((note: InstructorNote) => {
          const cat = CATEGORY_MAP[note.category] ?? CATEGORY_MAP.general;
          return (
            <div key={note.id} className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                  <span className="text-xs text-muted-foreground">{termName(note.term_id)}</span>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
            </div>
          );
        })}
        {filteredNotes.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No notes found</div>
        )}
      </div>
    </div>
  );
}
