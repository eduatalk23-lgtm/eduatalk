/**
 * 가이드 유형별 섹션 구성 Config
 *
 * 이 상수를 수정하면 AI 프롬프트, 에디터 UI, 프리뷰, 학생 뷰가 자동 반영됩니다.
 * - 섹션 추가: 배열에 항목 추가
 * - 섹션 삭제: 배열에서 항목 제거
 * - 순서 변경: order 값 변경
 * - 필수/선택 전환: required 값 변경
 */

import type { GuideType } from "./types";

export type SectionEditorType =
  | "rich_text"
  | "text_list"
  | "key_value"
  | "plain_text";

/** 섹션 계층 — Core: 전 유형 공통 필수, type_extension: 유형 선택 시 자동 ON, optional: 선택 보강 */
export type SectionTier = "core" | "type_extension" | "optional";

export interface SectionDefinition {
  /** DB 저장 키 (content_sections[].key) */
  key: string;
  /** UI 표시명 */
  label: string;
  /** 에디터 유형 */
  editorType: SectionEditorType;
  /** 필수 여부 */
  required: boolean;
  /** true면 학생에게 미노출 (교사/컨설턴트 전용) */
  adminOnly?: boolean;
  /** 입력 placeholder */
  placeholder?: string;
  /** 권장 최소 글자수 */
  minLength?: number;
  /** 권장 최대 글자수 */
  maxLength?: number;
  /** 기본 표시 순서 */
  order: number;
  /** 복수 섹션 허용 (탐구 이론처럼 2~5개) */
  multiple?: boolean;
  /** 복수 섹션 최소/최대 */
  multipleMin?: number;
  multipleMax?: number;
  /** 섹션 계층 (기본: core) */
  tier?: SectionTier;
  /** true면 AI가 이 섹션에 outline 데이터를 반드시 생성 */
  outlineRequired?: boolean;
}

// ============================================================
// 유형별 섹션 정의
// ============================================================

const READING_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 탐구를 통해 달성할 목표 (3~5개)",
  },
  {
    key: "curriculum_unit",
    label: "교육과정 단원 연계",
    editorType: "plain_text",
    required: false,
    order: 0.5,
    tier: "type_extension",
    adminOnly: true,
    placeholder: "관련 교육과정 단원명 및 성취기준",
  },
  {
    key: "motivation",
    label: "탐구 동기",
    editorType: "rich_text",
    required: true,
    order: 1,
    tier: "core",
    placeholder: "왜 이 책을 읽게 되었는지 학생 시점에서 작성",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "book_description",
    label: "도서 소개",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "type_extension",
    placeholder: "핵심 내용과 학문적 가치",
    minLength: 200,
    maxLength: 400,
  },
  {
    key: "content_sections",
    label: "탐구 이론",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "core",
    placeholder: "책의 핵심 개념/논점 분석",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "core",
    placeholder: "책을 통해 발견한 점, 분석 결과 및 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "core",
    placeholder: "학문적/개인적 감상, 학습자로서의 성장",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "summary",
    label: "탐구 요약",
    editorType: "rich_text",
    required: false,
    order: 6,
    tier: "optional",
    placeholder: "전체 내용 핵심 정리",
    minLength: 200,
    maxLength: 400,
  },
  {
    key: "follow_up",
    label: "후속 탐구",
    editorType: "rich_text",
    required: false,
    order: 7,
    tier: "optional",
    placeholder: "관련 도서, 심화 연구 방향",
  },
  {
    key: "setek_examples",
    label: "세특 예시",
    editorType: "text_list",
    required: false,
    order: 8,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 기록 예시 (200~500자)",
  },
];

const TOPIC_EXPLORATION_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 탐구를 통해 달성할 목표 (3~5개)",
  },
  {
    key: "curriculum_unit",
    label: "교육과정 단원 연계",
    editorType: "plain_text",
    required: false,
    order: 0.5,
    tier: "type_extension",
    adminOnly: true,
    placeholder: "관련 교육과정 단원명 및 성취기준",
  },
  {
    key: "motivation",
    label: "탐구 동기",
    editorType: "rich_text",
    required: true,
    order: 1,
    tier: "core",
    placeholder: "왜 이 주제에 관심을 갖게 되었는지",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "탐구 이론",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder: "핵심 개념/이론 전개",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "core",
    placeholder: "탐구를 통해 발견한 점 및 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "core",
    placeholder: "학문적/개인적 감상, 학습자로서의 성장",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "summary",
    label: "탐구 요약",
    editorType: "rich_text",
    required: false,
    order: 5,
    tier: "optional",
    placeholder: "전체 내용 핵심 정리",
    minLength: 200,
    maxLength: 400,
  },
  {
    key: "follow_up",
    label: "후속 탐구",
    editorType: "rich_text",
    required: false,
    order: 6,
    tier: "optional",
    placeholder: "심화 탐구 방향",
  },
  {
    key: "setek_examples",
    label: "세특 예시",
    editorType: "text_list",
    required: false,
    order: 7,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 기록 예시 (200~500자)",
  },
];

