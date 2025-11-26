const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDate(value: string): Date | null {
  if (!isIsoDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatKoreanDate(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  if (!date) {
    return "-";
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}년 ${month}월 ${day}일`;
}

export function formatKoreanDateWithDay(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  if (!date) {
    return "-";
  }

  const base = formatKoreanDate(dateStr);
  const dayName = DAY_NAMES[date.getDay()] ?? "";

  return `${base} (${dayName})`;
}

export function getRelativeDateLabel(
  targetDateStr: string,
  baseDateStr?: string
): string {
  const target = parseIsoDate(targetDateStr);
  const resolvedBase =
    (baseDateStr && parseIsoDate(baseDateStr)) ||
    (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

  if (!target || !resolvedBase) {
    return "-";
  }

  // 동일 기준으로 맞추기
  target.setHours(0, 0, 0, 0);
  resolvedBase.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - resolvedBase.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays === 2) return "모레";
  if (diffDays === -1) return "어제";
  if (diffDays === -2) return "그제";
  if (diffDays > 2 && diffDays <= 7) return `${diffDays}일 후`;
  if (diffDays < -2 && diffDays >= -7) return `${Math.abs(diffDays)}일 전`;

  return formatKoreanDate(targetDateStr);
}

export function getTodayISODate(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

