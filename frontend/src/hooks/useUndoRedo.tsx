import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UndoEntry = {
  id: string;
  label: string;
  timestamp: number;
  undoFn: () => Promise<void>;
  redoFn: () => Promise<void>;
  invalidateKeys: string[][];
};

interface UndoRedoContextValue {
  pushUndo: (entry: Omit<UndoEntry, "id" | "timestamp">) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  clearHistory: () => void;
}

const MAX_STACK = 20;

const UndoRedoContext = createContext<UndoRedoContextValue | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const processingRef = useRef(false);

  const pushUndo = useCallback((entry: Omit<UndoEntry, "id" | "timestamp">) => {
    const full: UndoEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_STACK - 1)), full]);
    setRedoStack([]);

    toast(entry.label, {
      action: {
        label: "Undo",
        onClick: () => {
          // Trigger undo of this specific entry
          setUndoStack((prev) => {
            const idx = prev.findIndex((e) => e.id === full.id);
            if (idx === -1) return prev;
            const entry = prev[idx];
            const next = prev.filter((_, i) => i !== idx);
            // Run undo asynchronously
            performUndo(entry);
            return next;
          });
        },
      },
      duration: 5000,
    });
  }, []);

  const performUndo = useCallback(async (entry: UndoEntry) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await entry.undoFn();
      setRedoStack((prev) => [...prev.slice(-(MAX_STACK - 1)), entry]);
      for (const key of entry.invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast(`Undone: ${entry.label}`, { duration: 2000 });
    } catch (e) {
      toast.error(`Undo failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      processingRef.current = false;
    }
  }, [queryClient]);

  const undo = useCallback(async () => {
    if (processingRef.current) return;
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    await performUndo(entry);
  }, [undoStack, performUndo]);

  const redo = useCallback(async () => {
    if (processingRef.current) return;
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    processingRef.current = true;
    setRedoStack((prev) => prev.slice(0, -1));
    try {
      await entry.redoFn();
      setUndoStack((prev) => [...prev.slice(-(MAX_STACK - 1)), entry]);
      for (const key of entry.invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast(`Redone: ${entry.label}`, { duration: 2000 });
    } catch (e) {
      toast.error(`Redo failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      processingRef.current = false;
    }
  }, [redoStack, queryClient]);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider
      value={{
        pushUndo,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
        redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
        clearHistory,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) throw new Error("useUndoRedo must be used within UndoRedoProvider");
  return ctx;
}
