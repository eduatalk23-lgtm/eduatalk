/**
 * 전역 카테고리 네비게이션 설정
 * 역할별(학생/관리자/학부모) 카테고리 구조를 정의합니다.
 */

export type NavigationRole = "student" | "admin" | "parent" | "superadmin";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];
  roles?: NavigationRole[]; // 특정 역할만 접근 가능 (없으면 모든 역할)
  exactMatch?: boolean; // 정확히 일치해야 활성화 (기본값: false, startsWith)
};

export type NavigationCategory = {
  id: string;
  label: string;
  icon?: string;
  items: NavigationItem[];
  roles?: NavigationRole[];
};

/**
 * 학생 영역 카테고리 설정
 */
const studentCategories: NavigationCategory[] = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "dashboard-main",
        label: "대시보드",
        href: "/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "camp",
    label: "캠프 관리",
    icon: "🏕️",
    items: [
      {
        id: "camp-list",
        label: "캠프 목록",
        href: "/camp",
        icon: "📋",
      },
      {
        id: "camp-calendar",
        label: "캠프 플랜 캘린더",
        href: "/camp/calendar",
        icon: "🗓️",
      },
      {
        id: "camp-today",
        label: "캠프 학습관리",
        href: "/camp/today",
        icon: "📅",
      },
    ],
  },
  {
    id: "plan",
    label: "플랜 관리",
    icon: "📋",
    items: [
      {
        id: "plan-list",
        label: "플랜 목록",
        href: "/plan",
        icon: "📋",
      },
      {
        id: "plan-calendar",
        label: "플랜 캘린더",
        href: "/plan/calendar",
        icon: "🗓️",
      },
      {
        id: "plan-today",
        label: "학습 관리",
        href: "/today",
        icon: "📅",
      },
    ],
  },
  {
    id: "contents",
    label: "콘텐츠 관리",
    icon: "📚",
    items: [
      {
        id: "contents-list",
        label: "콘텐츠",
        href: "/contents",
        icon: "📚",
      },
    ],
  },
  {
    id: "time",
    label: "시간 관리",
    icon: "⏰",
    items: [
      {
        id: "blocks-sets",
        label: "블록 세트",
        href: "/blocks?tab=blocks",
        icon: "📅",
      },
      {
        id: "blocks-exclusions",
        label: "학습 제외 일정",
        href: "/blocks?tab=exclusions",
        icon: "🗓️",
      },
      {
        id: "blocks-academy",
        label: "학원 일정",
        href: "/blocks?tab=academy",
        icon: "🏫",
      },
    ],
  },
  {
    id: "scores",
    label: "성적 관리",
    icon: "📝",
    items: [
      {
        id: "scores-dashboard",
        label: "성적 대시보드",
        href: "/scores/dashboard/unified",
        icon: "📊",
      },
      {
        id: "scores-input-internal",
        label: "내신 성적 입력",
        href: "/scores/input?tab=internal",
        icon: "✏️",
      },
      {
        id: "scores-input-mock",
        label: "모의고사 성적 입력",
        href: "/scores/input?tab=mock",
        icon: "📝",
      },
      {
        id: "scores-analysis",
        label: "상세 분석 보기",
        href: "/scores/analysis",
        icon: "📈",
      },
    ],
  },
  {
    id: "attendance",
    label: "출석 관리",
    icon: "✅",
    items: [
      {
        id: "attendance-check-in",
        label: "출석 체크",
        href: "/attendance/check-in",
        icon: "✅",
      },
    ],
  },
  {
    id: "reports",
    label: "학습 리포트",
    icon: "📊",
    items: [
      {
        id: "reports-weekly",
        label: "주간 리포트",
        href: "/reports?period=weekly",
        icon: "📅",
      },
      {
        id: "reports-monthly",
        label: "월간 리포트",
        href: "/reports?period=monthly",
        icon: "📆",
      },
      {
        id: "reports-weekly-detail",
        label: "상세 주간 리포트",
        href: "/report/weekly",
        icon: "📈",
      },
      {
        id: "reports-monthly-detail",
        label: "상세 월간 리포트",
        href: "/report/monthly",
        icon: "📊",
      },
    ],
  },
  {
    id: "settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "settings-profile",
        label: "프로필",
        href: "/settings",
        icon: "👤",
      },
      {
        id: "settings-notifications",
        label: "알림 설정",
        href: "/settings/notifications",
        icon: "🔔",
      },
      {
        id: "settings-devices",
        label: "로그인 기기 관리",
        href: "/settings/devices",
        icon: "📱",
      },
      {
        id: "settings-account",
        label: "계정 관리",
        href: "/settings/account",
        icon: "🔐",
      },
    ],
  },
];

