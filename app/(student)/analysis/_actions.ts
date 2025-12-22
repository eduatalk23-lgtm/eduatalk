"use server";

/**
 * @deprecated Use @/lib/domains/analysis instead
 * This file is kept for backward compatibility.
 */

import { recalculateRiskIndex as recalculateRiskIndexAction } from "@/lib/domains/analysis";

export async function recalculateRiskIndex() {
  return recalculateRiskIndexAction();
}
