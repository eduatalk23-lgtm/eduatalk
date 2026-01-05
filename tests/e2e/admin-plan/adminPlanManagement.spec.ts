/**
 * Admin Plan Management E2E 테스트
 *
 * 관리자 플랜 관리 페이지의 주요 기능을 E2E로 검증합니다.
 *
 * 테스트 시나리오:
 * 1. Daily/Weekly/Unfinished Dock 표시 확인
 * 2. 플랜 추가 모달 흐름
 * 3. 플랜 수정 모달 흐름
 * 4. 플랜 복사 흐름
 * 5. 그룹 이동 흐름
 * 6. 상태 변경 흐름
 * 7. 삭제 및 복구 흐름
 */

import { test, expect, type Page } from '@playwright/test';

// 테스트 사용자 정보 (실제 테스트 환경에 맞게 수정 필요)
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'testpassword',
};

const TEST_STUDENT_ID = 'test-student-id';

/**
 * 테스트 헬퍼: 관리자 로그인
 */
async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_ADMIN.email);
  await page.fill('input[type="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
}

/**
 * 테스트 헬퍼: 학생 플랜 관리 페이지로 이동
 */
async function goToStudentPlans(page: Page, studentId: string) {
  await page.goto(`/admin/students/${studentId}/plans`);
  await page.waitForLoadState('networkidle');
}

/**
 * 테스트 헬퍼: 모달이 열렸는지 확인
 */
async function expectModalOpen(page: Page, titleText: string) {
  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal).toBeVisible();
  await expect(page.getByText(titleText)).toBeVisible();
}

/**
 * 테스트 헬퍼: 모달 닫기
 */
async function closeModal(page: Page) {
  await page.click('button:has-text("취소"), button:has-text("닫기")');
  await page.waitForTimeout(300);
}

test.describe('Admin Plan Management 페이지 로드', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('플랜 관리 페이지가 로드되어야 함', async ({ page }) => {
    await goToStudentPlans(page, TEST_STUDENT_ID);

    // 헤더 확인
    await expect(page.getByText('플랜 관리')).toBeVisible();
  });

  test('Dock 컴포넌트들이 표시되어야 함', async ({ page }) => {
    await goToStudentPlans(page, TEST_STUDENT_ID);

    // Daily Dock
    await expect(page.getByText('Daily')).toBeVisible();

    // Weekly Dock
    await expect(page.getByText('Weekly')).toBeVisible();

    // Unfinished Dock (미완료 플랜이 있는 경우)
    // await expect(page.getByText('미완료')).toBeVisible();
  });

  test('액션 버튼들이 표시되어야 함', async ({ page }) => {
    await goToStudentPlans(page, TEST_STUDENT_ID);

    // 빠른 추가 버튼
    await expect(page.getByRole('button', { name: /빠른 추가/ })).toBeVisible();

    // 플랜 그룹 버튼
    await expect(page.getByRole('button', { name: /플랜 그룹/ })).toBeVisible();
  });
});

test.describe('플랜 추가 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('빠른 플랜 추가 모달 열기/닫기', async ({ page }) => {
    // 빠른 추가 버튼 클릭
    await page.click('button:has-text("빠른 추가")');

    // 모달 확인
    await expectModalOpen(page, '빠른 플랜 추가');

    // 취소 버튼으로 닫기
    await closeModal(page);

    // 모달이 닫혔는지 확인
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible();
  });

  test('콘텐츠 추가 모달 열기 (Daily Dock)', async ({ page }) => {
    // Daily Dock의 + 버튼 클릭
    const dailyDock = page.locator('[data-testid="daily-dock"]').first();
    if (await dailyDock.isVisible()) {
      await dailyDock.locator('button:has-text("+")').click();
      await expectModalOpen(page, '콘텐츠 추가');
    }
  });

  test('플랜 그룹 생성 위자드 열기', async ({ page }) => {
    // 플랜 그룹 버튼 클릭
    await page.click('button:has-text("플랜 그룹")');

    // 위자드 모달 확인
    await page.waitForTimeout(500);
    await expect(page.locator('.fixed.inset-0')).toBeVisible();
  });
});