/**
 * 관리자 영역 카테고리 설정
 */
const adminCategories: NavigationCategory[] = [
  {
    id: "admin-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "admin-dashboard-main",
        label: "대시보드",
        href: "/admin/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "admin-students",
    label: "학생 관리",
    icon: "👥",
    items: [
      {
        id: "admin-students-list",
        label: "학생 목록",
        href: "/admin/students",
        icon: "👥",
      },
      {
        id: "admin-students-attendance",
        label: "출석 관리",
        href: "/admin/attendance",
        icon: "✓",
      },
      {
        id: "admin-attendance-qr-code",
        label: "QR 코드 생성",
        href: "/admin/attendance/qr-code",
        icon: "📱",
      },
      {
        id: "admin-attendance-settings",
        label: "출석 위치 설정",
        href: "/admin/attendance/settings",
        icon: "📍",
      },
      {
        id: "admin-parent-links",
        label: "학부모 연결 관리",
        href: "/admin/parent-links",
        icon: "👨‍👩‍👧",
      },
    ],
  },
  {
    id: "admin-consulting",
    label: "상담 노트",
    icon: "📝",
    items: [
      {
        id: "admin-consulting-list",
        label: "상담 노트",
        href: "/admin/consulting",
        icon: "📝",
      },
    ],
  },
  {
    id: "admin-communication",
    label: "SMS 관리",
    icon: "📱",
    items: [
      {
        id: "admin-sms-send",
        label: "SMS 발송",
        href: "/admin/sms/send",
        icon: "📤",
      },
      {
        id: "admin-sms-logs",
        label: "SMS 발송 이력",
        href: "/admin/sms/results",
        icon: "📱",
      },
    ],
  },
  {
    id: "admin-reports",
    label: "리포트",
    icon: "📄",
    items: [
      {
        id: "admin-reports-list",
        label: "리포트",
        href: "/admin/reports",
        icon: "📄",
      },
    ],
  },
  {
    id: "admin-compare",
    label: "비교 분석",
    icon: "📈",
    items: [
      {
        id: "admin-compare-main",
        label: "비교 분석",
        href: "/admin/compare",
        icon: "📈",
      },
    ],
  },
  {
    id: "admin-master-content",
    label: "서비스 마스터",
    icon: "📚",
    items: [
      {
        id: "admin-content-metadata",
        label: "콘텐츠 메타데이터",
        href: "/admin/content-metadata",
        icon: "📋",
      },
      {
        id: "admin-subjects",
        label: "교과/과목 관리",
        href: "/admin/subjects",
        icon: "📚",
      },
      {
        id: "admin-master-books",
        label: "교재 관리",
        href: "/admin/master-books",
        icon: "📖",
      },
      {
        id: "admin-master-lectures",
        label: "강의 관리",
        href: "/admin/master-lectures",
        icon: "🎧",
      },
      {
        id: "admin-schools",
        label: "학교 관리",
        href: "/admin/schools",
        icon: "🏫",
      },
    ],
  },
  {
    id: "admin-time-management",
    label: "시간 관리",
    icon: "⏰",
    items: [
      {
        id: "admin-time-management-main",
        label: "시간 관리",
        href: "/admin/time-management",
        icon: "⏰",
      },
    ],
  },
  {
    id: "admin-camp",
    label: "캠프 관리",
    icon: "🏕️",
    items: [
      {
        id: "admin-camp-templates",
        label: "캠프 템플릿",
        href: "/admin/camp-templates",
        icon: "🏕️",
      },
    ],
  },
  {
    id: "admin-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "admin-settings-main",
        label: "설정",
        href: "/admin/settings",
        icon: "⚙️",
      },
      {
        id: "admin-tenant-settings",
        label: "기관 설정",
        href: "/admin/tenant/settings",
        icon: "🏢",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-scheduler-settings",
        label: "스케줄러 설정",
        href: "/admin/settings/scheduler",
        icon: "📅",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-recommendation-settings",
        label: "추천 시스템 설정",
        href: "/admin/recommendation-settings",
        icon: "🎯",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tenant-users",
        label: "기관별 사용자 관리",
        href: "/admin/tenant/users",
        icon: "👥",
        roles: ["admin"], // admin만 접근
      },
      {
        id: "admin-tools",
        label: "도구",
        href: "/admin/tools",
        icon: "🛠️",
      },
    ],
  },
];

