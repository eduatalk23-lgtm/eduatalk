/**
 * Admin Wizard E2E 테스트 - Happy Path
 *
 * 관리자가 7단계 위저드를 통해 플랜 그룹을 성공적으로 생성하는 시나리오
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  navigateToStudentPlans,
  clickCreatePlanButton,
  fillStep1,
  fillStep2,
  fillStep3,
  fillStep4,
  fillStep5,
  fillStep6,
  executeStep7,
  goToNextStep,
  expectSuccessMessage,
  expectToBeOnStep,
  getCurrentStep,
} from "../helpers/admin-wizard-helpers";
import {
  PLAN_WIZARD_DATA,
  TEST_STUDENTS,
  TIMEOUTS,
} from "../fixtures/test-data";

test.describe("Admin Wizard Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    // 관리자로 로그인
    await loginAsAdmin(page);
  });

  test("관리자가 7단계 위저드로 기본 플랜 그룹 생성", async ({ page }) => {
    // 1. 학생 플랜 관리 페이지 이동
    await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);

    // 2. 플랜 생성 버튼 클릭
    await clickCreatePlanButton(page);

    // 3. Step 1: 기본 정보 입력
    await fillStep1(page, PLAN_WIZARD_DATA.basic.step1);
    await goToNextStep(page);

    // Step 2로 이동 확인
    const step2 = await getCurrentStep(page);
    expect(step2).toBeGreaterThanOrEqual(2);

    // 4. Step 2: 시간 설정 (기본값)
    await fillStep2(page, PLAN_WIZARD_DATA.basic.step2);
    await goToNextStep(page);

    // 5. Step 3: 스케줄 미리보기
    await fillStep3(page);
    await goToNextStep(page);

    // 6. Step 4: 콘텐츠 선택 (건너뛰기)
    await fillStep4(page, PLAN_WIZARD_DATA.basic.step4);
    await goToNextStep(page);

    // 7. Step 5: 전략/취약 설정 (기본값)
    await fillStep5(page, PLAN_WIZARD_DATA.basic.step5);
    await goToNextStep(page);

    // 8. Step 6: 최종 검토
    await fillStep6(page);
    await goToNextStep(page);

    // 9. Step 7: 생성 실행
    await executeStep7(page);

    // 10. 성공 확인
    await expectSuccessMessage(page);
  });

  test("모의고사 목적 플랜 생성", async ({ page }) => {
    await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
    await clickCreatePlanButton(page);

    // Step 1: 모의고사 목적 선택
    await fillStep1(page, PLAN_WIZARD_DATA.mockExam.step1);
    await goToNextStep(page);

    // 나머지 단계는 기본값으로 진행
    await fillStep2(page);
    await goToNextStep(page);

    await fillStep3(page);
    await goToNextStep(page);

    await fillStep4(page, { skipContents: true });
    await goToNextStep(page);

    await fillStep5(page);
    await goToNextStep(page);

    await fillStep6(page);
    await goToNextStep(page);

    await executeStep7(page);

    await expectSuccessMessage(page);
  });

  test("장기 학습 플랜 생성 (90일)", async ({ page }) => {
    await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
    await clickCreatePlanButton(page);

    await fillStep1(page, PLAN_WIZARD_DATA.longTerm.step1);
    await goToNextStep(page);

    await fillStep2(page);
    await goToNextStep(page);

    await fillStep3(page);
    await goToNextStep(page);

    await fillStep4(page, { skipContents: true });
    await goToNextStep(page);

    await fillStep5(page);
    await goToNextStep(page);

    await fillStep6(page);
    await goToNextStep(page);

    await executeStep7(page);

    await expectSuccessMessage(page);
  });

  test("모든 스텝을 순차적으로 방문 확인", async ({ page }) => {
    await navigateToStudentPlans(page, TEST_STUDENTS.primaryStudentId);
    await clickCreatePlanButton(page);

    // Step 1
    await expectToBeOnStep(page, 1);
    await fillStep1(page, PLAN_WIZARD_DATA.basic.step1);
    await goToNextStep(page);

    // Step 2
    const step2 = await getCurrentStep(page);
    expect(step2).toBeGreaterThanOrEqual(2);
    await goToNextStep(page);

    // Step 3
    const step3 = await getCurrentStep(page);
    expect(step3).toBeGreaterThanOrEqual(3);
    await goToNextStep(page);

    // Step 4
    const step4 = await getCurrentStep(page);
    expect(step4).toBeGreaterThanOrEqual(4);
    await fillStep4(page, { skipContents: true });
    await goToNextStep(page);

    // Step 5
    const step5 = await getCurrentStep(page);
    expect(step5).toBeGreaterThanOrEqual(5);
    await goToNextStep(page);

    // Step 6
    const step6 = await getCurrentStep(page);
    expect(step6).toBeGreaterThanOrEqual(6);
    await goToNextStep(page);

    // Step 7
    const step7 = await getCurrentStep(page);
    expect(step7).toBeGreaterThanOrEqual(7);
  });
});
