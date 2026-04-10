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
    order: -0.5,
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
    tier: "type_extension",
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
    order: -0.5,
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
    tier: "type_extension",
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
    order: -0.5,
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
    order: -0.5,
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
// Phase 2 Wave 2.1 — 창체용 3종 신규 섹션 정의
// (Decision #2/#3/#4/#5 종합 — 창체 자율/동아리/진로 영역 가이드 구조)
// ============================================================

/**
 * 창체 자율·자치 (reflection_program)
 *
 * 구조: 학교 프로그램 → 적용 교과 이론 → 사회 동향 분석 → 인문학적 성찰
 * 핵심 차별점: school-programs.ts의 SCHOOL_COMMON_PROGRAMS 중 1개를 선택해 출발.
 * 단순 캠페인·포스터형 활동을 배제하고 학문적 깊이 확보가 목표.
 */
const REFLECTION_PROGRAM_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 성찰을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "school_program",
    label: "출발 학교 프로그램",
    editorType: "key_value",
    required: true,
    order: 1,
    tier: "type_extension",
    placeholder: "예: 학교폭력 예방교육 / 민주시민교육 / 환경·생태교육",
  },
  {
    key: "motivation",
    label: "관심 동기",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder: "학교 프로그램에서 어떤 문제 의식이 발화되었는지",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "academic_lens",
    label: "적용 교과 이론",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "type_extension",
    placeholder:
      "어느 교과(사회·심리·경제·법 등)의 어떤 이론·개념을 이 문제에 대입했는지",
    minLength: 200,
    maxLength: 600,
  },
  {
    key: "content_sections",
    label: "탐구 이론",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "core",
    placeholder:
      "사회 동향 분석 → 학문적 도구 적용 → 사례 비교 → 인문학적·사회적 성찰",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "social_context",
    label: "사회 동향 분석",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "type_extension",
    placeholder: "관련 통계·뉴스·연구 등 객관적 자료로 본 사회 흐름",
    minLength: 200,
    maxLength: 600,
  },
  {
    key: "reflection",
    label: "인문학적 성찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 6,
    tier: "core",
    placeholder:
      "공동체 구성원으로서의 가치 판단, 한계 인식, 학교/지역 단위 실천 제언",
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
    placeholder: "성찰 과정에서의 가치관 변화, 공동체 의식 성장",
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
    placeholder: "심화 탐구 또는 학교/지역 단위 실천 활동 방향",
  },
  {
    key: "setek_examples",
    label: "창체 자율 기재 예시",
    editorType: "text_list",
    required: false,
    order: 9,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 자율활동 기재 예시 (200~500자)",
  },
];

/**
 * 창체 동아리 (club_deep_dive)
 *
 * 구조: 동아리 주제 → 지속성 기록 → 탐구 설계 → 협업 과정 → 산출물 → 다음 학년 심화
 * 핵심 차별점: 12계열 연속성 + 2년 이상 지속 가능성을 기록 단계에서 추적.
 */
const CLUB_DEEP_DIVE_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 동아리 활동을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "club_overview",
    label: "동아리 개요",
    editorType: "key_value",
    required: true,
    order: 1,
    tier: "type_extension",
    placeholder: "동아리명 / 12계열 / 학년 / 지속 학년 수",
  },
  {
    key: "continuity_history",
    label: "지속성 기록",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "type_extension",
    placeholder:
      "이전 학년 활동과의 연계, 같은 12계열 내 변경 근거, 2년 이상 지속의 의미",
    minLength: 150,
    maxLength: 400,
  },
  {
    key: "motivation",
    label: "주제 선정 동기",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "core",
    placeholder:
      "전공 심화 탐구로 발전 가능한 주제를 선택한 이유 (단순 흥미 X)",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "탐구 설계 및 진행",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "core",
    placeholder: "문제 설정 → 가설/방법 → 협업 분담 → 자료 수집 → 결과 분석",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "collaboration",
    label: "협업 과정",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "type_extension",
    placeholder:
      "구체적 역할 분담, 갈등 조정, 의사결정 사례 (단순 '함께' 표현 금지)",
    minLength: 150,
    maxLength: 400,
  },
  {
    key: "deliverables",
    label: "산출물",
    editorType: "rich_text",
    required: true,
    order: 6,
    tier: "type_extension",
    placeholder: "보고서·발표·실험 결과·작품 등 구체적 산출물",
  },
  {
    key: "reflection",
    label: "탐구 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 7,
    tier: "core",
    placeholder: "탐구 한계, 다음 학년 심화 방향, 후배에게 전할 제언",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 8,
    tier: "core",
    placeholder: "동아리원으로서의 성장, 진로 연계 통찰",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "next_year_plan",
    label: "다음 학년 심화 방향",
    editorType: "rich_text",
    required: false,
    order: 9,
    tier: "optional",
    placeholder: "현 활동을 어떻게 심화·확장할지 구체 계획",
  },
  {
    key: "setek_examples",
    label: "동아리 기재 예시",
    editorType: "text_list",
    required: false,
    order: 10,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 동아리활동 기재 예시 (200~500자)",
  },
];

