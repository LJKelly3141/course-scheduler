import { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

export function useSort<K extends string>(defaultKey: K, defaultDir: SortDirection = "asc") {
  const [sortState, setSortState] = useState<SortState<K>>({
    key: defaultKey,
    direction: defaultDir,
  });

  const toggleSort = useCallback((key: K) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sortItems = useCallback(
    <T,>(items: T[], accessor: (item: T) => unknown): T[] => {
      const sorted = [...items].sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);

        // Nulls/undefined sort last regardless of direction
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let cmp = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
          cmp = Number(aVal) - Number(bVal);
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" });
        }

        return sortState.direction === "asc" ? cmp : -cmp;
      });
      return sorted;
    },
    [sortState.direction]
  );

  return { sortState, toggleSort, sortItems } as const;
}
