/**
 * Unified schedule calculation module
 * Single source of truth for all date/time calculations
 *
 * This module centralizes all schedule calculation logic to avoid code duplication
 * and ensure consistent date/time handling across the application.
 */

// Re-export types and complex calculation function from calculateAvailableDates
export {
  calculateAvailableDates,
  type DayType,
  type TimeRange,
  type TimeSlot,
  type DailySchedule,
  type AcademyGroup,
  type ScheduleSummary,
  type ScheduleAvailabilityResult,
  type Block,
  type Exclusion,
  type AcademySchedule,
  type NonStudyTimeBlock,
  type SchedulerMode,
  type CalculateOptions,
} from "../calculateAvailableDates";

/**
 * Simple date-only calculation for available dates within a period.
 * Use this when you only need a list of date strings without time slot details.
 *
 * For complex scheduling with time ranges, use calculateAvailableDates instead.
 *
 * @param periodStart - Start date in YYYY-MM-DD format
 * @param periodEnd - End date in YYYY-MM-DD format
 * @param exclusions - Array of exclusion dates to skip
 * @returns Array of available date strings in YYYY-MM-DD format
 */
export function calculateAvailableDateStrings(
  periodStart: string,
  periodEnd: string,
  exclusions: { exclusion_date: string }[]
): string[] {
  // Parse dates using local timezone to avoid UTC conversion issues
  const [startYear, startMonth, startDay] = periodStart.split("-").map(Number);
  const [endYear, endMonth, endDay] = periodEnd.split("-").map(Number);

  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  const exclusionDates = new Set(
    exclusions.map((e) => e.exclusion_date.split("T")[0])
  );

  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    if (!exclusionDates.has(dateStr)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
