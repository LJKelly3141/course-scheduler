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
