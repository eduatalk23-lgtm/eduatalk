/**
 * Admin Plan E2E 테스트용 Fixtures
 *
 * 테스트에 사용되는 상수 및 헬퍼 함수를 정의합니다.
 */

import { type Page, expect } from '@playwright/test';

/**
 * 테스트 환경 설정
 */
export const TEST_CONFIG = {
  // 테스트 계정 정보 (환경 변수로 오버라이드 가능)
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'testpassword',
  },
  // 테스트 학생 ID
  studentId: process.env.TEST_STUDENT_ID || 'test-student-id',
  // 타임아웃
  timeout: {
    short: 3000,
    medium: 10000,
    long: 30000,
  },
};

/**
 * 페이지 URL 빌더
 */
export const URLS = {
  login: '/login',
  adminDashboard: '/admin/dashboard',
  studentPlans: (studentId: string) => `/admin/students/${studentId}/plans`,
};

/**
 * 모달 제목 상수
 */
export const MODAL_TITLES = {
  quickPlan: '빠른 플랜 추가',
  addContent: '콘텐츠 추가',
  addAdHoc: '단발성 추가',
  editPlan: '플랜 수정',
  bulkEdit: '일괄 수정',
  copyPlan: '플랜 복사',
  moveToGroup: '그룹 이동',
  statusChange: '상태 변경',
  conditionalDelete: '조건부 삭제',
  template: '플랜 템플릿',
  reorder: '순서 변경',
  aiPlan: 'AI 플랜 생성',
  createWizard: '플랜 그룹 생성',
  shortcuts: '단축키',
};

/**
 * 데이터 테스트 ID 상수
 */
export const TEST_IDS = {
  dailyDock: 'daily-dock',
  weeklyDock: 'weekly-dock',
  unfinishedDock: 'unfinished-dock',
  planItem: 'plan-item',
  statusBadge: 'status-badge',
  weeklyCalendar: 'weekly-calendar',
  deletedPlansView: 'deleted-plans-view',
};

/**
 * 로그인 헬퍼
 */
export async function loginAsAdmin(page: Page) {
  await page.goto(URLS.login);
  await page.fill('input[type="email"]', TEST_CONFIG.admin.email);
  await page.fill('input[type="password"]', TEST_CONFIG.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: TEST_CONFIG.timeout.medium });
}

/**
 * 학생 플랜 페이지 이동 헬퍼
 */
export async function goToStudentPlans(page: Page, studentId?: string) {
  const id = studentId || TEST_CONFIG.studentId;
  await page.goto(URLS.studentPlans(id));
  await page.waitForLoadState('networkidle');
}

/**
 * 모달 열림 확인 헬퍼
 */
export async function expectModalVisible(page: Page, title?: string) {
  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal).toBeVisible({ timeout: TEST_CONFIG.timeout.short });

  if (title) {
    await expect(page.getByText(title)).toBeVisible();
  }
}

/**
 * 모달 닫기 헬퍼
 */
export async function closeModal(page: Page) {
  // 취소 또는 닫기 버튼 클릭
  const cancelButton = page.locator('button:has-text("취소"), button:has-text("닫기")').first();
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
  } else {
    // Escape 키로 닫기
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(300);
}

/**
 * 모달 닫힘 확인 헬퍼
 */
export async function expectModalClosed(page: Page) {
  await expect(page.locator('.fixed.inset-0')).not.toBeVisible({
    timeout: TEST_CONFIG.timeout.short,
  });
}

/**
 * 플랜 카드 찾기 헬퍼
 */
export async function findPlanCard(page: Page, index = 0) {
  const planCards = page.locator(`[data-testid="${TEST_IDS.planItem}"]`);
  const count = await planCards.count();

  if (count > index) {
    return planCards.nth(index);
  }

  return null;
}

/**
 * 더보기 메뉴 열기 헬퍼
 */
export async function openMoreMenu(page: Page, planCard: ReturnType<typeof page.locator>) {
  const moreButton = planCard.locator('button[title*="더보기"], button:has([class*="MoreHorizontal"])');
  if (await moreButton.isVisible()) {
    await moreButton.click();
    await page.waitForTimeout(200);
    return true;
  }
  return false;
}

/**
 * 토스트 메시지 확인 헬퍼
 */
export async function expectToast(page: Page, message: string | RegExp) {
  const toast = page.locator('[role="alert"], [class*="toast"]');
  await expect(toast.filter({ hasText: message })).toBeVisible({
    timeout: TEST_CONFIG.timeout.short,
  });
}

/**
 * 날짜 문자열 포매터 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 오늘 날짜 문자열
 */
export function today(): string {
  return formatDate(new Date());
}

/**
 * 특정 일수 후 날짜 문자열
 */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
