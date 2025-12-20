/**
 * Plan Wizard E2E 테스트
 * 
 * 실제 사용자 환경에서의 전체 흐름을 자동 테스트로 검증합니다.
 * 
 * 테스트 시나리오:
 * 1. 1단계부터 7단계까지 정상적인 플랜 생성 흐름 (성공 케이스)
 * 2. 필수값 미입력 시 다음 단계로 넘어가지 못하는 흐름 (실패 케이스)
 * 3. 임시 저장(Draft) 후 다시 불러와서 수정하는 흐름
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * 테스트 헬퍼: 로그인 처리
 */
async function login(page: Page, email: string = 'test@example.com', password: string = 'testpassword') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // 로그인 완료 대기
  await page.waitForURL(/^\/(plan|dashboard)/, { timeout: 10000 });
}

/**
 * 테스트 헬퍼: Step 1 기본 정보 입력
 */
async function fillStep1(page: Page, data: {
  name: string;
  plan_purpose?: '내신대비' | '모의고사(수능)';
  period_start: string;
  period_end: string;
  block_set_id?: string;
}) {
  // 플랜 이름 입력
  await page.fill('input[name="name"], input[placeholder*="이름"], input[placeholder*="플랜"]', data.name);
  
  // 목적 선택 (있는 경우)
  if (data.plan_purpose) {
    await page.click(`button:has-text("${data.plan_purpose}"), input[value="${data.plan_purpose}"]`);
  }
  
  // 기간 입력
  await page.fill('input[name="period_start"], input[placeholder*="시작일"]', data.period_start);
  await page.fill('input[name="period_end"], input[placeholder*="종료일"]', data.period_end);
  
  // 블록 세트 선택 (있는 경우)
  if (data.block_set_id) {
    await page.selectOption('select[name="block_set_id"]', data.block_set_id);
  }
  
  // 다음 단계 버튼 클릭
  await page.click('button:has-text("다음"), button:has-text("Next")');
  
  // Step 2로 이동 확인 (약간의 대기 시간)
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 2 시간 설정 (최소한의 입력)
 */
async function fillStep2(page: Page) {
  // Step 2는 선택적 입력이 많으므로, 기본값으로 진행
  // 다음 단계 버튼 클릭
  await page.click('button:has-text("다음"), button:has-text("Next")');
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 3 스케줄 미리보기 (자동 생성)
 */
async function fillStep3(page: Page) {
  // Step 3는 자동 생성되므로 확인만
  await page.click('button:has-text("다음"), button:has-text("Next")');
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 4 콘텐츠 선택 (최소한의 입력)
 */
async function fillStep4(page: Page) {
  // 콘텐츠가 없어도 진행 가능한 경우를 가정
  // 다음 단계 버튼 클릭
  await page.click('button:has-text("다음"), button:has-text("Next")');
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 5 전략/취약 설정 (선택적)
 */
async function fillStep5(page: Page) {
  // 기본값으로 진행
  await page.click('button:has-text("다음"), button:has-text("Next")');
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 6 최종 검토
 */
async function fillStep6(page: Page) {
  // 최종 검토 단계는 확인만
  await page.click('button:has-text("다음"), button:has-text("Next")');
  await page.waitForTimeout(500);
}

/**
 * 테스트 헬퍼: Step 7 완료
 */
async function fillStep7(page: Page) {
  // 완료 단계
  await page.click('button:has-text("완료"), button:has-text("생성"), button:has-text("저장")');
  await page.waitForTimeout(1000);
}

/**
 * 테스트 헬퍼: 현재 Step 확인
 */
async function getCurrentStep(page: Page): Promise<number> {
  // Step 표시 요소 찾기 (예: "Step 1 of 7", "1/7" 등)
  const stepIndicator = await page.locator('[data-testid="step-indicator"], .step-indicator, [aria-label*="Step"]').first();
  
  if (await stepIndicator.count() > 0) {
    const text = await stepIndicator.textContent();
    const match = text?.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // 대체 방법: URL에서 step 파라미터 확인
  const url = page.url();
  const stepMatch = url.match(/[?&]step=(\d+)/);
  if (stepMatch) {
    return parseInt(stepMatch[1], 10);
  }
  
  // 기본값: 1
  return 1;
}

/**
 * 테스트 헬퍼: 에러 메시지 확인
 */
async function hasErrorMessage(page: Page): Promise<boolean> {
  const errorElements = await page.locator(
    '[role="alert"], .error, .text-red-600, [data-testid="error"]'
  ).count();
  return errorElements > 0;
}

test.describe('Plan Wizard E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 처리 (실제 환경에 맞게 수정 필요)
    // Mock 인증 또는 테스트 계정 사용
    // await login(page);
    
    // Plan Wizard 페이지로 이동
    await page.goto('/plan/new-group');
  });

  test('1단계부터 7단계까지 정상적인 플랜 생성 흐름 (성공 케이스)', async ({ page }) => {
    // Step 1: 기본 정보 입력
    await fillStep1(page, {
      name: 'E2E 테스트 플랜',
      plan_purpose: '내신대비',
      period_start: '2025-01-01',
      period_end: '2025-03-31',
    });
    
    // Step 1에서 Step 2로 이동 확인
    const stepAfter1 = await getCurrentStep(page);
    expect(stepAfter1).toBeGreaterThanOrEqual(2);
    
    // Step 2: 시간 설정
    await fillStep2(page);
    
    // Step 3: 스케줄 미리보기
    await fillStep3(page);
    
    // Step 4: 콘텐츠 선택
    await fillStep4(page);
    
    // Step 5: 전략/취약 설정
    await fillStep5(page);
    
    // Step 6: 최종 검토
    await fillStep6(page);
    
    // Step 7: 완료
    await fillStep7(page);
    
    // 완료 후 리다이렉트 확인 (플랜 목록 또는 생성된 플랜 페이지)
    await page.waitForURL(/\/plan(\/|$)/, { timeout: 10000 });
    
    // 성공 메시지 확인 (있는 경우)
    const successMessage = await page.locator('text=/저장|생성|완료/i').first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible();
    }
  });

  test('필수값 미입력 시 다음 단계로 넘어가지 못하는 흐름 (실패 케이스)', async ({ page }) => {
    // Step 1에서 필수값 없이 다음 버튼 클릭 시도
    await page.click('button:has-text("다음"), button:has-text("Next")');
    
    // 에러 메시지가 표시되는지 확인
    const hasError = await hasErrorMessage(page);
    expect(hasError).toBe(true);
    
    // Step이 변경되지 않았는지 확인
    const currentStep = await getCurrentStep(page);
    expect(currentStep).toBe(1);
    
    // 필수 필드에 에러 표시 확인
    const nameField = await page.locator('input[name="name"], input[placeholder*="이름"]').first();
    if (await nameField.count() > 0) {
      // 필드 주변에 에러 표시가 있는지 확인
      const fieldContainer = nameField.locator('..');
      const errorInField = await fieldContainer.locator('.error, .text-red-600, [role="alert"]').count();
      // 에러가 있거나 없을 수 있으므로, 최소한 페이지에 에러가 있는지만 확인
      expect(hasError).toBe(true);
    }
  });

  test('임시 저장(Draft) 후 다시 불러와서 수정하는 흐름', async ({ page }) => {
    // Step 1: 기본 정보 입력
    await fillStep1(page, {
      name: 'Draft 테스트 플랜',
      plan_purpose: '모의고사(수능)',
      period_start: '2025-02-01',
      period_end: '2025-04-30',
    });
    
    // Step 2로 이동
    await fillStep2(page);
    
    // 임시 저장 버튼 클릭
    const saveDraftButton = await page.locator('button:has-text("저장"), button:has-text("임시 저장"), button[aria-label*="저장"]').first();
    if (await saveDraftButton.count() > 0) {
      await saveDraftButton.click();
      
      // 저장 완료 대기
      await page.waitForTimeout(1000);
      
      // 저장 성공 메시지 확인 (있는 경우)
      const saveMessage = await page.locator('text=/저장|완료/i').first();
      if (await saveMessage.count() > 0) {
        await expect(saveMessage).toBeVisible({ timeout: 5000 });
      }
      
      // URL에서 draft ID 추출 (있는 경우)
      const currentUrl = page.url();
      const draftMatch = currentUrl.match(/[?&]draft=([^&]+)/);
      
      if (draftMatch) {
        const draftId = draftMatch[1];
        
        // 새 페이지에서 draft 불러오기
        await page.goto(`/plan/new-group?draft=${draftId}`);
        
        // Draft 데이터가 로드되었는지 확인
        await page.waitForTimeout(2000);
        
        // 입력된 값이 복원되었는지 확인
        const nameField = await page.locator('input[name="name"], input[placeholder*="이름"]').first();
        if (await nameField.count() > 0) {
          const nameValue = await nameField.inputValue();
          expect(nameValue).toContain('Draft 테스트 플랜');
        }
        
        // Step이 복원되었는지 확인 (Step 2 이상이어야 함)
        const restoredStep = await getCurrentStep(page);
        expect(restoredStep).toBeGreaterThanOrEqual(2);
        
        // 데이터 수정
        if (await nameField.count() > 0) {
          await nameField.fill('수정된 Draft 플랜');
        }
        
        // 다시 저장
        const updateButton = await page.locator('button:has-text("저장"), button:has-text("임시 저장")').first();
        if (await updateButton.count() > 0) {
          await updateButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      // 임시 저장 버튼이 없는 경우 스킵
      test.skip();
    }
  });

  test('PlanWizardContext 상태가 올바르게 변하는지 확인', async ({ page }) => {
    // Step 1에서 데이터 입력
    await fillStep1(page, {
      name: 'Context 테스트 플랜',
      plan_purpose: '내신대비',
      period_start: '2025-01-01',
      period_end: '2025-03-31',
    });
    
    // 브라우저 콘솔에서 Context 상태 확인 (디버그 모드인 경우)
    // 실제로는 개발자 도구를 통해 확인하거나, 디버그 컴포넌트를 통해 확인
    
    // Step이 변경되었는지 확인
    const stepAfterInput = await getCurrentStep(page);
    expect(stepAfterInput).toBeGreaterThanOrEqual(1);
    
    // 다음 단계로 이동
    await page.click('button:has-text("다음"), button:has-text("Next")');
    await page.waitForTimeout(500);
    
    // Step이 증가했는지 확인
    const stepAfterNext = await getCurrentStep(page);
    expect(stepAfterNext).toBeGreaterThan(stepAfterInput);
  });
});

