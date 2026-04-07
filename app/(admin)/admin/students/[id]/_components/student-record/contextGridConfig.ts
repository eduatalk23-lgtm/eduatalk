// ContextGrid 열 설정 — 상수, 타입, localStorage 헬퍼

export type GridColumnKey =
  | "chat" | "guide"
  | "design_direction" | "draft" | "draft_analysis"
  | "neis" | "analysis" | "improve_direction"
  | "memo";

export const DEFAULT_COLUMNS_ANALYSIS: GridColumnKey[] = ["draft", "neis", "analysis"];
export const DEFAULT_COLUMNS_DESIGN: GridColumnKey[] = ["design_direction", "draft", "draft_analysis"];
export const MAX_COLUMNS = 3;
export const SELECTABLE_COLS: GridColumnKey[] = [
  "chat", "guide", "design_direction", "draft", "draft_analysis",
  "neis", "analysis", "improve_direction", "memo",
];
export const COL_LABELS: Record<GridColumnKey, string> = {
  chat: "논의", guide: "가이드", design_direction: "설계방향",
  draft: "가안", draft_analysis: "가안분석",
  neis: "NEIS", analysis: "분석", improve_direction: "보완방향", memo: "메모",
};

export const LS_KEY_COLUMNS = "contextGrid:selectedColumns";
export const LS_KEY_GRADE = "contextGrid:gradeFilter";
export const LS_KEY_CATEGORY = "contextGrid:categoryFilter";

export type CategoryFilter = "all" | "general" | "elective" | "pe_art";

export function readLS<T>(key: string, fallback: T, parse: (v: string) => T | null): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLS(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}
