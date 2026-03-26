// ============================================
// Phase 3: 레이어 뷰 타입 정의
// ============================================

// --- 레이어 ---
export const LAYER_IDS = [
  "guide",       // 📘가이드
  "deliverable", // 📎결과물
  "draft",       // 📝가안
  "actual",      // 📄실생기부
  "analysis",    // 🔍분석
  "direction",   // 📝방향
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export const LAYER_META: Record<LayerId, { emoji: string; label: string }> = {
  guide: { emoji: "📘", label: "가이드" },
  deliverable: { emoji: "📎", label: "결과물" },
  draft: { emoji: "📝", label: "가안" },
  actual: { emoji: "📄", label: "실생기부" },
  analysis: { emoji: "🔍", label: "분석" },
  direction: { emoji: "📝", label: "방향" },
};

// --- 관점 ---
export const PERSPECTIVE_IDS = ["ai", "consultant", "confirmed"] as const;
export type PerspectiveId = (typeof PERSPECTIVE_IDS)[number];

export const PERSPECTIVE_META: Record<PerspectiveId, { emoji: string; label: string }> = {
  ai: { emoji: "🤖", label: "AI" },
  consultant: { emoji: "👤", label: "컨설턴트" },
  confirmed: { emoji: "✅", label: "확정" },
};

// --- 영역 ---
export interface RecordArea {
  /** 유니크 키: "setek-{subjectId}-{grade}" 등 */
  id: string;
  /** NEIS 섹션 번호 */
  sectionNumber: 6 | 7 | 8 | 9;
  /** 기록 유형 */
  type: "changche" | "setek" | "reading" | "haengteuk";
  /** 표시 라벨: "세특-국어", "창체-진로" 등 */
  label: string;
  /** 학년 */
  grade: number;
  /** 세특 과목 ID */
  subjectId?: string;
  /** 창체 활동 유형 */
  activityType?: "autonomy" | "club" | "career";
  /** DB 레코드 ID (존재 시) */
  recordId?: string;
}

// --- 요약 ---
export interface AreaSummary {
  /** 주요 요약 텍스트 */
  text: string;
  /** 상태 배지 (assigned, completed 등) */
  badge?: string;
  /** 글자 수 */
  charCount?: number;
  /** 글자 제한 */
  charLimit?: number;
  /** 데이터 없음 여부 */
  isEmpty: boolean;
}

// --- NEIS 섹션 ---
export const NEIS_SECTIONS = [
  { number: 6 as const, label: "창의적 체험활동" },
  { number: 7 as const, label: "교과학습발달" },
  { number: 8 as const, label: "독서활동" },
  { number: 9 as const, label: "행동특성 및 종합의견" },
] as const;

// --- 레벨 2: 레이어별 기본 폭 비율 ---
export const LAYER_DEFAULT_WIDTH: Record<LayerId, number> = {
  guide: 20,
  deliverable: 15,
  draft: 30,
  actual: 20,
  analysis: 20,
  direction: 20,
};

/** 선택된 레이어들의 grid-template-columns 문자열 생성 (최소 180px) */
export function buildGridColumns(layers: LayerId[]): string {
  return layers.map((l) => `minmax(180px, ${LAYER_DEFAULT_WIDTH[l]}fr)`).join(" ");
}

/** 레벨 2 기본 선택 레이어 */
export const DEFAULT_SELECTED_LAYERS: LayerId[] = ["draft", "actual"];

// --- 레벨 3: 관점별 기본 폭 비율 ---
export const PERSPECTIVE_DEFAULT_WIDTH: Record<PerspectiveId, number> = {
  ai: 35,
  consultant: 35,
  confirmed: 30,
};

/** 선택된 관점들의 grid-template-columns 문자열 생성 (최소 200px) */
export function buildPerspectiveGridColumns(perspectives: PerspectiveId[]): string {
  return perspectives.map((p) => `minmax(200px, ${PERSPECTIVE_DEFAULT_WIDTH[p]}fr)`).join(" ");
}

/** 레벨 3 기본 선택 관점 */
export const DEFAULT_SELECTED_PERSPECTIVES: PerspectiveId[] = ["ai", "consultant"];

// --- 공유 데이터 타입 (Level2View, Level3View, BottomSheet, useAreaData 공통) ---

export interface LayerGuideAssignment {
  id: string;
  status: string;
  target_subject_id: string | null;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
  confirmed_at: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
}

export interface LayerActivityTag {
  id?: string;
  record_type: string;
  record_id: string;
  competency_item?: string;
  evaluation?: string;
  evidence_summary?: string;
  source?: string;
  status?: string;
}

export interface LayerSetekGuide {
  id?: string;
  subject_id: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus?: string[];
  cautions?: string | null;
  teacher_points?: string[];
}

// --- 접근성: focus-visible 공통 클래스 ---

export const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500";
