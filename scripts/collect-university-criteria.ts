/**
 * 대학별 평가 기준 웹 수집 배치 스크립트
 *
 * Gemini grounding으로 웹 검색 → 구조화 → Supabase 저장
 *
 * 실행:
 *   npx tsx scripts/collect-university-criteria.ts
 *   npx tsx scripts/collect-university-criteria.ts --dry-run
 *   npx tsx scripts/collect-university-criteria.ts --limit=3
 *   npx tsx scripts/collect-university-criteria.ts --university=서울대
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generateObjectWithRateLimit } from "../lib/domains/plan/llm/ai-sdk";
import {
  UniversityEvalCriteriaSchema,
  type UniversityEvalCriteria,
} from "../lib/domains/university/types";

// ============================================
// 1. 대상 대학 × 전형
// ============================================

const TARGETS = [
  { university: "서울대학교", admissions: ["일반전형", "지역균형전형"] },
  { university: "연세대학교", admissions: ["활동우수형", "추천형"] },
  { university: "고려대학교", admissions: ["학업우수전형", "계열적합전형"] },
  { university: "성균관대학교", admissions: ["학과모집", "계열모집"] },
  { university: "서강대학교", admissions: ["학생부종합(일반)"] },
  { university: "한양대학교", admissions: ["추천형", "일반"] },
  { university: "중앙대학교", admissions: ["다빈치형인재", "탐구형인재"] },
  { university: "경희대학교", admissions: ["네오르네상스"] },
  { university: "이화여자대학교", admissions: ["미래인재"] },
  { university: "한국외국어대학교", admissions: ["학생부종합(일반)"] },
];

// ============================================
// 2. 시스템 프롬프트
// ============================================

const COLLECTION_SYSTEM_PROMPT = `당신은 대한민국 대입 전문 데이터 수집가입니다.
주어진 대학과 전형에 대해 웹 검색을 통해 2026학년도 공식 입시 정보를 수집하고 구조화하세요.

## 수집 대상
1. **인재상**: 대학이 공식 발표한 인재상 (요강/가이드북 원문 기반)
2. **평가 요소별 비율**: 학업역량, 진로역량, 공동체역량 등 (비율 합계 = 1.0)
3. **서류평가 세부 기준**: 학업능력/학업태도/학업외소양 등 구체적 평가 항목 설명
4. **면접 형식**: 서류확인/제시문/mmi/토론 중 택일, 상세(시간/인원/구조)
5. **수능최저학력기준**: 있으면 요약, 없으면 생략
6. **합격 핵심 팁**: 이 전형에서 가장 중요한 포인트 (최대 5개)

## 규칙
- 대학 공식 홈페이지, 대입정보포탈(adiga.kr), 입시요강 PDF를 우선 참조
- 확인되지 않은 정보는 포함하지 마세요
- evaluationFactors의 비율 합은 반드시 1.0이어야 합니다
- 면접이 없는 전형은 interviewFormat="없음"
- 한국어로 응답하세요`;

// ============================================
// 3. 수집 함수
// ============================================

const DELAY_MS = 5000; // 요청 간 5초 대기

async function collectSingle(
  university: string,
  admissionName: string,
): Promise<{ success: boolean; data?: UniversityEvalCriteria; error?: string }> {
  try {
    const result = await generateObjectWithRateLimit({
      system: COLLECTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${university} 2026학년도 학생부종합전형 "${admissionName}"의 평가기준을 구조화하세요. 대학명은 "${university}", admissionType은 "학생부종합", admissionName은 "${admissionName}"으로 설정하세요.`,
        },
      ],
      schema: UniversityEvalCriteriaSchema,
      modelTier: "standard",
      temperature: 0.1,
      grounding: { enabled: true, mode: "dynamic" },
    });

    return { success: true, data: result.object };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// 4. DB 저장
// ============================================

async function saveToSupabase(
  items: UniversityEvalCriteria[],
  dryRun: boolean,
): Promise<{ inserted: number; errors: string[] }> {
  if (dryRun || items.length === 0) {
    return { inserted: 0, errors: [] };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { inserted: 0, errors: ["Supabase 환경변수 미설정"] };
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = items.map((item) => ({
    university_name: item.universityName,
    admission_type: item.admissionType,
    admission_name: item.admissionName ?? null,
    ideal_student: item.idealStudent,
    evaluation_factors: item.evaluationFactors,
    document_eval_details: item.documentEvalDetails,
    interview_format: item.interviewFormat,
    interview_details: item.interviewDetails ?? null,
    min_score_criteria: item.minScoreCriteria ?? null,
    key_tips: item.keyTips,
    data_year: 2026,
  }));

  const errors: string[] = [];
  let inserted = 0;

  // 건별 upsert (unique constraint 활용)
  for (const row of rows) {
    const { error } = await supabase
      .from("university_evaluation_criteria" as never)
      .upsert(row as never, {
        onConflict: "university_name,admission_type,admission_name,data_year",
      } as never);

    if (error) {
      errors.push(`${row.university_name} ${row.admission_name}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return { inserted, errors };
}

// ============================================
// 5. Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const univArg = args.find((a) => a.startsWith("--university="));

  // 대상 필터링
  let targets = TARGETS;
  if (univArg) {
    const keyword = univArg.split("=")[1];
    targets = targets.filter((t) => t.university.includes(keyword));
  }

  // 전체 건수 계산
  let allTasks: { university: string; admission: string }[] = [];
  for (const t of targets) {
    for (const a of t.admissions) {
      allTasks.push({ university: t.university, admission: a });
    }
  }

  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : allTasks.length;
  allTasks = allTasks.slice(0, limit);

  console.log(`\n[collect] 대학별 평가 기준 수집`);
  console.log(`[collect] 대상: ${allTasks.length}건 (${targets.length}개 대학)`);
  console.log(`[collect] 모드: ${dryRun ? "DRY-RUN (DB 저장 안 함)" : "실행"}`);
  console.log(`[collect] 예상 소요: ~${Math.ceil(allTasks.length * (DELAY_MS / 1000 + 8))}초\n`);

  const results: UniversityEvalCriteria[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    console.log(
      `[${i + 1}/${allTasks.length}] ${task.university} — ${task.admission}`,
    );

    const result = await collectSingle(task.university, task.admission);

    if (result.success && result.data) {
      results.push(result.data);
      console.log(`  ✓ 수집 성공`);
      console.log(`    인재상: ${result.data.idealStudent.slice(0, 60)}...`);
      console.log(`    면접: ${result.data.interviewFormat}`);
      console.log(`    평가요소: ${JSON.stringify(result.data.evaluationFactors)}`);
    } else {
      errors.push(`${task.university} ${task.admission}: ${result.error}`);
      console.log(`  ✗ 실패: ${result.error}`);
    }

    // 마지막 건 아니면 대기
    if (i < allTasks.length - 1) {
      await delay(DELAY_MS);
    }
  }

  // DB 저장
  console.log(`\n[collect] 수집 완료: ${results.length}건 성공, ${errors.length}건 실패`);

  if (!dryRun && results.length > 0) {
    console.log(`[collect] DB 저장 중...`);
    const saveResult = await saveToSupabase(results, dryRun);
    console.log(`[collect] DB 저장: ${saveResult.inserted}건 완료`);
    if (saveResult.errors.length > 0) {
      console.log(`[collect] DB 에러:`);
      for (const e of saveResult.errors) {
        console.log(`  - ${e}`);
      }
    }
  }

  // 결과 요약
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  수집 결과 요약`);
  console.log(`${"=".repeat(60)}`);

  for (const r of results) {
    const factors = Object.entries(r.evaluationFactors)
      .map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`)
      .join(", ");
    console.log(
      `\n  ${r.universityName} — ${r.admissionName ?? r.admissionType}`,
    );
    console.log(`    인재상: ${r.idealStudent.slice(0, 80)}`);
    console.log(`    평가: ${factors}`);
    console.log(`    면접: ${r.interviewFormat}${r.interviewDetails ? ` (${r.interviewDetails.slice(0, 50)})` : ""}`);
    console.log(`    최저: ${r.minScoreCriteria ?? "없음"}`);
    console.log(`    팁: ${r.keyTips.slice(0, 3).join(" / ")}`);
  }

  if (errors.length > 0) {
    console.log(`\n  실패 목록:`);
    for (const e of errors) {
      console.log(`    ✗ ${e}`);
    }
  }

  console.log("");
}

main().catch((error) => {
  console.error("[collect] 실행 오류:", error);
  process.exit(1);
});
