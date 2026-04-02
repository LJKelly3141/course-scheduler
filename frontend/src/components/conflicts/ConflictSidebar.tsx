import type { ConflictItem } from "../../api/types";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { AlertCircle, AlertTriangle } from "lucide-react";

/** Deterministic key for a warning: type + sorted meeting IDs */
export function warningKey(item: ConflictItem): string {
  const ids = [...item.meeting_ids].sort((a, b) => a - b).join(",");
  return `${item.type}:${ids}`;
}

interface Props {
  conflicts: ConflictItem[];
  warnings: ConflictItem[];
  dismissedKeys: Set<string>;
  onDismiss: (key: string) => void;
  onUndismiss: (key: string) => void;
  onClose: () => void;
}

export function ConflictSidebar({ conflicts, warnings, dismissedKeys, onDismiss, onUndismiss, onClose }: Props) {
  const activeWarnings = warnings.filter((w) => !dismissedKeys.has(warningKey(w)));
  const dismissed = warnings.filter((w) => dismissedKeys.has(warningKey(w)));

  return (
    <div className="w-72 shrink-0 bg-card rounded-lg border border-border p-4 h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Conflicts & Warnings</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
          &times;
        </button>
      </div>

      {conflicts.length === 0 && activeWarnings.length === 0 && dismissed.length === 0 && (
        <p className="text-xs text-muted-foreground">No issues found.</p>
      )}

      {conflicts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
            Hard Conflicts ({conflicts.length})
            <HelpTooltip content="Must be resolved before the term can be finalized" side="right" />
          </p>
          {conflicts.map((c, i) => (
            <div key={i} className="mb-2 p-2 bg-destructive/10 rounded border border-destructive/30 text-xs">
              <p className="font-medium text-destructive capitalize flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {c.type.replace("_", " ")}
              </p>
              <p className="text-muted-foreground mt-0.5">{c.description}</p>
            </div>
          ))}
        </div>
      )}

      {activeWarnings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
            Warnings ({activeWarnings.length})
            <HelpTooltip content="Advisory issues that don't block finalization. Dismiss warnings you've reviewed." side="right" />
          </p>
          {activeWarnings.map((w, i) => {
            const key = warningKey(w);
            return (
              <div key={i} className="mb-2 p-2 bg-warning/10 rounded border border-warning/30 text-xs group relative">
                <button
                  onClick={() => onDismiss(key)}
                  className="absolute top-1 right-1 text-warning hover:text-warning-foreground text-sm leading-none px-1"
                  aria-label="Dismiss warning"
                  title="Dismiss warning"
                >
                  &times;
                </button>
                <p className="font-medium text-warning capitalize pr-4 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {w.type.replace("_", " ")}
                </p>
                <p className="text-muted-foreground mt-0.5">{w.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {dismissed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Dismissed ({dismissed.length})
          </p>
          {dismissed.map((w, i) => {
            const key = warningKey(w);
            return (
              <div key={i} className="mb-2 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs opacity-60 group relative">
                <button
                  onClick={() => onUndismiss(key)}
                  className="absolute top-1 right-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs leading-none px-1"
                  aria-label="Restore conflict"
                  title="Restore warning"
                >
                  &#x21A9;
                </button>
                <p className="font-medium text-slate-500 dark:text-slate-400 capitalize pr-4">{w.type.replace("_", " ")}</p>
                <p className="text-muted-foreground mt-0.5">{w.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
