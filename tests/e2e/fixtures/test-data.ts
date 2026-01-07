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
  primaryStudentId: process.env.TEST_STUDENT_ID || "d326ad9f-d8f1-4fcb-aadb-fb3638239735",
  secondaryStudentId: process.env.TEST_STUDENT_2_ID || "924e1e3a-1e90-47e5-ada2-e797e850fc58",

  // 배치 테스트용 학생 목록
  batchStudents: [
    process.env.TEST_STUDENT_ID || "d326ad9f-d8f1-4fcb-aadb-fb3638239735",
    process.env.TEST_STUDENT_2_ID || "924e1e3a-1e90-47e5-ada2-e797e850fc58",
    process.env.TEST_STUDENT_3_ID || "6d1cff5e-fa9f-4811-8d7f-44f75850b62b",
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

  // Phase 2.3: Fallback UI 컴포넌트
  queryStateWrapper: '[data-testid="query-state-wrapper"]',
  loadingState: '[data-testid="loading-state"], .loading-skeleton, .animate-pulse',
  errorState: '[data-testid="error-state"], .error-boundary',
  emptyState: '[data-testid="empty-state"], .empty-state',
  retryButton: 'button:has-text("다시 시도"), button:has-text("재시도"), [data-testid="retry-button"]',
  networkBanner: '[data-testid="network-banner"], [role="alert"]:has-text("인터넷")',
  offlineBanner: '[role="alert"]:has-text("인터넷 연결이 끊어졌습니다")',
  reconnectBanner: '[role="alert"]:has-text("인터넷 연결이 복구되었습니다")',

  // 플랜 생성 통합 섹션
  planCreation: {
    // 섹션
    studentSelectionSection: 'section:has-text("학생 선택")',
    methodSelectionSection: 'section:has-text("생성 방법 선택")',
    creationFlowSection: 'section:has-text("생성 진행")',
    resultsSection: 'section:has-text("결과")',

    // 학생 선택
    studentSearchInput: 'input[placeholder*="검색"]',
    studentTable: "table",
    studentRow: "tbody tr",
    studentCheckbox: 'input[type="checkbox"]',
    selectAllCheckbox: 'thead input[type="checkbox"]',
    selectedCountBadge: ':has-text("명 선택")',
    clearSelectionButton: 'button:has-text("선택 해제")',

    // 생성 방법
    methodCard: '[class*="rounded-xl"][class*="cursor-pointer"]',
    aiMethodCard: ':has-text("AI 플랜")',
    planGroupMethodCard: ':has-text("플랜 그룹")',
    quickPlanMethodCard: ':has-text("빠른 플랜")',
    contentAddMethodCard: ':has-text("콘텐츠 추가")',
    startCreationButton: 'button:has-text("생성 시작")',

    // 진행 상태
    progressTracker: '[class*="progress"]',
    progressBar: '[role="progressbar"]',
    currentStudentName: '[class*="current"]',
    pauseButton: 'button:has-text("일시정지")',
    resumeButton: 'button:has-text("재개")',

    // 결과
    resultsSummary: ':has-text("성공"), :has-text("실패")',
    resultsTable: "table",
    retryFailedButton: 'button:has-text("재시도")',
    newCreationButton: 'button:has-text("새 플랜 생성")',
  },
};

// ============================================
// 플랜 생성 테스트 데이터
// ============================================

export const PLAN_CREATION_DATA = {
  // AI 플랜 생성 설정
  aiSettings: {
    planDuration: 30,
    dailyStudyMinutes: 180,
    daysPerWeek: [1, 2, 3, 4, 5],
    focusAreas: ["수학", "영어"],
    difficultyLevel: "medium" as const,
  },

  // 플랜 그룹 설정
  planGroupSettings: {
    dailyStudyMinutes: 120,
    daysPerWeek: [1, 2, 3, 4, 5, 6],
    defaultDurationDays: 14,
  },

  // 빠른 플랜 설정
  quickPlanSettings: {
    defaultStartTime: "09:00",
    defaultEndTime: "10:00",
    defaultDurationMinutes: 60,
  },

  // 콘텐츠 추가 설정
  contentAddSettings: {
    distributionStrategy: "even" as const,
    defaultDurationDays: 7,
    dailyStudyMinutes: 90,
  },
};

// ============================================
// 플래너 테스트 데이터
// ============================================

export const PLANNER_TEST_DATA = {
  // 기본 플래너
  basic: {
    name: "E2E 테스트 플래너",
    description: "E2E 테스트용 플래너입니다.",
    periodStart: getToday(),
    periodEnd: getDaysLater(30),
    studyHours: {
      start: "10:00",
      end: "19:00",
    },
    selfStudyHours: {
      start: "19:00",
      end: "22:00",
    },
    lunchTime: {
      start: "12:00",
      end: "13:00",
    },
    schedulerType: "1730_timetable" as const,
    studyDays: 6,
    reviewDays: 1,
  },

  // 짧은 기간 플래너
  shortTerm: {
    name: "단기 집중 플래너",
    description: "2주 집중 학습",
    periodStart: getToday(),
    periodEnd: getDaysLater(14),
    studyHours: {
      start: "09:00",
      end: "21:00",
    },
    lunchTime: {
      start: "12:00",
      end: "13:00",
    },
    schedulerType: "1730_timetable" as const,
    studyDays: 7,
    reviewDays: 0,
  },

  // 학원 일정 포함 플래너
  withAcademySchedule: {
    name: "학원 일정 포함 플래너",
    description: "학원 일정이 포함된 플래너",
    periodStart: getToday(),
    periodEnd: getDaysLater(60),
    studyHours: {
      start: "10:00",
      end: "18:00",
    },
    lunchTime: {
      start: "12:00",
      end: "13:00",
    },
    academySchedules: [
      {
        academyName: "수학 학원",
        dayOfWeek: 1, // 월요일
        startTime: "14:00",
        endTime: "16:00",
        subject: "수학",
        travelTime: 30,
      },
      {
        academyName: "영어 학원",
        dayOfWeek: 3, // 수요일
        startTime: "15:00",
        endTime: "17:00",
        subject: "영어",
        travelTime: 45,
      },
    ],
    schedulerType: "1730_timetable" as const,
    studyDays: 5,
    reviewDays: 1,
  },

  // 제외일 포함 플래너
  withExclusions: {
    name: "제외일 포함 플래너",
    description: "휴일 제외일이 포함된 플래너",
    periodStart: getToday(),
    periodEnd: getDaysLater(45),
    studyHours: {
      start: "10:00",
      end: "19:00",
    },
    lunchTime: {
      start: "12:00",
      end: "13:00",
    },
    exclusions: [
      {
        exclusionDate: getDaysLater(7),
        exclusionType: "holiday",
        reason: "공휴일",
      },
      {
        exclusionDate: getDaysLater(14),
        exclusionType: "personal",
        reason: "가족 행사",
      },
    ],
    schedulerType: "1730_timetable" as const,
    studyDays: 6,
    reviewDays: 1,
  },
};
