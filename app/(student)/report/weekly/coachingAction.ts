"use server";

/**
 * @deprecated Use @/lib/coaching instead
 * This file is kept for backward compatibility.
 */

import { getWeeklyCoaching as getWeeklyCoachingAction } from "@/lib/coaching";

export async function getWeeklyCoaching(studentId?: string) {
  return getWeeklyCoachingAction(studentId);
}
