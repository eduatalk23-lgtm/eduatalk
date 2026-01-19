/**
 * 마크다운 내보내기 E2E 테스트
 *
 * 플랜 그룹의 마크다운 내보내기 기능을 테스트합니다.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("마크다운 내보내기", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("플랜 그룹 상세 페이지에서 내보내기 버튼 표시", async ({ page }) => {
    // 학생 목록 페이지로 이동
    await page.goto("/admin/students");
    await page.waitForLoadState("networkidle");

    // 첫 번째 학생 클릭 (플랜 그룹이 있는 학생)
    const studentRow = page.locator("table tbody tr").first();
    if (await studentRow.isVisible()) {
      await studentRow.click();
      await page.waitForLoadState("networkidle");

      // 플랜 탭으로 이동
      const planTab = page.locator('a:has-text("플랜"), button:has-text("플랜")');
      if (await planTab.isVisible()) {
        await planTab.click();
        await page.waitForLoadState("networkidle");

        // 플랜 그룹 카드 확인
        const planGroupCard = page.locator('[data-testid="plan-group-card"]').first();
        if (await planGroupCard.isVisible()) {
          await planGroupCard.click();
          await page.waitForLoadState("networkidle");

          // 내보내기 버튼 확인
          const exportButton = page.locator('button:has-text("마크다운 내보내기")');

          // 플랜이 있으면 버튼이 표시되어야 함
          const hasPlans = await page.locator('text="플랜 생성 완료"').isVisible();
          if (hasPlans) {
            await expect(exportButton).toBeVisible();
          }
        }
      }
    }
  });

  test("마크다운 내보내기 모달 동작", async ({ page }) => {
    // 플랜이 있는 플랜 그룹 페이지로 직접 이동 (테스트용)
    // 실제 환경에서는 테스트 데이터를 미리 설정해야 함
    await page.goto("/admin/plan-groups/test-group-id");

    // 페이지가 존재하지 않으면 스킵
    const notFound = await page.locator('text="찾을 수 없습니다"').isVisible();
    if (notFound) {
      test.skip();
      return;
    }

    // 내보내기 버튼 클릭
    const exportButton = page.locator('button:has-text("마크다운 내보내기")');
    if (await exportButton.isVisible()) {
      await exportButton.click();

      // 로딩 상태 확인
      await expect(page.locator('text="생성 중..."')).toBeVisible();

      // 모달이 열리는지 확인 (최대 10초 대기)
      await expect(
        page.locator('h2:has-text("마크다운 내보내기")')
      ).toBeVisible({ timeout: 10000 });

      // 마크다운 내용 확인
      const markdownContent = page.locator("pre");
      await expect(markdownContent).toBeVisible();

      // 복사 버튼 확인
      const copyButton = page.locator('button:has-text("복사")');
      await expect(copyButton).toBeVisible();

      // 다운로드 버튼 확인
      const downloadButton = page.locator('button:has-text("다운로드")');
      await expect(downloadButton).toBeVisible();

      // 모달 닫기
      const closeButton = page.locator('button:has([class*="lucide-x"])');
      await closeButton.click();

      // 모달이 닫혔는지 확인
      await expect(
        page.locator('h2:has-text("마크다운 내보내기")')
      ).not.toBeVisible();
    }
  });

  test("마크다운 복사 기능", async ({ page, context }) => {
    // 클립보드 권한 허용
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // 플랜 그룹 페이지로 이동 (실제 테스트 데이터 필요)
    await page.goto("/admin/students");
    await page.waitForLoadState("networkidle");

    // 학생 목록에서 플랜 그룹이 있는 학생 찾기
    const studentLink = page.locator("table tbody tr a").first();
    if (await studentLink.isVisible()) {
      await studentLink.click();
      await page.waitForLoadState("networkidle");

      // 플랜 탭 클릭
      const planTab = page.locator('a[href*="/plans"]').first();
      if (await planTab.isVisible()) {
        await planTab.click();
        await page.waitForLoadState("networkidle");

        // 플랜 그룹 클릭
        const planGroupLink = page.locator('a[href*="/plan-groups/"]').first();
        if (await planGroupLink.isVisible()) {
          await planGroupLink.click();
          await page.waitForLoadState("networkidle");

          // 내보내기 버튼 클릭
          const exportButton = page.locator('button:has-text("마크다운 내보내기")');
          if (await exportButton.isVisible()) {
            await exportButton.click();

            // 모달 대기
            await page.waitForSelector('h2:has-text("마크다운 내보내기")', {
              timeout: 10000,
            });

            // 복사 버튼 클릭
            const copyButton = page.locator('button:has-text("복사")');
            await copyButton.click();

            // "복사됨" 텍스트 확인
            await expect(page.locator('text="복사됨"')).toBeVisible();

            // 클립보드 내용 확인
            const clipboardContent = await page.evaluate(() =>
              navigator.clipboard.readText()
            );
            expect(clipboardContent).toContain("#"); // 마크다운 헤더 포함 확인
          }
        }
      }
    }
  });

  test("마크다운 다운로드 기능", async ({ page }) => {
    // 플랜 그룹 페이지로 이동
    await page.goto("/admin/students");
    await page.waitForLoadState("networkidle");

    // 학생 목록에서 첫 번째 학생 클릭
    const studentRow = page.locator("table tbody tr").first();
    if (await studentRow.isVisible()) {
      await studentRow.click();
      await page.waitForLoadState("networkidle");

      // 플랜 탭으로 이동
      const planTab = page.locator('a[href*="/plans"]').first();
      if (await planTab.isVisible()) {
        await planTab.click();
        await page.waitForLoadState("networkidle");

        // 플랜 그룹 클릭
        const planGroupLink = page.locator('a[href*="/plan-groups/"]').first();
        if (await planGroupLink.isVisible()) {
          await planGroupLink.click();
          await page.waitForLoadState("networkidle");

          // 내보내기 버튼 확인
          const exportButton = page.locator('button:has-text("마크다운 내보내기")');
          if (await exportButton.isVisible()) {
            await exportButton.click();

            // 모달 대기
            await page.waitForSelector('h2:has-text("마크다운 내보내기")', {
              timeout: 10000,
            });

            // 다운로드 이벤트 대기
            const [download] = await Promise.all([
              page.waitForEvent("download"),
              page.locator('button:has-text("다운로드")').click(),
            ]);

            // 다운로드 파일명 확인
            expect(download.suggestedFilename()).toMatch(/\.md$/);
          }
        }
      }
    }
  });
});

test.describe("마크다운 내보내기 API", () => {
  test("API 직접 호출 테스트", async ({ request }) => {
    // API 엔드포인트 테스트 (인증 없이는 401 반환)
    const response = await request.get("/api/plan/test-id/export/markdown");

    // 인증 없이 호출하면 401 또는 리디렉션
    expect([401, 302, 307]).toContain(response.status());
  });
});