/**
 * 창체 진로 (career_exploration_project)
 *
 * 구조: 관심 분야 → 자기주도 조사 → 진로 계획 구체화 → 학과·직업 연계 분석
 * 핵심 차별점: 박람회·학과탐방 단순 참여 금지, 자기주도 후속 탐구가 필수.
 */
const CAREER_EXPLORATION_PROJECT_SECTIONS: SectionDefinition[] = [
  {
    key: "learning_objectives",
    label: "학습목표",
    editorType: "text_list",
    required: false,
    order: 0,
    tier: "type_extension",
    placeholder: "이 진로 탐색을 통해 달성할 목표 (3~5개)",
  },
  {
    key: "interest_overview",
    label: "관심 분야 개요",
    editorType: "key_value",
    required: true,
    order: 1,
    tier: "type_extension",
    placeholder: "관심 학과·직업 / 흥미 발화 시점 / 12계열",
  },
  {
    key: "motivation",
    label: "탐색 동기",
    editorType: "rich_text",
    required: true,
    order: 2,
    tier: "core",
    placeholder:
      "단순 관심 표명 금지 — 어떤 경험·교과 학습이 진로 탐색의 단초가 되었는지",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "starting_point",
    label: "출발 활동",
    editorType: "rich_text",
    required: true,
    order: 3,
    tier: "type_extension",
    placeholder:
      "학과 탐방, 진로 박람회, 직업인 인터뷰 등 출발이 된 단기 활동 (1~2개)",
    minLength: 100,
    maxLength: 300,
  },
  {
    key: "content_sections",
    label: "자기주도 조사",
    editorType: "rich_text",
    required: true,
    order: 4,
    tier: "core",
    placeholder:
      "출발 활동 이후 스스로 진행한 자료 조사·분석·실험·전문가 컨택 등 심화 단계",
    multiple: true,
    multipleMin: 2,
    multipleMax: 5,
    minLength: 500,
    maxLength: 2000,
    outlineRequired: true,
  },
  {
    key: "major_link",
    label: "학과·직업 연계 분석",
    editorType: "rich_text",
    required: true,
    order: 5,
    tier: "type_extension",
    placeholder:
      "관심 학과의 교과과정·진로 트랙·직업 전망과 자신의 탐색 결과를 연결",
    minLength: 200,
    maxLength: 600,
  },
  {
    key: "career_plan",
    label: "진로 계획 구체화",
    editorType: "rich_text",
    required: true,
    order: 6,
    tier: "type_extension",
    placeholder: "단기(고교)·중기(대학)·장기(직업) 계획과 필요한 역량",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "reflection",
    label: "탐색 고찰 및 제언",
    editorType: "rich_text",
    required: true,
    order: 7,
    tier: "core",
    placeholder: "진로 탐색 과정에서 발견한 장벽·기회·성찰",
    minLength: 200,
    maxLength: 500,
  },
  {
    key: "impression",
    label: "느낀점",
    editorType: "rich_text",
    required: true,
    order: 8,
    tier: "core",
    placeholder: "진로 탐색 후 자기 인식의 변화, 동기부여",
    minLength: 150,
    maxLength: 300,
  },
  {
    key: "follow_up",
    label: "후속 활동",
    editorType: "rich_text",
    required: false,
    order: 9,
    tier: "optional",
    placeholder: "다음 학기/학년에 이어갈 진로 탐색 계획",
  },
  {
    key: "setek_examples",
    label: "진로 기재 예시",
    editorType: "text_list",
    required: false,
    order: 10,
    tier: "core",
    adminOnly: true,
    placeholder: "교사용 진로활동 기재 예시 (200~500자)",
  },
];

// ============================================================
// 전 유형 공통 섹션 (마지막에 추가)
// ============================================================

const COMMON_TAIL_SECTIONS: SectionDefinition[] = [
  {
    key: "consultant_guide",
    label: "컨설턴트 편집 가이드",
    editorType: "rich_text",
    required: false,
    order: 99,
    tier: "core",
    adminOnly: true,
    placeholder:
      "AI가 생성한 편집 가이드: 팩트 체크 항목, 참고 자료 검색 안내, 편집 조언",
  },
];

// ============================================================
// 공개 API
// ============================================================

