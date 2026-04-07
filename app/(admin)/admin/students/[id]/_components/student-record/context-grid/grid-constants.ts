// ============================================
// 컨텍스트 그리드 공통 상수
// ContextGrid / ContextGridChangche / ContextGridHaengteuk 3형제 공유
// ============================================

import type { GridColumnKey } from "../ContextGridBottomSheet";

export const PERSPECTIVES = ["ai", "consultant", "confirmed"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];

export const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  ai: "AI",
  consultant: "컨설턴트",
  confirmed: "확정",
};

/** 열별 rowSpan: 관점 구분이 없는 열은 3, 3행 분리는 1 */
export const COL_ROW_SPAN: Record<GridColumnKey, number> = {
  chat: 3,
  guide: 1,
  design_direction: 1,
  draft: 1,
  draft_analysis: 1,
  neis: 3,
  analysis: 1,
  improve_direction: 1,
  memo: 3,
};

export const COL_LABELS: Record<GridColumnKey, string> = {
  chat: "논의",
  guide: "가이드",
  design_direction: "설계방향",
  draft: "가안",
  draft_analysis: "가안분석",
  neis: "NEIS",
  analysis: "분석",
  improve_direction: "보완방향",
  memo: "메모",
};

/** 3행 분리 열의 관점별 라벨 (열마다 다른 이름) */
export const COL_PERSPECTIVE_LABELS: Partial<Record<GridColumnKey, Record<Perspective, string>>> = {
  draft: { ai: "AI 초안", consultant: "컨설턴트 가안", confirmed: "확정본" },
  draft_analysis: { ai: "AI 분석", consultant: "컨설턴트", confirmed: "확정" },
  analysis: { ai: "AI 분석", consultant: "컨설턴트", confirmed: "확정" },
  guide: { ai: "AI 추천", consultant: "배정 목록", confirmed: "완료" },
  design_direction: { ai: "AI 설계", consultant: "컨설턴트", confirmed: "확정" },
  improve_direction: { ai: "AI 보완", consultant: "컨설턴트", confirmed: "확정" },
};
