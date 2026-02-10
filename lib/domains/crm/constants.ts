/**
 * CRM Domain Constants
 *
 * 파이프라인 상태, 유입경로, 활동유형 등 한글 라벨 및 기본 데이터
 */

import type {
  ActivityType,
  CallerType,
  ConsultationResult,
  LeadSource,
  LeadTaskPriority,
  LeadTaskStatus,
  LeadTaskType,
  PipelineStatus,
  QualityLevel,
} from "./types";

// ============================================
// 파이프라인 상태
// ============================================

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  new: "신규",
  contacted: "연락완료",
  consulting_done: "상담완료",
  follow_up: "팔로업",
  registration_in_progress: "등록진행중",
  converted: "등록완료",
  lost: "이탈",
  spam: "스팸",
};

export const PIPELINE_STATUS_ORDER: PipelineStatus[] = [
  "new",
  "contacted",
  "consulting_done",
  "follow_up",
  "registration_in_progress",
  "converted",
  "lost",
  "spam",
];

// ============================================
// 유입경로
// ============================================

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  homepage: "홈페이지",
  landing_page: "랜딩페이지",
  referral: "소개/추천",
  blog: "블로그",
  phone_inbound: "전화 인바운드",
  walk_in: "방문",
  event: "설명회/이벤트",
  sns: "SNS",
  advertisement: "광고",
  naver_search: "네이버검색",
  kakao_channel: "카카오채널",
  iam_school: "아이엠스쿨",
  academy: "학원",
  other: "기타",
};

// ============================================
// 활동유형
// ============================================

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  phone_call: "전화 통화",
  sms: "문자 발송",
  consultation: "상담",
  follow_up: "팔로업",
  status_change: "상태 변경",
  note: "메모",
  email: "이메일",
  meeting: "미팅",
};

// ============================================
// 기본 프로그램 시드 데이터
// ============================================

export const DEFAULT_PROGRAM_CODES = [
  { code: "PRO", name: "생기부레벨업 프로", description: "생기부레벨업 프로 프로그램", display_order: 1 },
  { code: "PRE", name: "생기부레벨업 프리미엄", description: "생기부레벨업 프리미엄 프로그램", display_order: 2 },
  {
    code: "TRIAL",
    name: "체험수업",
    description: "체험수업 프로그램",
    display_order: 3,
  },
  {
    code: "CAREER_I",
    name: "진로적성검사 I",
    description: "진로적성검사 I",
    display_order: 4,
  },
  {
    code: "CAREER_II",
    name: "진로적성검사 II",
    description: "진로적성검사 II",
    display_order: 5,
  },
  {
    code: "SUSI",
    name: "수시컨설팅",
    description: "수시컨설팅 프로그램",
    display_order: 6,
  },
  {
    code: "MAS",
    name: "마스터플랜",
    description: "마스터플랜 프로그램",
    display_order: 7,
  },
  {
    code: "RECORD_DIAG",
    name: "생기부진단",
    description: "생활기록부 진단",
    display_order: 8,
  },
  {
    code: "TL",
    name: "타임레벨업",
    description: "타임레벨업 프로그램",
    display_order: 9,
  },
] as const;

// ============================================
// 리드 스코어링 규칙
// ============================================

/** 유입경로별 적합도 점수 */
export const FIT_SCORE_BY_SOURCE: Record<LeadSource, number> = {
  referral: 20,
  phone_inbound: 15,
  walk_in: 15,
  event: 12,
  homepage: 10,
  landing_page: 10,
  naver_search: 8,
  kakao_channel: 8,
  iam_school: 7,
  academy: 10,
  blog: 5,
  sns: 5,
  advertisement: 5,
  other: 0,
};

/** 프로그램 코드별 적합도 가산점 (고단가 프로그램 우선) */
export const FIT_SCORE_BY_PROGRAM: Record<string, number> = {
  PRO: 25,
  MAS: 20,
  SUSI: 15,
  CAREER_II: 12,
  CAREER_I: 10,
  PRE: 10,
  RECORD_DIAG: 8,
  TRIAL: 5,
  TL: 15,
};

/** 학년별 적합도 가산점 (고등학생 핵심 타겟) */
export const FIT_SCORE_BY_GRADE: Record<number, number> = {
  // 고3
  12: 20,
  // 고2
  11: 18,
  // 고1
  10: 15,
  // 중3
  9: 10,
  // 중2
  8: 5,
  // 중1
  7: 3,
};

/** 활동 유형별 참여도 점수 */
export const ENGAGEMENT_SCORE_BY_ACTIVITY: Record<string, number> = {
  consultation: 40,
  meeting: 35,
  phone_call: 25,
  follow_up: 20,
  sms: 10,
  email: 10,
  note: 5,
  status_change: 0,
};

/** 품질 레벨 기준 (종합 점수) */
export const QUALITY_THRESHOLDS: { level: QualityLevel; minScore: number }[] = [
  { level: "hot", minScore: 60 },
  { level: "warm", minScore: 30 },
  { level: "cold", minScore: 0 },
];

// ============================================
// 태스크 관리
// ============================================

export const TASK_TYPE_LABELS: Record<LeadTaskType, string> = {
  first_contact: "첫 연락",
  follow_up_call: "팔로업 통화",
  send_proposal: "제안서 발송",
  schedule_trial: "체험 수업 예약",
  post_trial_follow_up: "체험 후 팔로업",
  collect_documents: "서류 수집",
  payment_confirm: "결제 확인",
  custom: "기타",
};

export const TASK_STATUS_LABELS: Record<LeadTaskStatus, string> = {
  pending: "대기",
  in_progress: "진행중",
  completed: "완료",
  cancelled: "취소",
};

export const TASK_PRIORITY_LABELS: Record<LeadTaskPriority, string> = {
  high: "긴급",
  medium: "보통",
  low: "낮음",
};

/**
 * 파이프라인 상태 변경 시 자동 생성할 태스크 규칙
 * newStatus → { taskType, title, slaHours, priority }
 */
export const AUTO_TASK_RULES: Partial<
  Record<
    PipelineStatus,
    {
      taskType: LeadTaskType;
      title: string;
      slaHours: number;
      priority: LeadTaskPriority;
    }
  >
> = {
  new: {
    taskType: "first_contact",
    title: "신규 리드 첫 연락",
    slaHours: 1,
    priority: "high",
  },
  consulting_done: {
    taskType: "follow_up_call",
    title: "상담 후 팔로업 연락",
    slaHours: 24,
    priority: "high",
  },
  follow_up: {
    taskType: "follow_up_call",
    title: "팔로업 재연락",
    slaHours: 72,
    priority: "medium",
  },
  registration_in_progress: {
    taskType: "collect_documents",
    title: "등록 서류 수집 및 결제 안내",
    slaHours: 48,
    priority: "high",
  },
};

// ============================================
// 상담 기록
// ============================================

export const CONSULTATION_RESULT_LABELS: Record<ConsultationResult, string> = {
  consultation_done: "상담완료",
  absent_sms: "부재·문자",
  sms_info: "문자안내",
  spam: "스팸",
};

export const CALLER_TYPE_LABELS: Record<CallerType, string> = {
  mother: "모",
  father: "부",
  student: "학생",
  other: "기타",
};
