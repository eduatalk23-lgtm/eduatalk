/**
 * E2E 테스트 인증 헬퍼
 *
 * Playwright 테스트에서 사용하는 인증 관련 유틸리티
 */

import { type Page } from "@playwright/test";

/**
 * 환경 변수에서 테스트 계정 정보 로드
 */
export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || "admin@test.com",
    password: process.env.TEST_ADMIN_PASSWORD || "testpassword123",
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL || "student@test.com",
    password: process.env.TEST_STUDENT_PASSWORD || "testpassword123",
  },
};

/**
 * 관리자로 로그인
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");

  // 이메일 입력
  await page.fill(
    'input[type="email"], input[name="email"]',
    TEST_CREDENTIALS.admin.email
  );

  // 비밀번호 입력
  await page.fill(
    'input[type="password"], input[name="password"]',
    TEST_CREDENTIALS.admin.password
  );

  // 로그인 버튼 클릭
  await page.click('button[type="submit"]');

  // 관리자 대시보드로 이동 대기
  await page.waitForURL(/\/admin/, { timeout: 15000 });
}

/**
 * 학생으로 로그인
 */
export async function loginAsStudent(page: Page): Promise<void> {
  await page.goto("/login");

  await page.fill(
    'input[type="email"], input[name="email"]',
    TEST_CREDENTIALS.student.email
  );

  await page.fill(
    'input[type="password"], input[name="password"]',
    TEST_CREDENTIALS.student.password
  );

  await page.click('button[type="submit"]');

  // 학생 대시보드로 이동 대기
  await page.waitForURL(/\/(dashboard|plan|today)/, { timeout: 15000 });
}

/**
 * 로그아웃
 */
export async function logout(page: Page): Promise<void> {
  // 사용자 메뉴 클릭 (아바타 또는 사용자 이름)
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("프로필")');
  if (await userMenu.isVisible()) {
    await userMenu.click();
  }

  // 로그아웃 버튼 클릭
  await page.click('button:has-text("로그아웃"), [data-testid="logout-button"]');

  // 로그인 페이지로 이동 대기
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

/**
 * 현재 로그인된 사용자 역할 확인
 */
export async function getCurrentUserRole(page: Page): Promise<"admin" | "student" | "parent" | null> {
  const url = page.url();

  if (url.includes("/admin")) {
    return "admin";
  } else if (url.includes("/parent")) {
    return "parent";
  } else if (url.includes("/dashboard") || url.includes("/plan") || url.includes("/today")) {
    return "student";
  }

  return null;
}

/**
 * 로그인 상태 확인
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // 로그인 페이지가 아니고 인증된 페이지에 있는지 확인
  const url = page.url();
  const isOnLoginPage = url.includes("/login");
  const isOnAuthenticatedPage =
    url.includes("/admin") ||
    url.includes("/dashboard") ||
    url.includes("/plan") ||
    url.includes("/today") ||
    url.includes("/parent");

  return !isOnLoginPage && isOnAuthenticatedPage;
}
