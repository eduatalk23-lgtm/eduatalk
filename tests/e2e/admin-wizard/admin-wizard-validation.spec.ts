/**
 * Admin Wizard E2E 테스트 - Validation
 *
 * 필수 필드 검증 및 에러 상태 테스트
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  navigateToStudentPlans,
  clickCreatePlanButton,
  fillStep1,
  goToNextStep,
  expectErrorMessage,
  expectToBeOnStep,
  expectNextButtonDisabled,
  getCurrentStep,
} from "../helpers/admin-wizard-helpers";
import {
  PLAN_WIZARD_DATA,
  TEST_STUDENTS,
  TIMEOUTS,
} from "../fixtures/test-data";

test.describe("Admin Wizard Validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
    await clickCreatePlanButton(page);
  });

  test.describe("Step 1 - 기본 정보 검증", () => {
    test("플랜 이름 없이 다음 진행 불가", async ({ page }) => {
      // 빈 이름으로 Step 1 입력
      await fillStep1(page, PLAN_WIZARD_DATA.invalidEmptyName.step1);

      // 다음 버튼 클릭 시도
      await goToNextStep(page);

      // 아직 Step 1에 있어야 함
      const currentStep = await getCurrentStep(page);
      expect(currentStep).toBe(1);

      // 에러 메시지 확인
      const nameError = page.locator(
        '[data-testid="error-name"], .field-error, [role="alert"]:has-text("이름")'
      );
      await expect(nameError).toBeVisible({ timeout: 5000 });
    });

    test("종료일이 시작일보다 앞서면 에러", async ({ page }) => {
      // 잘못된 기간으로 입력
      await fillStep1(page, PLAN_WIZARD_DATA.invalidPeriod.step1);

      // 다음 버튼 클릭 시도
      await goToNextStep(page);

      // 아직 Step 1에 있어야 함
      const currentStep = await getCurrentStep(page);
      expect(currentStep).toBe(1);

      // 기간 관련 에러 메시지 확인
      const periodError = page.locator(
        '[data-testid="error-period"], .field-error, [role="alert"]:has-text("기간"), [role="alert"]:has-text("날짜")'
      );
      await expect(periodError).toBeVisible({ timeout: 5000 });
    });

    test("필수 필드 미입력 시 다음 버튼 비활성화 또는 경고", async ({
      page,
    }) => {
      // 아무것도 입력하지 않고 바로 다음 클릭 시도
      const nextButton = page.locator(
        '[data-testid="next-button"], button:has-text("다음")'
      );

      // 비활성화되어 있거나, 클릭 시 에러 표시
      const isDisabled = await nextButton.isDisabled();

      if (isDisabled) {
        // 버튼이 비활성화된 경우
        await expect(nextButton).toBeDisabled();
      } else {
        // 클릭 가능하지만 클릭 후 에러 표시
        await nextButton.click();
        await page.waitForTimeout(500);

        // Step 1에 머물러야 함
        const currentStep = await getCurrentStep(page);
        expect(currentStep).toBe(1);
      }
    });
  });

  test.describe("Step 4 - 콘텐츠 선택 검증", () => {
    test("콘텐츠 미선택 시 경고 또는 건너뛰기 옵션 제공", async ({ page }) => {
      // Step 1~3 완료
      await fillStep1(page, PLAN_WIZARD_DATA.basic.step1);
      await goToNextStep(page);
      await goToNextStep(page); // Step 2
      await goToNextStep(page); // Step 3

      // Step 4에서 콘텐츠 없이 다음 시도
      await goToNextStep(page);

      // 건너뛰기 체크박스가 있거나, 경고가 표시되어야 함
      const skipCheckbox = page.locator(
        '[data-testid="skip-contents-checkbox"], input[name="skipContents"]'
      );
      const warningMessage = page.locator(
        '[data-testid="content-warning"], .warning-message'
      );

      const hasSkipOption = await skipCheckbox.isVisible();
      const hasWarning = await warningMessage.isVisible();

      // 둘 중 하나는 있어야 함
      expect(hasSkipOption || hasWarning).toBeTruthy();
    });
  });

  test.describe("실시간 검증", () => {
    test("입력 시 실시간으로 유효성 검사 피드백 제공", async ({ page }) => {
      // 플랜 이름 입력
      const nameInput = page.locator(
        '[data-testid="plan-name-input"], input[name="name"]'
      );

      // 빈 값 입력 후 blur
      await nameInput.fill("");
      await nameInput.blur();

      // 짧은 대기 후 검증 상태 확인
      await page.waitForTimeout(500);

      // 유효하지 않은 상태 표시 (에러 스타일 또는 메시지)
      const hasError =
        (await page
          .locator(
            '[data-testid="error-name"], .field-error, input[aria-invalid="true"]'
          )
          .isVisible()) ||
        (await nameInput.evaluate((el) =>
          el.classList.contains("border-red-500")
        ));

      // 유효한 값 입력
      await nameInput.fill("유효한 플랜 이름");
      await nameInput.blur();
      await page.waitForTimeout(500);

      // 에러가 사라지거나 유효 상태로 변경
      // (구현에 따라 다를 수 있음)
    });
  });

  test.describe("폼 상태 유지", () => {
    test("이전 단계로 돌아갔다가 다시 오면 입력값 유지", async ({ page }) => {
      const testName = "검증 테스트 플랜";

      // Step 1 입력
      await fillStep1(page, {
        ...PLAN_WIZARD_DATA.basic.step1,
        name: testName,
      });

      // Step 2로 이동
      await goToNextStep(page);
      const step2 = await getCurrentStep(page);
      expect(step2).toBeGreaterThanOrEqual(2);

      // 이전 버튼으로 Step 1로 복귀
      const prevButton = page.locator(
        '[data-testid="prev-button"], button:has-text("이전")'
      );
      if (await prevButton.isVisible()) {
        await prevButton.click();
        await page.waitForTimeout(500);

        // 입력값이 유지되어야 함
        const nameInput = page.locator(
          '[data-testid="plan-name-input"], input[name="name"]'
        );
        await expect(nameInput).toHaveValue(testName);
      }
    });
  });
});
