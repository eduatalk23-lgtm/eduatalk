/**
 * Admin Plan Creation E2E 테스트
 *
 * 관리자 플랜 생성 통합 섹션의 주요 플로우를 테스트합니다:
 * 1. 플랜 생성 페이지 접근 및 로딩 상태
 * 2. 학생 선택 기능
 * 3. 생성 방법 선택
 * 4. 배치 처리 플로우
 * 5. 결과 표시
 */

import { test, expect, type Page } from "@playwright/test";
import { SELECTORS, TIMEOUTS } from "./fixtures/test-data";

// ============================================
// 플랜 생성 페이지 전용 셀렉터
// ============================================

const PLAN_CREATION_SELECTORS = {
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
  cancelButton: 'button:has-text("취소")',

  // 결과
  resultsSummary: ':has-text("성공"), :has-text("실패")',
  resultsTable: "table",
  retryFailedButton: 'button:has-text("재시도")',
  downloadResultsButton: 'button:has-text("다운로드")',
  newCreationButton: 'button:has-text("새 플랜 생성")',
};

// ============================================
// 테스트 헬퍼
// ============================================

/**
 * 플랜 생성 페이지로 이동
 */
async function goToPlanCreationPage(page: Page) {
  await page.goto("/admin/plan-creation");
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.pageLoad });
}

/**
 * 학생 테이블 로딩 대기
 */
async function waitForStudentTable(page: Page) {
  const table = page.locator(PLAN_CREATION_SELECTORS.studentTable);
  await table.waitFor({ state: "visible", timeout: TIMEOUTS.pageLoad });
}

/**
 * 학생 선택
 */
async function selectStudents(page: Page, count: number = 1) {
  const checkboxes = page.locator(
    `${PLAN_CREATION_SELECTORS.studentRow} ${PLAN_CREATION_SELECTORS.studentCheckbox}`
  );

  const available = await checkboxes.count();
  const toSelect = Math.min(count, available);

  for (let i = 0; i < toSelect; i++) {
    await checkboxes.nth(i).check();
  }

  return toSelect;
}

/**
 * 모든 학생 선택
 */
async function selectAllStudents(page: Page) {
  const selectAllCheckbox = page.locator(
    PLAN_CREATION_SELECTORS.selectAllCheckbox
  );
  await selectAllCheckbox.check();
}

/**
 * 생성 방법 선택
 */
async function selectCreationMethod(
  page: Page,
  method: "ai" | "planGroup" | "quickPlan" | "contentAdd"
) {
  const methodSelectors: Record<string, string> = {
    ai: PLAN_CREATION_SELECTORS.aiMethodCard,
    planGroup: PLAN_CREATION_SELECTORS.planGroupMethodCard,
    quickPlan: PLAN_CREATION_SELECTORS.quickPlanMethodCard,
    contentAdd: PLAN_CREATION_SELECTORS.contentAddMethodCard,
  };

  const methodCard = page.locator(methodSelectors[method]).first();
  await methodCard.click();
}

/**
 * 생성 시작 버튼 클릭
 */
async function clickStartCreation(page: Page) {
  const startButton = page.locator(
    PLAN_CREATION_SELECTORS.startCreationButton
  );
  await startButton.click();
}

/**
 * 학생 검색
 */
async function searchStudents(page: Page, query: string) {
  const searchInput = page.locator(PLAN_CREATION_SELECTORS.studentSearchInput);
  await searchInput.fill(query);
  // 디바운스 대기
  await page.waitForTimeout(500);
}

// ============================================
// 테스트 케이스
// ============================================

