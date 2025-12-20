import { vi } from "vitest";

export const getTodayInTimezone = vi.fn((_timezone: string = "Asia/Seoul") => "2025-01-15");
export const getStartOfDayUTC = vi.fn((date: string | Date, _timezone: string = "Asia/Seoul") => {
  const dateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCHours(0, 0, 0, 0);
  return d;
});
export const getEndOfDayUTC = vi.fn((date: string | Date, _timezone: string = "Asia/Seoul") => {
  const dateStr = typeof date === "string" ? date : date.toISOString().split("T")[0];
  const d = new Date(dateStr + "T23:59:59.999Z");
  d.setUTCHours(23, 59, 59, 999);
  return d;
});
