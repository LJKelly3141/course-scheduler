import type { ReactNode } from "react";

export const FILL_GREEN = "#16a34a";
export const FILL_AMBER = "#d97706";
export const FILL_RED = "#dc2626";

export function fillColor(rate: number): string {
  if (rate >= 0.8) return FILL_GREEN;
  if (rate >= 0.6) return FILL_AMBER;
  return FILL_RED;
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
