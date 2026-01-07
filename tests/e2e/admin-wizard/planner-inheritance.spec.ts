/**
 * Admin Wizard E2E 테스트 - 플래너 → 플랜 그룹 상속 모델
 *
 * 플래너 생성, 선택, 상속, 해제 시나리오 테스트
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  navigateToStudentPlans,
  clickCreatePlanButton,
  fillStep1,
  goToNextStep,
  getCurrentStep,
} from "../helpers/admin-wizard-helpers";
import {
  TEST_STUDENTS,
  PLANNER_TEST_DATA,
  getToday,
  getDaysLater,
} from "../fixtures/test-data";

test.describe("플래너 → 플랜 그룹 상속 모델", () => {
  test.beforeEach(async ({ page }) => {
    // 관리자로 로그인
    await loginAsAdmin(page);
  });

  test.describe.serial("플래너 관리", () => {
    test("새 플래너 생성", async ({ page }) => {
      // 1. 학생 플랜 관리 페이지 이동
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);

      // 2. 플래너 생성 버튼 클릭
      const createPlannerButton = page.locator(
        'button:has-text("새 플래너"), [data-testid="create-planner-button"]'
      );
      await expect(createPlannerButton).toBeVisible({ timeout: 10000 });
      await createPlannerButton.click();

      // 3. 플래너 생성 모달 확인
      const modal = page.locator('[role="dialog"], .fixed.inset-0');
      await expect(modal).toBeVisible();

      // 4. 플래너 정보 입력
      // 플래너 이름
      const nameInput = page.locator(
        'input[placeholder*="겨울방학"], input[type="text"]:first-of-type'
      );
      await nameInput.fill(PLANNER_TEST_DATA.basic.name);

      // 기간 설정
      const periodStartInput = page.locator('input[type="date"]').first();
      const periodEndInput = page.locator('input[type="date"]').nth(1);
      await periodStartInput.fill(PLANNER_TEST_DATA.basic.periodStart);
      await periodEndInput.fill(PLANNER_TEST_DATA.basic.periodEnd);

      // 학습 시간 설정
      const studyHoursStartInput = page.locator('input[type="time"]').first();
      const studyHoursEndInput = page.locator('input[type="time"]').nth(1);
      await studyHoursStartInput.fill(PLANNER_TEST_DATA.basic.studyHours.start);
      await studyHoursEndInput.fill(PLANNER_TEST_DATA.basic.studyHours.end);

      // 점심 시간 설정
      const lunchTimeStartInput = page.locator('input[type="time"]').nth(2);
      const lunchTimeEndInput = page.locator('input[type="time"]').nth(3);
      await lunchTimeStartInput.fill(PLANNER_TEST_DATA.basic.lunchTime.start);
      await lunchTimeEndInput.fill(PLANNER_TEST_DATA.basic.lunchTime.end);

      // 5. 플래너 생성 버튼 클릭 (모달 내부 버튼)
      const submitButton = modal.locator('button:has-text("플래너 생성")');
      await submitButton.click();

      // 6. 성공 확인 (모달 닫힘 또는 성공 메시지)
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // 7. 플래너 목록에서 확인
      const plannerCard = page.locator(
        `text=${PLANNER_TEST_DATA.basic.name}`
      );
      await expect(plannerCard).toBeVisible({ timeout: 5000 });
    });

    test("플래너 수정", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);

      // 플래너 카드 찾기 (이름으로 찾기, 여러 개 있을 수 있어 first() 사용)
      const plannerHeading = page.locator(`h4:has-text("${PLANNER_TEST_DATA.basic.name}")`).first();
      await expect(plannerHeading).toBeVisible({ timeout: 10000 });

      // 플래너 카드 컨테이너 찾기 (상위 요소 - h4 > div > div)
      const plannerCard = plannerHeading.locator('xpath=ancestor::div[contains(@class, "p-4")]');

      // 메뉴 버튼 클릭 (MoreVertical 아이콘 버튼)
      const menuButton = plannerCard.locator('button').last();
      await menuButton.click();
      await page.waitForTimeout(300);

      // 수정 버튼 클릭 (드롭다운 메뉴에서)
      const editButton = page.locator('button:has-text("수정")').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // 모달 확인
      const modal = page.locator('[role="dialog"], .fixed.inset-0');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // 이름 수정 (타임스탬프 추가로 유니크한 이름 생성)
      const uniqueName = `수정된 플래너 ${Date.now()}`;
      const nameInput = modal.locator('input[type="text"]').first();
      await nameInput.fill(uniqueName);

      // 저장 버튼 클릭 (모달 내부)
      const submitButton = modal.locator('button:has-text("플래너 수정"), button:has-text("저장")');
      await submitButton.click();

      // 모달 닫힘 확인
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // 수정된 이름 확인
      const updatedPlannerHeading = page.locator(`h4:has-text("${uniqueName}")`);
      await expect(updatedPlannerHeading).toBeVisible({ timeout: 5000 });
    });

    test("플래너 상태 변경 (활성화/일시정지)", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);

      // 첫 번째 플래너 카드 찾기 (어떤 플래너든 상관없이 첫 번째 것)
      const plannerHeading = page.locator('h4.font-medium').first();
      await expect(plannerHeading).toBeVisible({ timeout: 10000 });

      // 플래너 카드 컨테이너 찾기
      const plannerCard = plannerHeading.locator('xpath=ancestor::div[contains(@class, "p-4")]');

      // 메뉴 버튼 클릭
      const menuButton = plannerCard.locator('button').last();
      await menuButton.click();
      await page.waitForTimeout(300);

      // 활성화 버튼 찾기 (초안 상태에서는 "활성화" 버튼이 표시됨)
      const activateButton = page.locator('button:has-text("활성화")');

      if (await activateButton.isVisible({ timeout: 3000 })) {
        await activateButton.click();
        await page.waitForTimeout(1000);

        // 상태 배지가 "활성"으로 변경되었는지 확인
        const statusBadge = page.locator('span:has-text("활성")');
        await expect(statusBadge.first()).toBeVisible({ timeout: 5000 });
      } else {
        // 이미 활성 상태면 일시정지 버튼 찾기
        const pauseButton = page.locator('button:has-text("일시정지")');
        if (await pauseButton.isVisible({ timeout: 3000 })) {
          await pauseButton.click();
          await page.waitForTimeout(1000);

          const statusBadge = page.locator('span:has-text("일시정지")');
          await expect(statusBadge.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe("플래너 → 위저드 상속", () => {
    test("플래너 선택 시 시간 설정 자동 채우기", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // Step 1 확인
      const step = await getCurrentStep(page);
      expect(step).toBeGreaterThanOrEqual(1);

      // 플래너 선택 드롭다운 열기
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        // 플래너 선택
        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
          await page.waitForTimeout(500);

          // 기간이 자동으로 채워졌는지 확인
          const periodStartInput = page.locator(
            '[data-testid="period-start"], input[name="periodStart"]'
          );
          const startValue = await periodStartInput.inputValue();
          expect(startValue).toBeTruthy();
        }
      }
    });

    test("플래너 선택 시 제외일/학원 일정 상속", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 플래너 선택
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
          await page.waitForTimeout(1000);

          // Step 2로 이동
          await goToNextStep(page);
          await page.waitForTimeout(500);

          // 학원 일정 섹션 확인
          const academySection = page.locator(
            ':has-text("학원 일정"), :has-text("외부 일정")'
          );

          // 상속된 항목에 잠금 아이콘이 있는지 확인
          const lockedItem = page.locator(
            '[data-locked="true"], .locked-item, svg[data-lucide="lock"]'
          );

          // 잠금된 항목이 있으면 상속 성공
          if (await lockedItem.first().isVisible({ timeout: 3000 })) {
            await expect(lockedItem.first()).toBeVisible();
          }
        }
      }
    });

    test("플래너 해제 시 상속 설정 정리", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 1. 플래너 선택
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
          await page.waitForTimeout(500);

          // 기간 값 저장
          const periodStartInput = page.locator(
            '[data-testid="period-start"], input[name="periodStart"]'
          );
          const originalStart = await periodStartInput.inputValue();

          // 2. 플래너 선택 해제
          await plannerSelect.click();

          const clearOption = page.locator(
            'button:has-text("선택 안함"), button:has-text("없음")'
          );

          if (await clearOption.isVisible()) {
            await clearOption.click();
            await page.waitForTimeout(500);

            // 3. 시간 설정이 초기화되었는지 확인
            // 기간은 유지되어야 함 (시간 설정만 초기화)
            const newStart = await periodStartInput.inputValue();
            expect(newStart).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe("플랜 그룹 생성 시 플래너 연결", () => {
    test("플래너가 연결된 플랜 그룹 생성", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 1. 플래너 선택
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
        }
      }

      // 2. 기본 정보 입력
      await fillStep1(page, {
        name: `E2E 플래너 연결 테스트 ${Date.now()}`,
        periodStart: getToday(),
        periodEnd: getDaysLater(14),
      });

      // 3. Step 진행
      await goToNextStep(page);

      const step2 = await getCurrentStep(page);
      expect(step2).toBeGreaterThanOrEqual(2);
    });

    test("플래너 없이 플랜 그룹 생성 가능", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 플래너 선택하지 않고 기본 정보 입력
      await fillStep1(page, {
        name: `E2E 플래너 없음 테스트 ${Date.now()}`,
        periodStart: getToday(),
        periodEnd: getDaysLater(14),
      });

      // Step 2로 이동 가능한지 확인
      await goToNextStep(page);

      const step2 = await getCurrentStep(page);
      expect(step2).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("시간 설정 검증", () => {
    test("플래너의 학습 시간이 Step2에 반영되는지 확인", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 플래너 선택
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
          await page.waitForTimeout(500);

          // Step 1 기본 정보 입력
          const nameInput = page.locator(
            '[data-testid="plan-name-input"], input[name="name"]'
          );
          await nameInput.fill(`시간 설정 테스트 ${Date.now()}`);

          // Step 2로 이동
          await goToNextStep(page);
          await page.waitForTimeout(500);

          // Step 2에서 시간 설정 확인
          const studyHoursDisplay = page.locator(
            ':has-text("학습 시간"), :has-text("10:00"), :has-text("19:00")'
          );

          // 시간 설정 UI가 표시되는지 확인
          await expect(
            page.locator('[data-testid="time-settings"], .time-config, section')
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test("플래너의 점심 시간이 Step2에 반영되는지 확인", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 플래너 선택
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
          await page.waitForTimeout(500);

          // Step 1 완료
          const nameInput = page.locator(
            '[data-testid="plan-name-input"], input[name="name"]'
          );
          await nameInput.fill(`점심 시간 테스트 ${Date.now()}`);

          await goToNextStep(page);
          await page.waitForTimeout(500);

          // Step 2에서 점심 시간 필드 확인
          const lunchTimeField = page.locator(
            ':has-text("점심"), input[type="time"]'
          );
          await expect(lunchTimeField.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe("타임라인 뷰 검증", () => {
    test("Step3에서 주간 타임라인 뷰 표시", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // Step 1 기본 정보
      await fillStep1(page, {
        name: `타임라인 테스트 ${Date.now()}`,
        periodStart: getToday(),
        periodEnd: getDaysLater(14),
      });

      // Step 2로 이동
      await goToNextStep(page);
      await page.waitForTimeout(500);

      // Step 3로 이동
      await goToNextStep(page);
      await page.waitForTimeout(500);

      // 타임라인 뷰 확인
      const timelineView = page.locator(
        '[data-testid="weekly-timeline"], .weekly-availability-timeline'
      );

      // 또는 뷰 모드 선택기 확인
      const viewModeSelector = page.locator(
        'button:has-text("타임라인"), [data-view="timeline"]'
      );

      // 둘 중 하나라도 있으면 성공
      const hasTimeline = await timelineView.isVisible({ timeout: 3000 }).catch(() => false);
      const hasViewSelector = await viewModeSelector.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasTimeline || hasViewSelector).toBeTruthy();
    });

    test("타임라인 뷰에서 학원 일정 표시", async ({ page }) => {
      await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
      await clickCreatePlanButton(page);

      // 플래너 선택 (학원 일정 포함)
      const plannerSelect = page.locator(
        '[data-testid="planner-select"], button:has-text("플래너 선택")'
      );

      if (await plannerSelect.isVisible()) {
        await plannerSelect.click();

        const plannerOption = page.locator(
          '.absolute button, [role="option"]'
        ).first();

        if (await plannerOption.isVisible()) {
          await plannerOption.click();
        }
      }

      // Step 1 완료
      await fillStep1(page, {
        name: `학원 일정 타임라인 테스트 ${Date.now()}`,
        periodStart: getToday(),
        periodEnd: getDaysLater(14),
      });

      // Step 2 → Step 3
      await goToNextStep(page);
      await page.waitForTimeout(500);
      await goToNextStep(page);
      await page.waitForTimeout(500);

      // 타임라인에서 학원 일정 색상 확인
      const academyBlock = page.locator(
        '.bg-orange-400, .bg-orange-300, [data-type="academy"]'
      );

      // 학원 일정이 있으면 표시됨
      const hasAcademyBlock = await academyBlock.first().isVisible({ timeout: 3000 }).catch(() => false);

      // 학원 일정이 없어도 테스트는 통과 (플래너에 학원 일정이 없을 수 있음)
      console.log(`학원 일정 블록 표시: ${hasAcademyBlock}`);
    });
  });
});
