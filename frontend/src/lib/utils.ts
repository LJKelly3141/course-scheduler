import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLevelColor(courseNumber: string): string {
  const level = Math.floor(parseInt(courseNumber) / 100) * 100;
  const colors: Record<number, string> = {
    100: "bg-level-100",
    200: "bg-level-200",
    300: "bg-level-300",
    400: "bg-level-400",
    600: "bg-level-600",
    700: "bg-level-700",
  };
  return colors[level] || "bg-gray-400";
}

export function getLevelBorderColor(courseNumber: string): string {
  const level = Math.floor(parseInt(courseNumber) / 100) * 100;
  const colors: Record<number, string> = {
    100: "border-level-100",
    200: "border-level-200",
    300: "border-level-300",
    400: "border-level-400",
    600: "border-level-600",
    700: "border-level-700",
  };
  return colors[level] || "border-gray-400";
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function parseDaysOfWeek(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// --- Calendar grid constants ---
export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 21;
export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT_PX = 20;
export const TOTAL_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * (60 / SLOT_MINUTES); // 52
export const GRID_START_MINUTES = GRID_START_HOUR * 60; // 480

/** "09:30" → 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

/** Returns { topPx, heightPx } for absolutely positioning a meeting within a day column */
export function meetingPosition(
  startTime: string,
  endTime: string,
  slotHeight: number = SLOT_HEIGHT_PX
): { topPx: number; heightPx: number } {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const topPx = ((startMin - GRID_START_MINUTES) / SLOT_MINUTES) * slotHeight;
  const heightPx = ((endMin - startMin) / SLOT_MINUTES) * slotHeight;
  return { topPx, heightPx };
}

/** Find the time block whose start_time is closest to dropMinute, filtered to blocks containing the given day */
export function findNearestBlock(
  day: string,
  dropMinute: number,
  timeBlocks: { id: number; days_of_week: string; start_time: string; end_time: string; pattern: string; label: string }[]
): typeof timeBlocks[number] | null {
  const candidates = timeBlocks.filter((b) => {
    const days = parseDaysOfWeek(b.days_of_week);
    return days.includes(day);
  });
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestDist = Math.abs(timeToMinutes(best.start_time) - dropMinute);
  for (let i = 1; i < candidates.length; i++) {
    const dist = Math.abs(timeToMinutes(candidates[i].start_time) - dropMinute);
    if (dist < bestDist) {
      best = candidates[i];
      bestDist = dist;
    }
  }
  return best;
}

/** 13 → "1 PM", 8 → "8 AM" */
export function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12} ${ampm}`;
}
