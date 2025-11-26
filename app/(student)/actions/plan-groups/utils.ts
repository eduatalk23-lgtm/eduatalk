/**
 * plan_purpose 값을 그대로 저장 (변환 없음)
 * "내신대비", "모의고사(수능)" 그대로 저장
 */
export function normalizePlanPurpose(
  purpose: string | null | undefined
): string | null {
  if (!purpose) return null;
  // 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  return purpose;
}

/**
 * 시간 문자열을 분 단위로 변환
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

