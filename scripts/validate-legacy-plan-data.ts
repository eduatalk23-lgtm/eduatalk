/**
 * 기존 플랜 데이터 검증 스크립트
 * 
 * DB에서 기존 플랜 그룹 데이터를 가져와 planWizardSchema로 검증합니다.
 * 
 * 사용법:
 *   tsx scripts/validate-legacy-plan-data.ts [options]
 * 
 * 옵션:
 *   --limit N: 검증할 데이터 개수 제한 (기본값: 100)
 *   --output PATH: 결과를 저장할 파일 경로 (기본값: validation-results-{timestamp}.json)
 *   --summary-only: 요약 정보만 출력
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { transformPlanGroupToWizardDataPure } from "@/lib/utils/planGroupTransform";
import {
  validateLegacyDataBatch,
  summarizeValidationResults,
  formatValidationSummary,
  formatValidationResult,
  saveValidationResultsToFile,
  type ValidationResult,
} from "@/lib/utils/validateLegacyData";

/**
 * 스크립트 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const summaryOnly = args.includes("--summary-only");

  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 100;
  const outputPath = outputArg ? outputArg.split("=")[1] : undefined;

  console.log("=".repeat(60));
  console.log("기존 플랜 데이터 검증 시작");
  console.log("=".repeat(60));
  console.log(`제한: ${limit}개`);
  console.log(`요약만 출력: ${summaryOnly ? "예" : "아니오"}`);
  console.log("");

  try {
    // Supabase 클라이언트 생성
    const supabase = await createSupabaseAdminClient();

    // 플랜 그룹 목록 조회 (Read-only)
    const { data: planGroups, error: fetchError } = await supabase
      .from("plan_groups")
      .select("id, student_id, tenant_id")
      .limit(limit)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("❌ 플랜 그룹 조회 실패:", fetchError.message);
      process.exit(1);
    }

    if (!planGroups || planGroups.length === 0) {
      console.log("⚠️ 검증할 플랜 그룹이 없습니다.");
      process.exit(0);
    }

    console.log(`📊 ${planGroups.length}개의 플랜 그룹을 검증합니다...\n`);

    // 각 플랜 그룹 데이터 검증
    const validationResults: ValidationResult[] = [];
    let processed = 0;

    for (const group of planGroups) {
      try {
        // 플랜 그룹 상세 정보 조회
        const { group: groupDetail, contents, exclusions, academySchedules } =
          await getPlanGroupWithDetails(
            group.id,
            group.student_id,
            group.tenant_id
          );

        if (!groupDetail) {
          console.log(`⚠️ 플랜 그룹 ${group.id} 상세 정보를 찾을 수 없습니다.`);
          validationResults.push({
            success: false,
            errors: [
              {
                field: "root",
                message: "플랜 그룹 상세 정보를 찾을 수 없습니다.",
                code: "custom" as any,
                path: [],
              },
            ],
            warnings: [],
          });
          continue;
        }

        // WizardData로 변환
        const wizardData = await transformPlanGroupToWizardDataPure(
          groupDetail,
          contents,
          exclusions,
          academySchedules,
          {}
        );

        // 검증
        const result = validateLegacyData(wizardData);
        validationResults.push(result);

        processed++;

        // 진행 상황 출력 (요약 모드가 아닌 경우)
        if (!summaryOnly && !result.success) {
          console.log(`\n❌ 플랜 그룹 ${group.id} 검증 실패:`);
          console.log(formatValidationResult(result));
        } else if (!summaryOnly && processed % 10 === 0) {
          console.log(`진행 중... ${processed}/${planGroups.length}`);
        }
      } catch (error) {
        console.error(`\n❌ 플랜 그룹 ${group.id} 처리 중 오류:`, error);
        validationResults.push({
          success: false,
          errors: [
            {
              field: "root",
              message:
                error instanceof Error ? error.message : "알 수 없는 오류",
              code: "custom" as any,
              path: [],
            },
          ],
          warnings: [],
        });
      }
    }

    // 요약 정보 생성
    const summary = summarizeValidationResults(validationResults);

    // 결과 출력
    console.log("\n");
    console.log(formatValidationSummary(summary));

    // 결과 파일 저장
    if (outputPath || !summaryOnly) {
      const savedPath = await saveValidationResultsToFile(
        validationResults,
        outputPath
      );
      console.log(`\n📁 결과가 저장되었습니다: ${savedPath}`);
    }

    console.log("\n✅ 검증 완료");
  } catch (error) {
    console.error("\n❌ 검증 중 오류 발생:", error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error("예상치 못한 오류:", error);
  process.exit(1);
});

