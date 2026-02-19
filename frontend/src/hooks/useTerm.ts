import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Term } from "../api/types";

export function useTerm() {
  const [selectedTermId, setSelectedTermId] = useState<number | null>(() => {
    const stored = localStorage.getItem("selectedTermId");
    return stored ? parseInt(stored) : null;
  });

  const { data: terms = [] } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get<Term[]>("/terms"),
  });

  const matchedTerm = terms.find((t) => t.id === selectedTermId);
  const selectedTerm = matchedTerm || terms[0] || null;

  const selectTerm = (id: number) => {
    setSelectedTermId(id);
    localStorage.setItem("selectedTermId", String(id));
  };

  // Auto-select first term, or clear stale selection
  useEffect(() => {
    if (terms.length > 0 && !matchedTerm) {
      selectTerm(terms[0].id);
    } else if (terms.length === 0 && selectedTermId !== null) {
      setSelectedTermId(null);
      localStorage.removeItem("selectedTermId");
    }
  }, [terms, matchedTerm, selectedTermId]);

  return { terms, selectedTerm, selectTerm };
}