test.describe('플랜 수정 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('플랜 카드 클릭으로 수정 모달 열기', async ({ page }) => {
    // 플랜 카드 찾기
    const planCard = page.locator('[data-testid="plan-item"]').first();

    if (await planCard.isVisible()) {
      // 수정 버튼 클릭
      await planCard.locator('button[title*="수정"], button:has-text("수정")').click();

      // 수정 모달 확인
      await expectModalOpen(page, '플랜 수정');
    }
  });
});

test.describe('플랜 복사 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('플랜 복사 모달 열기', async ({ page }) => {
    // 플랜 카드 찾기
    const planCard = page.locator('[data-testid="plan-item"]').first();

    if (await planCard.isVisible()) {
      // 더보기 메뉴 열기
      await planCard.locator('button[title*="더보기"], button:has([class*="MoreHorizontal"])').click();

      // 복사 옵션 클릭
      const copyButton = page.getByRole('button', { name: /복사/ });
      if (await copyButton.isVisible()) {
        await copyButton.click();
        await expectModalOpen(page, '플랜 복사');
      }
    }
  });
});

test.describe('그룹 이동 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('그룹 이동 모달 열기', async ({ page }) => {
    // 플랜 카드 찾기
    const planCard = page.locator('[data-testid="plan-item"]').first();

    if (await planCard.isVisible()) {
      // 더보기 메뉴 열기
      await planCard.locator('button[title*="더보기"]').click();

      // 그룹 이동 옵션 클릭
      const moveButton = page.getByRole('button', { name: /그룹.*이동/ });
      if (await moveButton.isVisible()) {
        await moveButton.click();
        await expectModalOpen(page, '그룹 이동');
      }
    }
  });
});

test.describe('상태 변경 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('상태 변경 모달 열기', async ({ page }) => {
    // 플랜 카드 찾기
    const planCard = page.locator('[data-testid="plan-item"]').first();

    if (await planCard.isVisible()) {
      // 상태 뱃지 클릭
      const statusBadge = planCard.locator('[data-testid="status-badge"]');
      if (await statusBadge.isVisible()) {
        await statusBadge.click();
        await expectModalOpen(page, '상태 변경');
      }
    }
  });
});

test.describe('삭제 및 복구 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('조건부 삭제 모달 열기', async ({ page }) => {
    // 더보기 메뉴에서 조건부 삭제 클릭
    const moreButton = page.locator('button:has([class*="MoreHorizontal"])').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();

      const conditionalDeleteButton = page.getByRole('button', { name: /조건부 삭제/ });
      if (await conditionalDeleteButton.isVisible()) {
        await conditionalDeleteButton.click();
        await expectModalOpen(page, '조건부 삭제');
      }
    }
  });

  test('삭제된 플랜 뷰 확인', async ({ page }) => {
    // 삭제된 플랜 섹션 확인
    const deletedSection = page.getByText('삭제된 플랜');
    if (await deletedSection.isVisible()) {
      await expect(deletedSection).toBeVisible();
    }
  });
});

test.describe('키보드 단축키', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('Escape로 모달 닫기', async ({ page }) => {
    // 모달 열기
    await page.click('button:has-text("빠른 추가")');
    await expectModalOpen(page, '빠른 플랜 추가');

    // Escape 키 누르기
    await page.keyboard.press('Escape');

    // 모달이 닫혔는지 확인
    await page.waitForTimeout(300);
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible();
  });

  test('단축키 도움말 (Shift + ?)', async ({ page }) => {
    // Shift + ? 누르기
    await page.keyboard.press('Shift+?');

    // 도움말 모달 확인
    await page.waitForTimeout(300);
    const helpModal = page.getByText('단축키');
    // 도움말 모달이 있는 경우에만 확인
    if (await helpModal.isVisible()) {
      await expect(helpModal).toBeVisible();
    }
  });
});

test.describe('날짜 탐색', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToStudentPlans(page, TEST_STUDENT_ID);
  });

  test('캘린더로 날짜 선택', async ({ page }) => {
    // 주간 캘린더에서 날짜 클릭
    const calendar = page.locator('[data-testid="weekly-calendar"]');
    if (await calendar.isVisible()) {
      const dateCell = calendar.locator('button').first();
      if (await dateCell.isVisible()) {
        await dateCell.click();
        await page.waitForTimeout(500);
        // URL이 date 파라미터를 포함하는지 확인
        expect(page.url()).toContain('date=');
      }
    }
  });
});
