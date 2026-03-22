// ============================================
// G3-4: 메모 영역 태깅 유틸
// ============================================

import { MEMO_AREA_TYPE_LABELS, type MemoRecordAreaType } from "./types";

const CHANGCHE_LABELS: Record<string, string> = {
  autonomy: "자율·자치활동",
  club: "동아리활동",
  career: "진로활동",
};

/** 영역 ID → 표시 이름 */
export function resolveAreaLabel(
  areaType: MemoRecordAreaType | null,
  areaId: string | null,
  subjectNameMap?: Map<string, string>,
): string | null {
  if (!areaType || !areaId) return null;

  switch (areaType) {
    case "setek":
    case "personal_setek":
      return subjectNameMap?.get(areaId) ?? "과목";
    case "changche":
      return CHANGCHE_LABELS[areaId] ?? areaId;
    case "haengteuk":
      return "행동특성";
    case "reading":
      return "독서활동";
    default:
      return MEMO_AREA_TYPE_LABELS[areaType] ?? areaType;
  }
}

const AREA_COLORS: Record<MemoRecordAreaType, string> = {
  setek: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  changche: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  haengteuk: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  reading: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  personal_setek: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

/** 영역 배지 (라벨 + CSS 클래스) */
export function areaDisplayBadge(
  areaType: MemoRecordAreaType | null,
  areaId: string | null,
  subjectNameMap?: Map<string, string>,
): { label: string; color: string } | null {
  if (!areaType || !areaId) return null;
  const name = resolveAreaLabel(areaType, areaId, subjectNameMap);
  if (!name) return null;

  return {
    label: `${MEMO_AREA_TYPE_LABELS[areaType]}: ${name}`,
    color: AREA_COLORS[areaType] ?? "bg-gray-100 text-gray-600",
  };
}