const EXPERIMENT_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 실험을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "curriculum_unit",
    label: "교육과정 단원 연계",
    editorType: "plain_text",
    required: false,
    order: 0.5,
    tier: "type_extension",
    adminOnly: true,
    placeholder: "관련 교육과정 단원명 및 성취기준",
  },
  {
    key: "motivation",
    label: "실험 목적",
    editorType: "rich_text",
    required: true,
    order: 1,
    tier: "core",
    placeholder: "무엇을 검증/관찰하려는지, 왜 이 실험을 하게 되었는지",
    minLength: 100,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "탐구 이론",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder: "배경 이론 → 가설/변인 → 실험 설계 → 데이터 분석 → 가설 검증",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "hypothesis",
    label: "가설",
    editorType: "rich_text",
    required: false,
    order: 3,
    tier: "type_extension",
    placeholder: "예상되는 결과와 근거",
    maxLength: 500,
  },
  {
    key: "materials",
    label: "실험 재료 및 기구",
    editorType: "text_list",
    required: true,
    order: 4,
    tier: "type_extension",
    placeholder: "실험에 필요한 재료와 기구",
  },
  {
    key: "analysis",
    label: "결과 분석",
    editorType: "rich_text",
    required: true,
    order: 7,
    tier: "type_extension",
    placeholder: "데이터 해석, 가설 검증 여부",
    minLength: 200,
    maxLength: 1000,
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 8,
    tier: "core",
    placeholder: "실험의 의의, 한계, 오차 원인 및 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 9,
    tier: "core",
    placeholder: "실험 과정에서 느낀 점, 학습자로서의 성장",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "follow_up",
    label: "후속 탐구",
    editorType: "rich_text",
    required: false,
    order: 10,
    tier: "optional",
    placeholder: "개선된 실험 설계, 변인 변경 방안",
  },
  {
    key: "setek_examples",
    label: "세특 예시",
    editorType: "text_list",
    required: false,
    order: 11,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 기록 예시 (200~500자)",
  },
];

const SUBJECT_PERFORMANCE_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 수행을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "curriculum_unit",
    label: "교육과정 단원 연계",
    editorType: "plain_text",
    required: false,
    order: 0.5,
    tier: "type_extension",
    adminOnly: true,
    placeholder: "관련 교육과정 단원명 및 성취기준",
  },
  {
    key: "motivation",
    label: "탐구 동기",
    editorType: "rich_text",
    required: true,
    order: 1,
    tier: "core",
    placeholder: "이 수행평가에서 달성할 목표와 탐구 동기",
    minLength: 100,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "탐구 이론",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder: "교과 개념/성취기준 → 수행 방법론 → 수행 결과 → 성취기준 연계 해석",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "curriculum_link",
    label: "교과 연계 분석",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "type_extension",
    placeholder: "교육과정 성취기준과의 연결",
    minLength: 200,
    maxLength: 800,
  },
  {
    key: "self_assessment",
    label: "자기 평가",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "type_extension",
    placeholder: "수행 과정 성찰, 역량 분석",
    minLength: 150,
    maxLength: 500,
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "core",
    placeholder: "수행 결과 해석, 의미 부여 및 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 6,
    tier: "core",
    placeholder: "수행 과정에서 느낀 점, 학습자로서의 성장",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "follow_up",
    label: "후속 활동",
    editorType: "rich_text",
    required: false,
    order: 7,
    tier: "optional",
    placeholder: "심화 학습 방향",
  },
  {
    key: "setek_examples",
    label: "세특 예시",
    editorType: "text_list",
    required: false,
    order: 8,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 기록 예시 (200~500자)",
  },
];

const PROGRAM_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 프로그램을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "overview",
    label: "프로그램 개요",
    editorType: "key_value",
    required: true,
    order: 1,
    tier: "type_extension",
    placeholder: "프로그램명, 기관, 기간, 목적",
  },
  {
    key: "motivation",
    label: "참여 동기",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder: "왜 이 프로그램에 참여했는지",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "활동 내용",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "core",
    placeholder: "주차/세션별 활동 기술",
    multiple: true,
    multipleMin: 1,
    multipleMax: 10,
    outlineRequired: true,
  },
  {
    key: "deliverables",
    label: "성과물",
    editorType: "rich_text",
    required: false,
    order: 4,
    tier: "type_extension",
    placeholder: "보고서, 발표, 작품 등",
  },
  {
    key: "learning",
    label: "배운 점",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "type_extension",
    placeholder: "프로그램을 통해 얻은 역량/지식",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 6,
    tier: "core",
    placeholder: "프로그램을 통해 발견한 점 및 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 7,
    tier: "core",
    placeholder: "개인적 성장, 진로 연계",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "follow_up",
    label: "후속 활동",
    editorType: "rich_text",
    required: false,
    order: 8,
    tier: "optional",
    placeholder: "관련 후속 프로그램, 심화 활동",
  },
  {
    key: "setek_examples",
    label: "세특 예시",
    editorType: "text_list",
    required: false,
    order: 9,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 기록 예시 (200~500자)",
  },
];

