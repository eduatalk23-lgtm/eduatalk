// ============================================
// Phase 2.1 — Layer View 중앙 정의
// 9 레이어 × 2 관점 (AI/컨설턴트) 매트릭스
// 생기부 모형(NEIS 스타일 문서)에서 각 셀의 내용을 선택된 레이어·관점으로 해소
// ============================================

/** 레이어 키 — ContextGrid의 GridColumnKey와 동일한 9개 */
export type LayerKey =
  | "neis"
  | "draft"
  | "draft_analysis"
  | "analysis"
  | "design_direction"
  | "improve_direction"
  | "guide"
  | "chat"
  | "memo";

/** 관점 — 파이프라인 source 기준과 일치 */
export type LayerPerspective = "ai" | "consultant";

/** 레이어별 메타 */
export interface LayerDefinition {
  key: LayerKey;
  label: string;
  /** 부제 — 레이어가 무엇인지 한 줄 설명 */
  description: string;
  /** 지원하는 관점 목록 (빈 배열이면 단일뷰 — 관점 선택 UI 비활성화) */
  perspectives: LayerPerspective[];
  /** 이 레이어가 다루는 기록 영역 (세특/창체/행특 중 어디) */
  scope: Array<"setek" | "changche" | "haengteuk">;
  /** 데이터 소스 요약 (개발자 참조용) */
  dataSource: string;
  /**
   * 관점 선택이 의미 있는가?
   * - true: 드롭다운에서 AI/컨설턴트 선택 가능
   * - false: 단일 뷰 (관점 드롭다운 비활성화)
   */
  hasPerspectiveAxis: boolean;
}

export const LAYER_DEFINITIONS: Record<LayerKey, LayerDefinition> = {
  neis: {
    key: "neis",
    label: "NEIS",
    description: "NEIS에서 임포트한 최종본",
    perspectives: [],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "imported_content",
    hasPerspectiveAxis: false,
  },
  draft: {
    key: "draft",
    label: "가안",
    description: "작성 중인 기록 (확정 전)",
    perspectives: ["ai", "consultant"],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "ai_draft_content / content / confirmed_content",
    hasPerspectiveAxis: true,
  },
  draft_analysis: {
    key: "draft_analysis",
    label: "가안 분석",
    description: "AI 가안에 대한 역량 분석 (설계 모드)",
    perspectives: ["ai"], // 가안은 AI 생성물이므로 컨설턴트 관점 없음
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "competency_scores(source='ai_projected') + tags(tag_context='draft_analysis')",
    hasPerspectiveAxis: false,
  },
  analysis: {
    key: "analysis",
    label: "분석",
    description: "NEIS/확정본 기반 역량 분석 결과",
    perspectives: ["ai", "consultant"],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "competency_scores(source='ai'/'manual') + tags(tag_context='analysis') + content_quality",
    hasPerspectiveAxis: true,
  },
  design_direction: {
    key: "design_direction",
    label: "설계 방향",
    description: "NEIS 없는 학년에 대한 AI 가이드 (prospective)",
    perspectives: ["ai", "consultant"],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "setek/changche/haengteuk_guides(guide_mode='prospective', source='ai'/'manual')",
    hasPerspectiveAxis: true,
  },
  improve_direction: {
    key: "improve_direction",
    label: "보완 방향",
    description: "NEIS 기반 보완 가이드 (retrospective)",
    perspectives: ["ai", "consultant"],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "setek/changche/haengteuk_guides(guide_mode='retrospective', source='ai'/'manual')",
    hasPerspectiveAxis: true,
  },
  guide: {
    key: "guide",
    label: "탐구 가이드",
    description: "학생에게 배정된 탐구 가이드",
    perspectives: ["ai", "consultant"],
    scope: ["setek", "changche"],
    dataSource: "exploration_guide_assignments",
    hasPerspectiveAxis: true,
  },
  chat: {
    key: "chat",
    label: "논의",
    description: "이 기록에 대한 채팅 이력 요약",
    perspectives: [],
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "chat 이력 (future)",
    hasPerspectiveAxis: false,
  },
  memo: {
    key: "memo",
    label: "메모",
    description: "컨설턴트의 자유 메모",
    perspectives: ["consultant"], // 컨설턴트 전용
    scope: ["setek", "changche", "haengteuk"],
    dataSource: "memo 필드 (future)",
    hasPerspectiveAxis: false,
  },
};

/**
 * 레이어 키 순서 — ContextGrid의 SELECTABLE_COLS와 동일.
 * 기록의 생명주기 흐름을 반영:
 *   논의 → 가이드 → 설계방향 → 가안 → 가안분석 → NEIS → 분석 → 보완방향 → 메모
 * 이 순서는 의도된 흐름이며 임의로 변경 금지.
 */
export const LAYER_KEY_ORDER: LayerKey[] = [
  "chat",
  "guide",
  "design_direction",
  "draft",
  "draft_analysis",
  "neis",
  "analysis",
  "improve_direction",
  "memo",
];

/** 관점 라벨 */
export const PERSPECTIVE_LABELS: Record<LayerPerspective, string> = {
  ai: "AI",
  consultant: "컨설턴트",
};

// ============================================
// 콘텐츠 해소 — 레이어 × 관점 → 실제 텍스트
// ============================================

/** 기록 레코드의 최소 타입 (컨텐츠 4-layer 필드 + guide/analysis 참조) */
export interface LayerViewRecord {
  id: string;
  grade?: number | null;
  semester?: number | null;
  subject_id?: string | null;
  activity_type?: string | null;
  ai_draft_content?: string | null;
  content?: string | null;
  confirmed_content?: string | null;
  imported_content?: string | null;
}