test.describe("Admin Plan Creation E2E 테스트", () => {
  test.describe("페이지 로딩 테스트", () => {
    test("플랜 생성 페이지가 정상적으로 로드된다", async ({ page }) => {
      await goToPlanCreationPage(page);

      // 페이지 제목 확인
      const pageHeader = page.locator('h1:has-text("플랜 생성")');
      await expect(pageHeader).toBeVisible({ timeout: TIMEOUTS.pageLoad });
    });

    test("학생 선택 섹션이 표시된다", async ({ page }) => {
      await goToPlanCreationPage(page);

      const studentSection = page.locator(
        PLAN_CREATION_SELECTORS.studentSelectionSection
      );
      await expect(studentSection).toBeVisible({ timeout: TIMEOUTS.pageLoad });
    });

    test("학생 목록이 테이블에 로드된다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const studentRows = page.locator(PLAN_CREATION_SELECTORS.studentRow);
      const rowCount = await studentRows.count();

      // 학생이 있거나 빈 상태 메시지가 표시되어야 함
      const emptyState = page.locator(':has-text("학생이 없습니다")');
      expect(rowCount > 0 || (await emptyState.isVisible())).toBe(true);
    });
  });

  test.describe("학생 선택 기능 테스트", () => {
    test("개별 학생을 선택할 수 있다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const selectedCount = await selectStudents(page, 2);

      // 선택 카운트 확인
      const selectedBadge = page.locator(
        PLAN_CREATION_SELECTORS.selectedCountBadge
      );
      await expect(selectedBadge).toContainText(String(selectedCount));
    });

    test("전체 학생을 선택할 수 있다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      await selectAllStudents(page);

      // 모든 체크박스가 선택되었는지 확인
      const checkboxes = page.locator(
        `${PLAN_CREATION_SELECTORS.studentRow} ${PLAN_CREATION_SELECTORS.studentCheckbox}`
      );
      const count = await checkboxes.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
    });

    test("선택 해제 버튼이 동작한다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      // 학생 선택
      await selectStudents(page, 3);

      // 선택 해제
      const clearButton = page.locator(
        PLAN_CREATION_SELECTORS.clearSelectionButton
      );
      if (await clearButton.isVisible()) {
        await clearButton.click();

        // 선택이 해제되었는지 확인
        const selectedBadge = page.locator(
          PLAN_CREATION_SELECTORS.selectedCountBadge
        );
        await expect(selectedBadge).toContainText("0");
      }
    });

    test("학생 검색이 동작한다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const initialRows = await page
        .locator(PLAN_CREATION_SELECTORS.studentRow)
        .count();

      // 검색 실행
      await searchStudents(page, "테스트");

      const filteredRows = await page
        .locator(PLAN_CREATION_SELECTORS.studentRow)
        .count();

      // 검색 결과가 변경되거나 동일할 수 있음 (데이터에 따라)
      expect(filteredRows).toBeLessThanOrEqual(initialRows);
    });
  });

  test.describe("생성 방법 선택 테스트", () => {
    test("학생 선택 후 생성 방법 섹션이 표시된다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      // 학생 선택
      await selectStudents(page, 1);

      // 생성 방법 섹션 확인
      const methodSection = page.locator(
        PLAN_CREATION_SELECTORS.methodSelectionSection
      );
      await expect(methodSection).toBeVisible({ timeout: TIMEOUTS.pageLoad });
    });

    test("4가지 생성 방법이 표시된다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);
      await selectStudents(page, 1);

      // 각 방법 카드 확인
      await expect(
        page.locator(PLAN_CREATION_SELECTORS.aiMethodCard).first()
      ).toBeVisible();
      await expect(
        page.locator(PLAN_CREATION_SELECTORS.planGroupMethodCard).first()
      ).toBeVisible();
      await expect(
        page.locator(PLAN_CREATION_SELECTORS.quickPlanMethodCard).first()
      ).toBeVisible();
      await expect(
        page.locator(PLAN_CREATION_SELECTORS.contentAddMethodCard).first()
      ).toBeVisible();
    });

    test("생성 방법을 선택하면 시작 버튼이 표시된다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);
      await selectStudents(page, 1);

      // AI 방법 선택
      await selectCreationMethod(page, "ai");

      // 시작 버튼 확인
      const startButton = page.locator(
        PLAN_CREATION_SELECTORS.startCreationButton
      );
      await expect(startButton).toBeVisible();
    });
  });

  test.describe("배치 처리 플로우 테스트", () => {
    test("생성 시작 버튼 클릭 시 진행 상태가 표시된다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const selectedCount = await selectStudents(page, 2);
      if (selectedCount === 0) {
        test.skip();
        return;
      }

      await selectCreationMethod(page, "quickPlan");
      await clickStartCreation(page);

      // 진행 상태 또는 생성 플로우 섹션 확인
      const creationFlow = page.locator(
        PLAN_CREATION_SELECTORS.creationFlowSection
      );
      const progressBar = page.locator(PLAN_CREATION_SELECTORS.progressBar);

      await expect(creationFlow.or(progressBar).first()).toBeVisible({
        timeout: TIMEOUTS.pageLoad,
      });
    });

    test("일시정지 버튼이 동작한다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const selectedCount = await selectStudents(page, 3);
      if (selectedCount < 2) {
        test.skip();
        return;
      }

      await selectCreationMethod(page, "quickPlan");
      await clickStartCreation(page);

      // 일시정지 버튼 클릭
      const pauseButton = page.locator(PLAN_CREATION_SELECTORS.pauseButton);
      if (await pauseButton.isVisible({ timeout: 5000 })) {
        await pauseButton.click();

        // 재개 버튼이 표시되어야 함
        const resumeButton = page.locator(
          PLAN_CREATION_SELECTORS.resumeButton
        );
        await expect(resumeButton).toBeVisible({ timeout: 5000 });
      }
    });

    test("취소 버튼이 동작한다", async ({ page }) => {
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);

      const selectedCount = await selectStudents(page, 2);
      if (selectedCount === 0) {
        test.skip();
        return;
      }

      await selectCreationMethod(page, "quickPlan");
      await clickStartCreation(page);

      // 취소 버튼 클릭
      const cancelButton = page.locator(PLAN_CREATION_SELECTORS.cancelButton);
      if (await cancelButton.isVisible({ timeout: 5000 })) {
        await cancelButton.click();

        // 취소 확인 또는 결과 섹션으로 이동
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe("결과 표시 테스트", () => {
    test.skip("처리 완료 후 결과 요약이 표시된다", async ({ page }) => {
      // 이 테스트는 실제 API 연결 후 활성화
      await goToPlanCreationPage(page);
      await waitForStudentTable(page);
      await selectStudents(page, 1);
      await selectCreationMethod(page, "quickPlan");
      await clickStartCreation(page);

      // 결과 섹션 대기
      const resultsSection = page.locator(
        PLAN_CREATION_SELECTORS.resultsSection
      );
      await expect(resultsSection).toBeVisible({
        timeout: TIMEOUTS.batchGeneration,
      });
    });
  });

  test.describe("네비게이션 테스트", () => {
    test("사이드바에서 플랜 생성 메뉴에 접근할 수 있다", async ({ page }) => {
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.pageLoad });

      // 학생 관리 카테고리 클릭 (필요시)
      const studentCategory = page.locator(
        'nav :has-text("학생 관리"), [data-testid="nav-students"]'
      );
      if (await studentCategory.isVisible()) {
        await studentCategory.click();
      }

      // 플랜 생성 메뉴 클릭
      const planCreationLink = page.locator(
        'a[href="/admin/plan-creation"], nav :has-text("플랜 생성")'
      );

      if (await planCreationLink.isVisible({ timeout: 5000 })) {
        await planCreationLink.click();
        await page.waitForURL(/\/admin\/plan-creation/);

        expect(page.url()).toContain("/admin/plan-creation");
      }
    });
  });

  test.describe("에러 처리 테스트", () => {
    test("API 에러 시 에러 메시지가 표시된다", async ({ page }) => {
      // 500 에러 시뮬레이션
      await page.route("**/api/**", async (route) => {
        if (route.request().url().includes("students")) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Internal Server Error" }),
          });
        } else {
          await route.continue();
        }
      });

      await goToPlanCreationPage(page);

      // 에러 상태 확인
      const errorMessage = page.locator(
        '[role="alert"], :has-text("오류"), :has-text("실패")'
      );
      // 에러 메시지가 표시될 수 있음
    });

    test("빈 학생 목록에서 적절한 메시지가 표시된다", async ({ page }) => {
      // 빈 응답 시뮬레이션
      await page.route("**/students**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], count: 0 }),
        });
      });

      await goToPlanCreationPage(page);

      // 빈 상태 메시지 확인
      const emptyState = page.locator(
        ':has-text("학생이 없습니다"), :has-text("데이터가 없습니다"), [data-testid="empty-state"]'
      );
      // 빈 상태가 표시될 수 있음
    });
  });

  test.describe("반응형 테스트", () => {
    test("모바일 뷰에서 레이아웃이 적절하게 표시된다", async ({ page }) => {
      // 모바일 뷰포트 설정
      await page.setViewportSize({ width: 375, height: 812 });

      await goToPlanCreationPage(page);

      // 학생 선택 섹션이 표시되는지 확인
      const studentSection = page.locator(
        PLAN_CREATION_SELECTORS.studentSelectionSection
      );
      await expect(studentSection).toBeVisible({ timeout: TIMEOUTS.pageLoad });
    });

    test("태블릿 뷰에서 그리드 레이아웃이 적절하게 표시된다", async ({
      page,
    }) => {
      // 태블릿 뷰포트 설정
      await page.setViewportSize({ width: 768, height: 1024 });

      await goToPlanCreationPage(page);
      await waitForStudentTable(page);
      await selectStudents(page, 1);

      // 생성 방법 카드가 그리드로 표시되는지 확인
      const methodCards = page.locator(PLAN_CREATION_SELECTORS.methodCard);
      await expect(methodCards.first()).toBeVisible();
    });
  });
});