// ============================================================
// 공개 API
// ============================================================

export const GUIDE_SECTION_CONFIG: Record<GuideType, SectionDefinition[]> = {
  reading: READING_SECTIONS,
  topic_exploration: TOPIC_EXPLORATION_SECTIONS,
  experiment: EXPERIMENT_SECTIONS,
  subject_performance: SUBJECT_PERFORMANCE_SECTIONS,
  program: PROGRAM_SECTIONS,
};

/** 유형의 필수 섹션 키 목록 */
export function getRequiredSectionKeys(guideType: GuideType): string[] {
  return GUIDE_SECTION_CONFIG[guideType]
    .filter((s) => s.required)
    .map((s) => s.key);
}

/** 유형의 학생 노출 섹션 (adminOnly 제외) */
export function getStudentVisibleSections(
  guideType: GuideType,
): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter((s) => !s.adminOnly);
}

/** 유형의 복수 섹션 정의 */
export function getMultipleSections(
  guideType: GuideType,
): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter((s) => s.multiple);
}

/** Core 계층 섹션만 반환 (전 유형 공통 필수) */
export function getCoreSections(guideType: GuideType): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter(
    (s) => (s.tier ?? "core") === "core",
  );
}

/** Type Extension 계층 섹션 반환 (유형 선택 시 자동 ON) */
export function getTypeExtensionSections(
  guideType: GuideType,
): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter(
    (s) => s.tier === "type_extension",
  );
}

/** Optional 계층 섹션 반환 (컨설턴트 선택) */
export function getOptionalSections(
  guideType: GuideType,
): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter(
    (s) => s.tier === "optional",
  );
}

/** 기본 활성 섹션 (Core + Type Extension) — 생성/에디터 기본값 */
export function getDefaultActiveSections(
  guideType: GuideType,
): SectionDefinition[] {
  return GUIDE_SECTION_CONFIG[guideType].filter(
    (s) => (s.tier ?? "core") !== "optional",
  );
}

// ============================================================
// 하위 호환: 레거시 필드 → content_sections 변환
// ============================================================

import type {
  ExplorationGuideContent,
  ContentSection,
} from "./types";

/**
 * 레거시 가이드 콘텐츠를 content_sections 배열로 변환
 * content_sections가 비어있는 기존 가이드에 사용
 */
export function legacyToContentSections(
  guideType: GuideType,
  content: ExplorationGuideContent,
): ContentSection[] {
  const sections: ContentSection[] = [];
  const config = GUIDE_SECTION_CONFIG[guideType];

  for (const def of config) {
    switch (def.key) {
      case "motivation":
        if (content.motivation) {
          sections.push({
            key: "motivation",
            label: def.label,
            content: content.motivation,
            content_format: "html",
          });
        }
        break;

      case "book_description":
        if (content.book_description) {
          sections.push({
            key: "book_description",
            label: def.label,
            content: content.book_description,
            content_format: "html",
          });
        }
        break;

      case "content_sections":
        // theory_sections → 복수 content_sections
        for (const ts of content.theory_sections) {
          sections.push({
            key: "content_sections",
            label: ts.title || def.label,
            content: ts.content,
            content_format: "html",
            images: ts.images,
            order: ts.order,
            outline: ts.outline,
          });
        }
        break;

      case "reflection":
        if (content.reflection) {
          sections.push({
            key: "reflection",
            label: def.label,
            content: content.reflection,
            content_format: "html",
          });
        }
        break;

      case "impression":
        if (content.impression) {
          sections.push({
            key: "impression",
            label: def.label,
            content: content.impression,
            content_format: "html",
          });
        }
        break;

      case "summary":
        if (content.summary) {
          sections.push({
            key: "summary",
            label: def.label,
            content: content.summary,
            content_format: "html",
          });
        }
        break;

      case "follow_up":
        if (content.follow_up) {
          sections.push({
            key: "follow_up",
            label: def.label,
            content: content.follow_up,
            content_format: "html",
          });
        }
        break;

      case "setek_examples":
        if (content.setek_examples?.length > 0) {
          sections.push({
            key: "setek_examples",
            label: def.label,
            content: "",
            content_format: "plain",
            items: content.setek_examples,
          });
        }
        break;

      // type_extension 키 — 레거시 필드에 대응 없음 (신규 가이드에서만 content_sections에 직접 저장)
      case "hypothesis":
      case "materials":
      case "analysis":
      case "curriculum_link":
      case "self_assessment":
      case "overview":
      case "deliverables":
      case "learning":
      case "learning_objectives":
      case "curriculum_unit":
        break;
    }
  }

  return sections;
}

/**
 * content_sections 배열이 있으면 그대로 사용, 없으면 레거시 변환
 */
export function resolveContentSections(
  guideType: GuideType,
  content: ExplorationGuideContent,
): ContentSection[] {
  if (content.content_sections && content.content_sections.length > 0) {
    return content.content_sections;
  }
  return legacyToContentSections(guideType, content);
}
