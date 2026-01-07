/**
 * Admin Wizard E2E 테스트 헬퍼
 *
 * Admin Plan Creation Wizard 7단계 테스트를 위한 유틸리티
 */

import { type Page, expect } from "@playwright/test";

// ============================================
// 타입 정의
// ============================================

export interface Step1Data {
  name: string;
  planPurpose?: "내신대비" | "모의고사" | "자기주도";
  periodStart: string;
  periodEnd: string;
  blockSetId?: string;
}

export interface Step2Data {
  academySchedules?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface Step4Data {
  contentIds?: string[];
  skipContents?: boolean;
}

export interface Step5Data {
  strategySubjects?: string[];
  weakSubjects?: string[];
}

// ============================================
// 네비게이션 헬퍼
// ============================================

/**
 * 학생 플랜 관리 페이지로 이동
 */
export async function navigateToStudentPlans(
  page: Page,
  studentId: string
): Promise<void> {
  await page.goto(`/admin/students/${studentId}/plans`);
  await page.waitForLoadState("domcontentloaded");
  // 페이지 로딩 완료 대기 (networkidle 대신 요소 기반 대기)
  await page.waitForTimeout(2000);
}

/**
 * 플랜 생성 버튼 클릭
 */
export async function clickCreatePlanButton(page: Page): Promise<void> {
  // "플랜 그룹" 버튼을 찾아서 클릭 (UI 구조에 맞춤)
  const createButton = page.locator(
    '[data-testid="create-plan-button"], button:has-text("플랜 그룹")'
  );
  await createButton.click();
  await page.waitForTimeout(500);
}

/**
 * 현재 스텝 번호 확인
 */
export async function getCurrentStep(page: Page): Promise<number> {
  const stepIndicator = page.locator('[data-testid="step-indicator"]');
  if (await stepIndicator.isVisible()) {
    const text = await stepIndicator.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  // data-testid가 없는 경우 대체 방법
  for (let step = 7; step >= 1; step--) {
    const stepElement = page.locator(`[data-step="${step}"].active, .step-${step}.active`);
    if (await stepElement.isVisible()) {
      return step;
    }
  }

  return 1;
}

/**
 * 다음 스텝으로 이동
 */
export async function goToNextStep(page: Page): Promise<void> {
  const nextButton = page.locator(
    '[data-testid="next-button"], button:has-text("다음"), button:has-text("Next")'
  );
  await nextButton.click();
  await page.waitForTimeout(500);
}

/**
 * 이전 스텝으로 이동
 */
export async function goToPrevStep(page: Page): Promise<void> {
  const prevButton = page.locator(
    '[data-testid="prev-button"], button:has-text("이전"), button:has-text("Previous")'
  );
  await prevButton.click();
  await page.waitForTimeout(500);
}

// ============================================
// Step 입력 헬퍼
// ============================================

/**
 * Step 1: 기본 정보 입력
 */
export async function fillStep1(page: Page, data: Step1Data): Promise<void> {
  // 플랜 이름 입력
  const nameInput = page.locator(
    '[data-testid="plan-name-input"], input[name="name"], input[placeholder*="이름"]'
  );
  await nameInput.fill(data.name);

  // 목적 선택 (있는 경우)
  if (data.planPurpose) {
    const purposeSelector = page.locator(
      `[data-testid="plan-purpose-${data.planPurpose}"], button:has-text("${data.planPurpose}")`
    );
    if (await purposeSelector.isVisible()) {
      await purposeSelector.click();
    }
  }

  // 기간 시작일
  const startDateInput = page.locator(
    '[data-testid="period-start"], input[name="periodStart"], input[name="period_start"]'
  );
  await startDateInput.fill(data.periodStart);

  // 기간 종료일
  const endDateInput = page.locator(
    '[data-testid="period-end"], input[name="periodEnd"], input[name="period_end"]'
  );
  await endDateInput.fill(data.periodEnd);

  // 블록 세트 선택 (있는 경우)
  if (data.blockSetId) {
    const blockSetSelect = page.locator(
      '[data-testid="block-set-select"], select[name="blockSetId"]'
    );
    if (await blockSetSelect.isVisible()) {
      await blockSetSelect.selectOption(data.blockSetId);
    }
  }
}

/**
 * Step 2: 시간 설정 (기본값으로 진행)
 */
export async function fillStep2(
  page: Page,
  data: Step2Data = {}
): Promise<void> {
  // 학원 스케줄 추가 (있는 경우)
  if (data.academySchedules && data.academySchedules.length > 0) {
    for (const schedule of data.academySchedules) {
      const addButton = page.locator(
        '[data-testid="add-schedule-button"], button:has-text("일정 추가")'
      );
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(300);

        // 요일 선택
        const daySelect = page.locator('[data-testid="day-select"]:last-of-type');
        if (await daySelect.isVisible()) {
          await daySelect.selectOption(schedule.dayOfWeek.toString());
        }

        // 시작 시간
        const startTimeInput = page.locator('[data-testid="start-time"]:last-of-type');
        if (await startTimeInput.isVisible()) {
          await startTimeInput.fill(schedule.startTime);
        }

        // 종료 시간
        const endTimeInput = page.locator('[data-testid="end-time"]:last-of-type');
        if (await endTimeInput.isVisible()) {
          await endTimeInput.fill(schedule.endTime);
        }
      }
    }
  }

  // Step 2는 대부분 선택적 입력
}

/**
 * Step 3: 스케줄 미리보기 (자동 생성 확인)
 */
export async function fillStep3(page: Page): Promise<void> {
  // 스케줄 프리뷰가 로딩되었는지 확인
  const preview = page.locator(
    '[data-testid="schedule-preview"], .schedule-preview'
  );
  if (await preview.isVisible()) {
    // 프리뷰 로딩 완료 대기
    await page.waitForTimeout(1000);
  }
}

/**
 * Step 4: 콘텐츠 선택
 */
export async function fillStep4(
  page: Page,
  data: Step4Data = {}
): Promise<void> {
  if (data.skipContents) {
    // 콘텐츠 없이 진행
    const skipCheckbox = page.locator(
      '[data-testid="skip-contents-checkbox"], input[name="skipContents"]'
    );
    if (await skipCheckbox.isVisible()) {
      await skipCheckbox.check();
    }
    return;
  }

  // 콘텐츠 선택 (있는 경우)
  if (data.contentIds && data.contentIds.length > 0) {
    for (const contentId of data.contentIds) {
      const contentCheckbox = page.locator(
        `[data-testid="content-item-${contentId}"], input[value="${contentId}"]`
      );
      if (await contentCheckbox.isVisible()) {
        await contentCheckbox.check();
      }
    }
  }
}

/**
 * Step 5: 전략/취약 설정
 */
export async function fillStep5(
  page: Page,
  data: Step5Data = {}
): Promise<void> {
  // 전략 과목 선택
  if (data.strategySubjects) {
    for (const subject of data.strategySubjects) {
      const strategyButton = page.locator(
        `[data-testid="strategy-subject-${subject}"], button:has-text("${subject}")`
      );
      if (await strategyButton.isVisible()) {
        await strategyButton.click();
      }
    }
  }

  // 취약 과목 선택
  if (data.weakSubjects) {
    for (const subject of data.weakSubjects) {
      const weakButton = page.locator(
        `[data-testid="weak-subject-${subject}"], button:has-text("${subject}")`
      );
      if (await weakButton.isVisible()) {
        await weakButton.click();
      }
    }
  }
}

/**
 * Step 6: 최종 검토 (확인만)
 */
export async function fillStep6(page: Page): Promise<void> {
  // 최종 검토 화면 대기
  const reviewSection = page.locator(
    '[data-testid="final-review"], .final-review'
  );
  if (await reviewSection.isVisible()) {
    await page.waitForTimeout(500);
  }
}

/**
 * Step 7: 생성 실행
 */
export async function executeStep7(page: Page): Promise<void> {
  // 생성 버튼 클릭
  const submitButton = page.locator(
    '[data-testid="submit-button"], button:has-text("생성"), button:has-text("플랜 생성")'
  );
  await submitButton.click();

  // 생성 완료 대기 (최대 30초)
  await page.waitForTimeout(2000);
}

// ============================================
// 검증 헬퍼
// ============================================

/**
 * 성공 메시지 확인
 */
export async function expectSuccessMessage(page: Page): Promise<void> {
  const successMessage = page.locator(
    '[data-testid="success-message"], .toast-success, [role="alert"]:has-text("성공")'
  );
  await expect(successMessage).toBeVisible({ timeout: 10000 });
}

/**
 * 에러 메시지 확인
 */
export async function expectErrorMessage(
  page: Page,
  fieldName?: string
): Promise<void> {
  if (fieldName) {
    const fieldError = page.locator(
      `[data-testid="error-${fieldName}"], .error-${fieldName}`
    );
    await expect(fieldError).toBeVisible();
  } else {
    const anyError = page.locator(
      '[data-testid^="error-"], .field-error, [role="alert"]:has-text("오류")'
    );
    await expect(anyError).toBeVisible();
  }
}

/**
 * 특정 스텝에 있는지 확인
 */
export async function expectToBeOnStep(
  page: Page,
  stepNumber: number
): Promise<void> {
  const currentStep = await getCurrentStep(page);
  expect(currentStep).toBe(stepNumber);
}

/**
 * 다음 버튼이 비활성화되었는지 확인
 */
export async function expectNextButtonDisabled(page: Page): Promise<void> {
  const nextButton = page.locator(
    '[data-testid="next-button"], button:has-text("다음")'
  );
  await expect(nextButton).toBeDisabled();
}

/**
 * 위저드가 닫혔는지 확인
 */
export async function expectWizardClosed(page: Page): Promise<void> {
  const wizard = page.locator(
    '[data-testid="admin-wizard"], .admin-wizard-modal'
  );
  await expect(wizard).not.toBeVisible();
}

// ============================================
// 전체 플로우 헬퍼
// ============================================

/**
 * 전체 7단계 플랜 생성 (Happy Path)
 */
export async function createPlanFullFlow(
  page: Page,
  options: {
    step1: Step1Data;
    step2?: Step2Data;
    step4?: Step4Data;
    step5?: Step5Data;
  }
): Promise<void> {
  // Step 1
  await fillStep1(page, options.step1);
  await goToNextStep(page);

  // Step 2
  await fillStep2(page, options.step2 || {});
  await goToNextStep(page);

  // Step 3
  await fillStep3(page);
  await goToNextStep(page);

  // Step 4
  await fillStep4(page, options.step4 || {});
  await goToNextStep(page);

  // Step 5
  await fillStep5(page, options.step5 || {});
  await goToNextStep(page);

  // Step 6
  await fillStep6(page);
  await goToNextStep(page);

  // Step 7
  await executeStep7(page);
}

// ============================================
// 플래너 관련 헬퍼
// ============================================

export interface PlannerData {
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  studyHours?: { start: string; end: string };
  selfStudyHours?: { start: string; end: string };
  lunchTime?: { start: string; end: string };
}

/**
 * 플래너 생성 모달 열기
 */
export async function openCreatePlannerModal(page: Page): Promise<void> {
  const createButton = page.locator(
    'button:has-text("새 플래너"), [data-testid="create-planner-button"]'
  );
  await createButton.click();
  await page.waitForTimeout(500);
}

/**
 * 플래너 생성 폼 입력
 */
export async function fillPlannerForm(
  page: Page,
  data: PlannerData
): Promise<void> {
  // 이름
  const nameInput = page.locator(
    'input[placeholder*="겨울방학"], input[type="text"]'
  ).first();
  await nameInput.fill(data.name);

  // 설명
  if (data.description) {
    const descInput = page.locator('textarea').first();
    if (await descInput.isVisible()) {
      await descInput.fill(data.description);
    }
  }

  // 기간
  const periodStartInput = page.locator('input[type="date"]').first();
  const periodEndInput = page.locator('input[type="date"]').nth(1);
  await periodStartInput.fill(data.periodStart);
  await periodEndInput.fill(data.periodEnd);

  // 학습 시간
  if (data.studyHours) {
    const studyStartInput = page.locator('input[type="time"]').first();
    const studyEndInput = page.locator('input[type="time"]').nth(1);
    await studyStartInput.fill(data.studyHours.start);
    await studyEndInput.fill(data.studyHours.end);
  }

  // 점심 시간
  if (data.lunchTime) {
    const lunchStartInput = page.locator('input[type="time"]').nth(2);
    const lunchEndInput = page.locator('input[type="time"]').nth(3);
    await lunchStartInput.fill(data.lunchTime.start);
    await lunchEndInput.fill(data.lunchTime.end);
  }
}

/**
 * 플래너 생성 제출
 */
export async function submitPlannerForm(page: Page): Promise<void> {
  const submitButton = page.locator(
    'button:has-text("플래너 생성"), button:has-text("생성")'
  ).last();
  await submitButton.click();
  await page.waitForTimeout(1000);
}

/**
 * 플래너 선택 (Step1에서)
 */
export async function selectPlanner(
  page: Page,
  plannerIndex: number = 0
): Promise<void> {
  const plannerSelect = page.locator(
    '[data-testid="planner-select"], button:has-text("플래너 선택")'
  );

  if (await plannerSelect.isVisible()) {
    await plannerSelect.click();
    await page.waitForTimeout(300);

    const plannerOption = page.locator(
      '.absolute button, [role="option"]'
    ).nth(plannerIndex);

    if (await plannerOption.isVisible()) {
      await plannerOption.click();
      await page.waitForTimeout(500);
    }
  }
}

/**
 * 플래너 선택 해제 (Step1에서)
 */
export async function clearPlannerSelection(page: Page): Promise<void> {
  const plannerSelect = page.locator(
    '[data-testid="planner-select"], button:has-text("플래너")'
  );

  if (await plannerSelect.isVisible()) {
    await plannerSelect.click();
    await page.waitForTimeout(300);

    const clearOption = page.locator(
      'button:has-text("선택 안함"), button:has-text("없음")'
    );

    if (await clearOption.isVisible()) {
      await clearOption.click();
      await page.waitForTimeout(500);
    }
  }
}

/**
 * 플래너가 선택되었는지 확인
 */
export async function expectPlannerSelected(page: Page): Promise<void> {
  const plannerSelect = page.locator(
    '[data-testid="planner-select"], button:has-text("플래너")'
  );
  const selectText = await plannerSelect.textContent();
  expect(selectText).not.toContain("선택");
}

/**
 * 상속된 설정이 잠금 표시되었는지 확인
 */
export async function expectLockedInheritedSettings(page: Page): Promise<void> {
  const lockedIndicator = page.locator(
    '[data-locked="true"], .locked-item, svg[data-lucide="lock"]'
  );
  await expect(lockedIndicator.first()).toBeVisible({ timeout: 5000 });
}
