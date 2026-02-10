import type { ConflictItem } from "../../api/types";

interface Props {
  conflicts: ConflictItem[];
  warnings: ConflictItem[];
  onClose: () => void;
}

export function ConflictSidebar({ conflicts, warnings, onClose }: Props) {
  return (
    <div className="w-72 shrink-0 bg-white rounded-lg border border-border p-4 h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Conflicts & Warnings</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
          &times;
        </button>
      </div>

      {conflicts.length === 0 && warnings.length === 0 && (
        <p className="text-xs text-muted-foreground">No issues found.</p>
      )}

      {conflicts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-destructive mb-2">
            Hard Conflicts ({conflicts.length})
          </p>
          {conflicts.map((c, i) => (
            <div key={i} className="mb-2 p-2 bg-red-50 rounded border border-red-200 text-xs">
              <p className="font-medium text-destructive capitalize">{c.type.replace("_", " ")}</p>
              <p className="text-muted-foreground mt-0.5">{c.description}</p>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-700 mb-2">
            Warnings ({warnings.length})
          </p>
          {warnings.map((w, i) => (
            <div key={i} className="mb-2 p-2 bg-yellow-50 rounded border border-yellow-200 text-xs">
              <p className="font-medium text-yellow-700 capitalize">{w.type.replace("_", " ")}</p>
              <p className="text-muted-foreground mt-0.5">{w.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