/**
 * Super Admin 영역 카테고리 설정
 */
const superadminCategories: NavigationCategory[] = [
  {
    id: "superadmin-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "superadmin-dashboard-main",
        label: "대시보드",
        href: "/superadmin/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "superadmin-tenants",
    label: "기관 관리",
    icon: "🏛️",
    items: [
      {
        id: "superadmin-tenants-main",
        label: "기관 관리",
        href: "/superadmin/tenants",
        icon: "🏛️",
      },
    ],
  },
  {
    id: "superadmin-users",
    label: "사용자 관리",
    icon: "👥",
    items: [
      {
        id: "superadmin-admin-users",
        label: "관리자 계정",
        href: "/superadmin/admin-users",
        icon: "👤",
      },
      {
        id: "superadmin-unverified-users",
        label: "미인증 가입 관리",
        href: "/superadmin/unverified-users",
        icon: "✉️",
      },
      {
        id: "superadmin-tenantless-users",
        label: "테넌트 미할당 사용자",
        href: "/superadmin/tenantless-users",
        icon: "🔗",
      },
    ],
  },
  {
    id: "superadmin-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "superadmin-settings-main",
        label: "설정",
        href: "/superadmin/settings",
        icon: "⚙️",
      },
      {
        id: "superadmin-curriculum-settings",
        label: "교육과정 설정",
        href: "/superadmin/curriculum-settings",
        icon: "📚",
      },
    ],
  },
];

/**
 * 학부모 영역 카테고리 설정
 */
const parentCategories: NavigationCategory[] = [
  {
    id: "parent-dashboard",
    label: "대시보드",
    icon: "📊",
    items: [
      {
        id: "parent-dashboard-main",
        label: "대시보드",
        href: "/parent/dashboard",
        icon: "📊",
      },
    ],
  },
  {
    id: "parent-reports",
    label: "리포트",
    icon: "📄",
    items: [
      {
        id: "parent-reports-weekly",
        label: "주간 리포트",
        href: "/parent/report/weekly",
        icon: "📅",
      },
      {
        id: "parent-reports-monthly",
        label: "월간 리포트",
        href: "/parent/report/monthly",
        icon: "📆",
      },
    ],
  },
  {
    id: "parent-performance",
    label: "성과",
    icon: "📈",
    items: [
      {
        id: "parent-scores",
        label: "성적",
        href: "/parent/scores",
        icon: "📈",
      },
      {
        id: "parent-goals",
        label: "목표",
        href: "/parent/goals",
        icon: "🎯",
      },
      {
        id: "parent-history",
        label: "이력",
        href: "/parent/history",
        icon: "📜",
      },
    ],
  },
  {
    id: "parent-settings",
    label: "설정",
    icon: "⚙️",
    items: [
      {
        id: "parent-settings-main",
        label: "설정",
        href: "/parent/settings",
        icon: "⚙️",
      },
    ],
  },
];

/**
 * 역할별 카테고리 설정 맵
 */
export const categoryConfig: Record<NavigationRole, NavigationCategory[]> = {
  student: studentCategories,
  admin: adminCategories,
  parent: parentCategories,
  superadmin: superadminCategories,
};

/**
 * 역할별 카테고리 설정 조회
 */
export function getCategoriesForRole(
  role: NavigationRole
): NavigationCategory[] {
  return categoryConfig[role] || [];
}

/**
 * 모든 카테고리 아이템 플랫 목록 생성 (검색/필터링 용)
 */
export function getAllNavigationItems(role: NavigationRole): NavigationItem[] {
  const categories = getCategoriesForRole(role);
  const items: NavigationItem[] = [];

  function collectItems(
    items: NavigationItem[],
    categoryItems: NavigationItem[]
  ) {
    for (const item of categoryItems) {
      // 역할 체크
      if (item.roles && !item.roles.includes(role)) {
        continue;
      }
      items.push(item);
      if (item.children) {
        collectItems(items, item.children);
      }
    }
  }

  for (const category of categories) {
    collectItems(items, category.items);
  }

  return items;
}