/**
 * 가안 레이어에서 선택된 관점에 따라 텍스트 해소.
 * - AI 관점: ai_draft_content
 * - 컨설턴트 관점: confirmed_content > content (확정본 우선, 없으면 작성 중)
 */
export function resolveDraftLayerContent(
  record: LayerViewRecord,
  perspective: LayerPerspective,
): string | null {
  if (perspective === "ai") {
    return record.ai_draft_content?.trim() || null;
  }
  // consultant
  return (
    record.confirmed_content?.trim() ||
    record.content?.trim() ||
    null
  );
}

/**
 * NEIS 레이어 — 단일 뷰, imported_content만 반환.
 */
export function resolveNeisLayerContent(record: LayerViewRecord): string | null {
  return record.imported_content?.trim() || null;
}

/**
 * 레이어·관점·레코드를 받아 표시할 텍스트 반환.
 * 데이터 fetcher가 주입되지 않은 레이어(analysis, guide 등)는 호출자 책임.
 */
export function resolveContentForLayer(
  layer: LayerKey,
  perspective: LayerPerspective | null,
  record: LayerViewRecord,
): string | null {
  switch (layer) {
    case "neis":
      return resolveNeisLayerContent(record);
    case "draft":
      if (!perspective) return null;
      return resolveDraftLayerContent(record, perspective);
    // 나머지 레이어(analysis, design_direction, improve_direction, guide, chat, memo)는
    // 별도 데이터 소스 (competency_scores, guides, assignments 등) 필요 —
    // Layer View 컴포넌트에서 추가 조회 후 렌더링
    default:
      return null;
  }
}

/** 주어진 레이어의 기본 관점 (드롭다운 초기값) */
export function getDefaultPerspective(layer: LayerKey): LayerPerspective | null {
  const def = LAYER_DEFINITIONS[layer];
  if (def.perspectives.length === 0) return null;
  return def.perspectives[0]; // 첫 번째 (보통 "ai")
}

// ============================================
// 에디터 탭 매핑
// 에디터별로 지원하는 탭 집합이 달라서 3종류 탭 타입을 각각 매핑한다.
// - SetekEditor: 5탭 (neis/draft/direction/analysis/draft_analysis) — chat/guide/memo 미지원
// - ChangcheEditor/HaengteukEditor: 8탭 (chat/guide/direction/draft/neis/analysis/draft_analysis/memo)
// 설계 모드(NEIS 없음) 학년에서 P8 가안분석 결과를 보려면 draft_analysis 탭을 사용한다.
// ============================================

/** SetekEditor가 지원하는 5개 탭 */
export type SetekNativeTab = "neis" | "draft" | "direction" | "analysis" | "draft_analysis";

/** ChangcheEditor / HaengteukEditor가 지원하는 8개 탭 */
export type ChangcheNativeTab =
  | "chat"
  | "guide"
  | "direction"
  | "draft"
  | "neis"
  | "analysis"
  | "draft_analysis"
  | "memo";

/**
 * design_direction / improve_direction 두 레이어는 같은 "direction" 탭을 쓰지만
 * guide_mode 필드로 다른 가이드를 필터링해야 한다.
 */
export type DirectionMode = "prospective" | "retrospective";

export function getDirectionMode(layer: LayerKey): DirectionMode | null {
  if (layer === "design_direction") return "prospective";
  if (layer === "improve_direction") return "retrospective";
  return null;
}

/**
 * 9 레이어 → SetekEditor 5탭 매핑.
 * 미지원 레이어(guide/chat/memo)는 null 반환 → 에디터가 셀 단위 stub 표시.
 */
export function layerToSetekTab(layer: LayerKey): SetekNativeTab | null {
  switch (layer) {
    case "neis":
      return "neis";
    case "draft":
      return "draft";
    case "analysis":
      return "analysis";
    case "draft_analysis":
      return "draft_analysis";
    case "design_direction":
    case "improve_direction":
      return "direction";
    case "guide":
    case "chat":
    case "memo":
      return null;
  }
}

/**
 * 9 레이어 → ChangcheEditor/HaengteukEditor 8탭 매핑.
 * 모든 레이어가 native 지원 (창체/행특도 P8에서 draft_analysis 태그 생성됨).
 */
export function layerToChangcheTab(layer: LayerKey): ChangcheNativeTab | null {
  switch (layer) {
    case "neis":
      return "neis";
    case "draft":
      return "draft";
    case "analysis":
      return "analysis";
    case "draft_analysis":
      return "draft_analysis";
    case "design_direction":
    case "improve_direction":
      return "direction";
    case "guide":
      return "guide";
    case "chat":
      return "chat";
    case "memo":
      return "memo";
  }
}

/** SetekEditor에서 해당 레이어가 native 지원되는지 */
export function isLayerSupportedInSetek(layer: LayerKey): boolean {
  return layerToSetekTab(layer) !== null;
}

/** ChangcheEditor/HaengteukEditor에서 해당 레이어가 native 지원되는지 */
export function isLayerSupportedInChangche(layer: LayerKey): boolean {
  return layerToChangcheTab(layer) !== null;
}

// ─── 레거시 호환 — 기존 import 유지용 ──────────────────────
// SetekTableRow가 isLayerSupportedInEditor / LAYER_DEFINITIONS만 import해서 쓰므로
// isLayerSupportedInEditor는 Setek 판정으로 유지.
export type LegacyLayerTab = SetekNativeTab;
export const layerToLegacyTab = layerToSetekTab;
export const isLayerSupportedInEditor = isLayerSupportedInSetek;
