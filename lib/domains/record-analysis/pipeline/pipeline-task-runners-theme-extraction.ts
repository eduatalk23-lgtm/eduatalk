// ============================================
// H1 / L3-A: Cross-subject Theme Extraction 태스크 러너 (Grade Pipeline P3.5)
// 학년 내 세특/창체/행특 레코드를 한 프롬프트에 일괄 주입 → 과목 교차 테마 감지
// 결과는 ctx.belief.gradeThemes에 저장되어 P4-P6 가이드 프롬프트에 주입된다.
// 실패는 non-fatal — 가이드는 themes 없이 동작 (graceful degradation).
//
// α 후속 1 (2026-04-24): ctx.belief.gradeThemes dual write 추가.
// 소비처: pipeline-task-runners-guide.ts (ctx.belief.gradeThemes read).
// ============================================

import { logActionWarn, logActionDebug } from "@/lib/logging/actionLogger";
import {
  type PipelineContext,
  type TaskRunnerOutput,
} from "./pipeline-types";
import { extractCrossSubjectThemes } from "../llm/actions/extractThemes";
import type { GradeThemeExtractionInput } from "../llm/types";

const LOG_CTX = { domain: "record-analysis", action: "pipeline-theme-extraction" };

/** 토큰 절감을 위한 content 경량 요약 (550자 초과 시 머리/꼬리 분할). */
function truncateContent(content: string, maxChars = 550): string {
  if (!content) return "";
  if (content.length <= maxChars) return content;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 10;
  return `${content.slice(0, head)}\n…(중략)…\n${content.slice(-tail)}`;
}

/**
 * H1: 학년 단위 cross-subject theme 추출.
 * 입력: ctx.belief.resolvedRecords[targetGrade] + ctx.belief.analysisContext[targetGrade] + ctx.belief.profileCard
 * 출력: ctx.belief.gradeThemes (GradeThemeExtractionResult)
 */
export async function runCrossSubjectThemeExtractionForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  const { studentId, targetGrade, snapshot } = ctx;
  if (targetGrade == null) {
    return "테마 추출 스킵: targetGrade 미설정";
  }
  const gradeBucket = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeBucket) {
    ctx.belief.gradeThemes = undefined;
    return "테마 추출 스킵: 해소된 레코드 없음";
  }

  // 분석 맥락에서 record_id → issue codes 매핑 구성
  const issuesByRecordId = new Map<string, string[]>();
  const gradeCtx = ctx.belief.analysisContext?.[targetGrade];
  if (gradeCtx) {
    for (const q of gradeCtx.qualityIssues) {
      if (q.issues.length > 0) issuesByRecordId.set(q.recordId, q.issues);
    }
  }

  // resolvedRecords → GradeThemeExtractionInput.records 변환 (effectiveContent 우선, 빈 콘텐츠 제외)
  const records: GradeThemeExtractionInput["records"] = [];
  for (const r of gradeBucket.seteks) {
    const content = (r.effectiveContent ?? "").trim();
    if (!content) continue;
    records.push({
      recordId: r.id,
      recordType: "setek",
      ...(r.subjectName ? { subjectName: r.subjectName } : {}),
      content: truncateContent(content),
      ...(issuesByRecordId.has(r.id) ? { qualityIssues: issuesByRecordId.get(r.id) } : {}),
    });
  }
  for (const r of gradeBucket.changche) {
    const content = (r.effectiveContent ?? "").trim();
    if (!content) continue;
    records.push({
      recordId: r.id,
      recordType: "changche",
      ...(r.activityType ? { subjectName: r.activityType } : {}),
      content: truncateContent(content),
      ...(issuesByRecordId.has(r.id) ? { qualityIssues: issuesByRecordId.get(r.id) } : {}),
    });
  }
  if (gradeBucket.haengteuk) {
    const content = (gradeBucket.haengteuk.effectiveContent ?? "").trim();
    if (content) {
      records.push({
        recordId: gradeBucket.haengteuk.id,
        recordType: "haengteuk",
        content: truncateContent(content),
        ...(issuesByRecordId.has(gradeBucket.haengteuk.id)
          ? { qualityIssues: issuesByRecordId.get(gradeBucket.haengteuk.id) }
          : {}),
      });
    }
  }

  // 1건 이하면 cross-subject 정의상 의미 없음 → 빈 결과로 즉시 종료
  if (records.length < 2) {
    ctx.belief.gradeThemes = {
      themes: [],
      themeCount: 0,
      crossSubjectPatternCount: 0,
      dominantThemeIds: [],
      elapsedMs: 0,
    };
    return `테마 추출 스킵: 분석 가능 레코드 ${records.length}건`;
  }

  const targetMajor = (snapshot?.target_major as string | undefined) ?? undefined;

  const input: GradeThemeExtractionInput = {
    grade: targetGrade,
    records,
    ...(targetMajor ? { targetMajor } : {}),
    ...(ctx.belief.profileCard ? { profileCard: ctx.belief.profileCard } : {}),
  };

  try {
    const result = await extractCrossSubjectThemes(input);
    if (!result.success) {
      logActionWarn(LOG_CTX, `theme extraction failed: ${result.error}`, { studentId, targetGrade });
      ctx.belief.gradeThemes = undefined;
      return `테마 추출 실패: ${result.error}`;
    }

    ctx.belief.gradeThemes = result.data;
    logActionDebug(
      LOG_CTX,
      `themes=${result.data.themeCount} cross=${result.data.crossSubjectPatternCount} dominant=${result.data.dominantThemeIds.length}`,
      { studentId, targetGrade, elapsedMs: result.data.elapsedMs },
    );

    const dominantLabels = result.data.dominantThemeIds
      .map((id) => result.data.themes.find((t) => t.id === id)?.label)
      .filter(Boolean)
      .join(", ");
    return {
      preview: `테마 ${result.data.themeCount}개 (교차 ${result.data.crossSubjectPatternCount}개)${
        dominantLabels ? ` — ${dominantLabels}` : ""
      }`,
      result: {
        themeCount: result.data.themeCount,
        crossSubjectPatternCount: result.data.crossSubjectPatternCount,
        dominantThemeIds: result.data.dominantThemeIds,
        // Synthesis(S3)에서 재조회 없이 테마 데이터를 참조할 수 있도록 전체 테마 영속화.
        // 각 테마 평균 ~400B, 최대 6개 → 학년 당 ~2.5KB. Synthesis aggregation 비용 대비 허용.
        themes: result.data.themes,
        elapsedMs: result.data.elapsedMs,
        ...(result.data.truncationWarning ? { truncationWarning: true } : {}),
      },
    };
  } catch (err) {
    // extractCrossSubjectThemes 자체가 try/catch 내부에서 처리하지만, 예외 안전망
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn(LOG_CTX, `theme extraction threw: ${msg}`, { studentId, targetGrade });
    ctx.belief.gradeThemes = undefined;
    return `테마 추출 예외: ${msg}`;
  }
}