export const GUIDE_SECTION_CONFIG: Record<GuideType, SectionDefinition[]> = {
  reading: [...READING_SECTIONS, ...COMMON_TAIL_SECTIONS],
  topic_exploration: [...TOPIC_EXPLORATION_SECTIONS, ...COMMON_TAIL_SECTIONS],
  experiment: [...EXPERIMENT_SECTIONS, ...COMMON_TAIL_SECTIONS],
  subject_performance: [...SUBJECT_PERFORMANCE_SECTIONS, ...COMMON_TAIL_SECTIONS],
  program: [...PROGRAM_SECTIONS, ...COMMON_TAIL_SECTIONS],
  // Phase 2 Wave 2.1 — 창체용 3종
  reflection_program: [...REFLECTION_PROGRAM_SECTIONS, ...COMMON_TAIL_SECTIONS],
  club_deep_dive: [...CLUB_DEEP_DIVE_SECTIONS, ...COMMON_TAIL_SECTIONS],
  career_exploration_project: [...CAREER_EXPLORATION_PROJECT_SECTIONS, ...COMMON_TAIL_SECTIONS],
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
 * AI가 세특 예시 3개를 1개 HTML 덩어리로 생성했을 때 개별 items로 분리.
 * 분리 불가능하면 null 반환 (기존 동작 유지).
 *
 * 6단계 패턴 매칭 (순서대로 시도, 첫 성공 시 반환):
 * 1. "예시 N" 패턴 (가장 흔함)
 * 2. <p><strong>N. / N) 패턴
 * 3. 기호 패턴 (■, ●, ★, ◆)
 * 4. <li> 태그 기반
 * 5. <br><br> 또는 <p></p> 이중 줄바꿈
 * 6. "첫 번째/두 번째/세 번째" 한글 서수
 */
export function splitSetekExamplesBlob(content: string): string[] | null {
  if (!content || content.length < 50) return null;

  const MIN_PART_LENGTH = 20;
  const filter = (parts: string[]) =>
    parts.map((p) => p.trim()).filter((p) => p.length >= MIN_PART_LENGTH);

  // 1. "예시 N" 패턴 (가장 흔함)
  const examplePattern = /(?=<p>\s*<strong>\s*예시\s*\d)|(?=<strong>\s*예시\s*\d)|(?=예시\s*\d\s*[\(:：.)])/gi;
  const exParts = filter(content.split(examplePattern));
  if (exParts.length >= 2) return exParts;

  // 2. <p><strong>N. 또는 N) 패턴
  const numPattern = /(?=<p>\s*<strong>\s*\d+[\.\)]\s)|(?=<strong>\s*\d+[\.\)]\s)/g;
  const numParts = filter(content.split(numPattern));
  if (numParts.length >= 2) return numParts;

  // 3. 기호 패턴 (■, ●, ★, ◆, ▶)
  const symbolPattern = /(?=<p>\s*[■●★◆▶])|(?=[■●★◆▶]\s)/g;
  const symParts = filter(content.split(symbolPattern));
  if (symParts.length >= 2) return symParts;

  // 4. <li> 태그 기반 (AI가 <ul><li>로 묶은 경우)
  const liMatches = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  if (liMatches && liMatches.length >= 2) {
    const liParts = filter(liMatches.map((m) => m.replace(/<\/?li[^>]*>/gi, "")));
    if (liParts.length >= 2) return liParts;
  }

  // 5. 이중 줄바꿈 분리 (<br><br> 또는 빈 <p></p>)
  const brParts = filter(content.split(/<br\s*\/?>\s*<br\s*\/?>|<p>\s*<\/p>/gi));
  if (brParts.length >= 2 && brParts.length <= 5) return brParts;

  // 6. 한글 서수 패턴 ("첫 번째", "두 번째", "세 번째")
  const ordinalPattern = /(?=(?:첫|두|세|네)\s*번째)/g;
  const ordParts = filter(content.split(ordinalPattern));
  if (ordParts.length >= 2) return ordParts;

  return null;
}

/**
 * content_sections 배열이 있으면 그대로 사용, 없으면 레거시 변환
 *
 * text_list 섹션(setek_examples 등)에서 AI가 items 대신 content에
 * 데이터를 넣는 경우, 레거시 필드에서 items를 보충하여 정규화합니다.
 */
export function resolveContentSections(
  guideType: GuideType,
  content: ExplorationGuideContent,
): ContentSection[] {
  if (content.content_sections && content.content_sections.length > 0) {
    return content.content_sections.map((s) => {
      // setek_examples: items 빈 배열 → content 분리 → 레거시 분리 → 레거시 원본
      if (s.key === "setek_examples" && !s.items?.length) {
        const items =
          (s.content ? splitSetekExamplesBlob(s.content) : null) ??
          (content.setek_examples?.length === 1 ? splitSetekExamplesBlob(content.setek_examples[0]) : null) ??
          (content.setek_examples?.length ? content.setek_examples : null);
        if (items) return { ...s, items };
      }
      return s;
    });
  }
  return legacyToContentSections(guideType, content);
}
