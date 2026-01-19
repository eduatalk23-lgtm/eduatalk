/**
 * AI 플랜 생성 E2E 테스트
 *
 * Unified Pipeline을 사용한 AI 기반 플랜 생성 기능을 테스트합니다.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("AI 플랜 생성 위저드", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("플랜 생성 페이지 접근", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 페이지 타이틀 확인
    await expect(page.locator("h1, h2, h3").filter({ hasText: "플랜" })).toBeVisible();
  });

  test("AI 플랜 모드 토글 UI 확인", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택 (첫 번째 학생)
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();
      await page.waitForLoadState("networkidle");

      // AI 플랜 생성 토글 확인
      const aiToggle = page.locator('text="AI 플랜 생성"');
      await expect(aiToggle).toBeVisible();

      // 토글 활성화
      const checkbox = page.locator('input[type="checkbox"]').filter({
        has: page.locator('text="AI 플랜 생성"'),
      });

      // 체크박스가 보이지 않으면 레이블로 찾기
      const aiLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiLabel.isVisible()) {
        await aiLabel.click();
      }
    }
  });

  test("AI 플랜 설정 옵션 표시", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();
      await page.waitForLoadState("networkidle");

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500); // 상태 변경 대기

        // AI 설정 옵션들이 표시되는지 확인
        await expect(page.locator('text="학습 목적"')).toBeVisible();
        await expect(page.locator('text="교과"')).toBeVisible();
        await expect(page.locator('text="난이도"')).toBeVisible();
        await expect(page.locator('text="학생 수준"')).toBeVisible();
        await expect(page.locator('text="학습일"')).toBeVisible();
        await expect(page.locator('text="복습일"')).toBeVisible();
      }
    }
  });

  test("AI 플랜 학습 목적 선택", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 학습 목적 버튼들 확인
        const purposes = ["내신대비", "모의고사", "수능", "기타"];
        for (const purpose of purposes) {
          const purposeButton = page.locator(`button:has-text("${purpose}")`);
          await expect(purposeButton).toBeVisible();
        }

        // 모의고사 선택
        await page.locator('button:has-text("모의고사")').click();

        // 선택된 상태 확인 (indigo 색상 클래스)
        const selectedButton = page.locator('button:has-text("모의고사")');
        await expect(selectedButton).toHaveClass(/indigo/);
      }
    }
  });

  test("AI 플랜 교과 선택", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 교과 드롭다운 확인
        const subjectSelect = page.locator("select").filter({
          has: page.locator("option:has-text('수학')"),
        });

        if (await subjectSelect.isVisible()) {
          await expect(subjectSelect).toBeVisible();

          // 영어 선택
          await subjectSelect.selectOption("영어");

          // 선택 확인
          await expect(subjectSelect).toHaveValue("영어");
        }
      }
    }
  });

  test("AI 플랜 난이도 선택", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 난이도 버튼들 확인
        const difficulties = ["개념", "기본", "심화"];
        for (const diff of difficulties) {
          const diffButton = page.locator(`button:has-text("${diff}")`);
          await expect(diffButton).toBeVisible();
        }

        // 심화 선택
        await page.locator('button:has-text("심화")').click();
        await expect(page.locator('button:has-text("심화")')).toHaveClass(/indigo/);
      }
    }
  });

  test("AI 플랜 학생 수준 선택", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 학생 수준 버튼들 확인
        const levels = ["상", "중", "하"];
        for (const level of levels) {
          const levelButton = page.locator(`button:has-text("${level}")`).filter({
            has: page.locator(`:not(:has-text("심화"))`), // 난이도와 구분
          });
          // 버튼이 여러 개일 수 있으므로 첫 번째만 확인
          if ((await levelButton.count()) > 0) {
            await expect(levelButton.first()).toBeVisible();
          }
        }
      }
    }
  });

  test("AI 플랜 학습/복습일 설정", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 학습일 입력 확인
        const studyDaysInput = page.locator('input[type="number"]').first();
        if (await studyDaysInput.isVisible()) {
          await studyDaysInput.fill("5");
          await expect(studyDaysInput).toHaveValue("5");
        }

        // 복습일 입력 확인
        const reviewDaysInput = page.locator('input[type="number"]').nth(1);
        if (await reviewDaysInput.isVisible()) {
          await reviewDaysInput.fill("2");
          await expect(reviewDaysInput).toHaveValue("2");
        }

        // 학습 사이클 안내 메시지 확인
        await expect(page.locator('text="5일 학습 + 2일 복습"')).toBeVisible();
      }
    }
  });

  test("AI 플랜 확인 단계에서 설정 요약 표시", async ({ page }) => {
    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    if (await studentCheckbox.isVisible()) {
      await studentCheckbox.check();
    }

    // 플랜 그룹 위저드로 이동
    const planGroupButton = page.locator('button:has-text("플랜 그룹")');
    if (await planGroupButton.isVisible()) {
      await planGroupButton.click();

      // AI 플랜 모드 활성화
      const aiToggleLabel = page.locator('label:has-text("AI 플랜 생성")');
      if (await aiToggleLabel.isVisible()) {
        await aiToggleLabel.click();
        await page.waitForTimeout(500);

        // 플랜 이름 입력
        const nameInput = page.locator('input[type="text"]').first();
        await nameInput.fill("E2E 테스트 AI 플랜");

        // 다음 버튼 클릭
        const nextButton = page.locator('button:has-text("다음")');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForTimeout(500);

          // 확인 단계에서 AI 플랜 설정 요약 확인
          await expect(page.locator('text="AI 플랜 생성"')).toBeVisible();
          await expect(page.locator('text="학습 목적"')).toBeVisible();
          await expect(page.locator('text="교과/과목"')).toBeVisible();
          await expect(page.locator('text="학습 사이클"')).toBeVisible();
        }
      }
    }
  });

  test.skip("AI 플랜 생성 실행 (실제 API 호출)", async ({ page }) => {
    // 이 테스트는 실제 API를 호출하므로 CI에서는 스킵
    // 로컬 테스트에서만 수동으로 실행

    await page.goto("/admin/plan-creation");
    await page.waitForLoadState("networkidle");

    // 학생 선택
    const studentCheckbox = page.locator('input[type="checkbox"]').first();
    await studentCheckbox.check();

    // 플랜 그룹 위저드로 이동
    await page.locator('button:has-text("플랜 그룹")').click();

    // AI 플랜 모드 활성화
    await page.locator('label:has-text("AI 플랜 생성")').click();
    await page.waitForTimeout(500);

    // 설정 입력
    await page.locator('input[type="text"]').first().fill("E2E 테스트 플랜");

    // 다음 버튼 클릭
    await page.locator('button:has-text("다음")').click();
    await page.waitForTimeout(500);

    // 생성 시작 버튼 클릭
    await page.locator('button:has-text("생성 시작")').click();

    // 진행 상황 표시 확인
    await expect(page.locator('text="처리 중"')).toBeVisible({ timeout: 5000 });

    // 완료 대기 (최대 60초)
    await expect(page.locator('text="완료"')).toBeVisible({ timeout: 60000 });
  });
});

test.describe("AI 플랜 생성 API", () => {
  test("Generate API 엔드포인트 존재 확인", async ({ request }) => {
    // POST 요청 테스트 (인증 없이)
    const response = await request.post("/api/plan/generate", {
      data: {},
    });

    // 인증 없이 호출하면 401 반환
    expect([401, 302, 307]).toContain(response.status());
  });

  test("Preview API 엔드포인트 존재 확인", async ({ request }) => {
    // POST 요청 테스트 (인증 없이)
    const response = await request.post("/api/plan/generate/preview", {
      data: {},
    });

    // 인증 없이 호출하면 401 반환
    expect([401, 302, 307]).toContain(response.status());
  });
});
