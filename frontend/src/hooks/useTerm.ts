import { useState } from "react";
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

  const selectedTerm = terms.find((t) => t.id === selectedTermId) || terms[0] || null;

  const selectTerm = (id: number) => {
    setSelectedTermId(id);
    localStorage.setItem("selectedTermId", String(id));
  };

  // Auto-select first term
  if (!selectedTermId && terms.length > 0) {
    selectTerm(terms[0].id);
  }

  return { terms, selectedTerm, selectTerm };
}
