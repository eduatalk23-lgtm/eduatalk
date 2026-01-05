/**
 * E2E 테스트 픽스처 데이터
 *
 * 테스트에서 사용할 샘플 데이터 정의
 */

// ============================================
// 날짜 헬퍼
// ============================================

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * N일 후 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getDaysLater(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

// ============================================
// 플랜 위저드 테스트 데이터
// ============================================

export const PLAN_WIZARD_DATA = {
  // 기본 성공 케이스
  basic: {
    step1: {
      name: "E2E 테스트 플랜",
      planPurpose: "내신대비" as const,
      periodStart: getToday(),
      periodEnd: getDaysLater(30),
    },
    step2: {},
    step4: { skipContents: true },
    step5: {},
  },

  // 모의고사 목적
  mockExam: {
    step1: {
      name: "모의고사 대비 플랜",
      planPurpose: "모의고사" as const,
      periodStart: getToday(),
      periodEnd: getDaysLater(60),
    },
    step2: {},
    step4: { skipContents: true },
    step5: {},
  },

  // 긴 기간 플랜
  longTerm: {
    step1: {
      name: "장기 학습 플랜",
      planPurpose: "자기주도" as const,
      periodStart: getToday(),
      periodEnd: getDaysLater(90),
    },
    step2: {},
    step4: { skipContents: true },
    step5: {},
  },

  // 검증 실패 케이스 - 빈 이름
  invalidEmptyName: {
    step1: {
      name: "",
      periodStart: getToday(),
      periodEnd: getDaysLater(30),
    },
  },

  // 검증 실패 케이스 - 잘못된 기간
  invalidPeriod: {
    step1: {
      name: "잘못된 기간 플랜",
      periodStart: getDaysLater(30),
      periodEnd: getToday(), // 시작일보다 앞선 종료일
    },
  },
};

// ============================================
// 배치 플랜 테스트 데이터
// ============================================

export const BATCH_PLAN_DATA = {
  // 기본 설정
  defaultSettings: {
    startDate: getToday(),
    endDate: getDaysLater(30),
    dailyStudyMinutes: 180,
    modelTier: "fast" as const,
    prioritizeWeakSubjects: true,
    balanceSubjects: true,
    includeReview: false,
  },

  // 고품질 설정
  qualitySettings: {
    startDate: getToday(),
    endDate: getDaysLater(60),
    dailyStudyMinutes: 240,
    modelTier: "quality" as const,
    prioritizeWeakSubjects: true,
    balanceSubjects: true,
    includeReview: true,
  },
};

// ============================================
// 테스트 학생 데이터
// ============================================

export const TEST_STUDENTS = {
  // 테스트용 학생 ID (환경 변수 또는 기본값)
  primaryStudentId: process.env.TEST_STUDENT_ID || "test-student-1",
  secondaryStudentId: process.env.TEST_STUDENT_2_ID || "test-student-2",

  // 배치 테스트용 학생 목록
  batchStudents: [
    process.env.TEST_STUDENT_ID || "test-student-1",
    process.env.TEST_STUDENT_2_ID || "test-student-2",
    process.env.TEST_STUDENT_3_ID || "test-student-3",
  ],
};

// ============================================
// 콘텐츠 테스트 데이터
// ============================================

export const TEST_CONTENTS = {
  // 테스트용 콘텐츠 ID
  mathBook: process.env.TEST_CONTENT_MATH || "test-content-math",
  englishBook: process.env.TEST_CONTENT_ENGLISH || "test-content-english",
  scienceBook: process.env.TEST_CONTENT_SCIENCE || "test-content-science",

  // 콘텐츠 ID 배열
  allContents: [
    process.env.TEST_CONTENT_MATH || "test-content-math",
    process.env.TEST_CONTENT_ENGLISH || "test-content-english",
    process.env.TEST_CONTENT_SCIENCE || "test-content-science",
  ],
};

// ============================================
// 타임아웃 설정
// ============================================

export const TIMEOUTS = {
  /** 페이지 로딩 */
  pageLoad: 10000,
  /** 네트워크 요청 */
  networkRequest: 15000,
  /** API 호출 */
  apiCall: 30000,
  /** 플랜 생성 */
  planGeneration: 60000,
  /** 배치 생성 */
  batchGeneration: 120000,
};

// ============================================
// 셀렉터 상수
// ============================================

export const SELECTORS = {
  // 공통
  loadingSpinner: '[data-testid="loading"], .loading-spinner',
  toast: '[role="alert"], .toast',
  modal: '[role="dialog"], .modal',

  // 네비게이션
  nextButton: '[data-testid="next-button"], button:has-text("다음")',
  prevButton: '[data-testid="prev-button"], button:has-text("이전")',
  submitButton: '[data-testid="submit-button"], button:has-text("생성")',
  cancelButton: '[data-testid="cancel-button"], button:has-text("취소")',

  // 위저드
  wizardContainer: '[data-testid="admin-wizard"], .admin-wizard',
  stepIndicator: '[data-testid="step-indicator"]',
  stepContent: '[data-testid="step-content"]',

  // 입력 필드
  nameInput: '[data-testid="plan-name-input"], input[name="name"]',
  periodStartInput: '[data-testid="period-start"]',
  periodEndInput: '[data-testid="period-end"]',

  // Phase 1: CompletionFlow
  completionFlow: '[data-testid="completion-flow"], .completion-flow',
  dailyProgress: '[data-testid="daily-progress"]',
  nextPlanCard: '[data-testid="next-plan-card"]',
  endTodayButton: 'button:has-text("오늘은 여기까지")',

  // Phase 2: Milestone
  milestoneToast: '[data-testid="milestone-toast"]',
  timerDisplay: '[data-testid="timer-display"]',
  streakDays: '[data-testid="streak-days"]',

  // Phase 3: Reminder
  incompleteReminder: '[data-testid="incomplete-reminder"]',
  reminderSettings: '[data-testid="reminder-settings"]',
  reminderToggle: '[data-testid="reminder-toggle"]',
  reminderTimeInput: '[data-testid="reminder-time"]',
  thresholdSelect: '[data-testid="threshold-select"]',

  // 플랜 카드
  planCard: '[data-testid="plan-card"], [data-testid="plan-item"]',
  planTimer: '[data-testid="plan-timer"]',
  startButton: 'button:has-text("시작"), button:has-text("학습 시작")',
  completeButton: 'button:has-text("완료"), button:has-text("학습 완료")',
};
