// ============================================
// Phase D-2: student_mock_scores DB → SuneungScores 자동 변환
// DB에 저장된 모의고사 데이터를 배치 판정 엔진 입력으로 변환
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SuneungScores } from "../calculator/types";

/** 수학 선택과목 추론용 키워드 매핑 */
const MATH_VARIANT_KEYWORDS: Record<string, "미적분" | "기하" | "확률과통계"> = {
  미적분: "미적분",
  미적: "미적분",
  기하: "기하",
  "확률과 통계": "확률과통계",
  확률과통계: "확률과통계",
  확통: "확률과통계",
};

/** 한국사 과목명 패턴 */
const HISTORY_KEYWORDS = ["한국사", "국사"];

/** 제2외국어/한문 과목명 패턴 */
const FOREIGN_KEYWORDS = ["제2외국어", "한문", "아랍어", "일본어", "중국어", "프랑스어", "독일어", "스페인어", "러시아어", "베트남어"];

export interface MockScoreConversionResult {
  scores: SuneungScores;
  warnings: string[];
  examDate: string;
  examTitle: string;
}

/**
 * student_mock_scores DB에서 최신 모의고사를 조회하여 SuneungScores로 변환.
 *
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID
 * @param examDate 특정 시험 날짜 (null이면 최신 시험)
 * @returns 변환 결과 또는 null (모의고사 데이터 없음)
 */
export async function convertMockScoresToSuneung(
  studentId: string,
  tenantId: string,
  examDate?: string | null,
): Promise<MockScoreConversionResult | null> {
  const supabase = await createSupabaseServerClient();
  const warnings: string[] = [];

  // 1. 최신 시험 또는 지정 시험 조회
  let targetExamDate = examDate;
  let targetExamTitle = "";

  if (!targetExamDate) {
    const { data: latest } = await supabase
      .from("student_mock_scores")
      .select("exam_date, exam_title")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .not("exam_date", "is", null)
      .order("exam_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest?.exam_date) return null;
    targetExamDate = latest.exam_date;
    targetExamTitle = latest.exam_title ?? "";
  }

  // 2. 해당 시험의 과목별 성적 + math_variant 조회
  const { data: rows, error } = await supabase
    .from("student_mock_scores")
    .select(`
      raw_score,
      standard_score,
      grade_score,
      math_variant,
      subject:subjects (
        name,
        subject_group:subject_groups (
          name
        )
      )
    `)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("exam_date", targetExamDate)
    .not("subject_id", "is", null);

  if (error || !rows || rows.length === 0) {
    return null;
  }

  // 3. SuneungScores 초기화
  const scores: SuneungScores = {
    korean: null,
    koreanRaw: null,
    mathCalculus: null,
    mathCalculusRaw: null,
    mathGeometry: null,
    mathGeometryRaw: null,
    mathStatistics: null,
    mathStatisticsRaw: null,
    english: null,
    history: null,
    inquiry: {},
    foreignLang: null,
  };

  // 4. 행별 매핑
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subjectData = row.subject as any;
    const subjectName: string = subjectData?.name ?? "";
    const groupName: string = subjectData?.subject_group?.name ?? "";

    if (!groupName && !subjectName) continue;

    switch (groupName) {
      case "국어":
        scores.korean = row.standard_score ?? null;
        scores.koreanRaw = row.raw_score ?? null;
        break;

      case "수학": {
        // math_variant 우선, 없으면 과목명에서 추론
        const variant = resolveMathVariant(
          (row.math_variant as string) ?? null,
          subjectName,
        );
        if (variant) {
          switch (variant) {
            case "미적분":
              scores.mathCalculus = row.standard_score ?? null;
              scores.mathCalculusRaw = row.raw_score ?? null;
              break;
            case "기하":
              scores.mathGeometry = row.standard_score ?? null;
              scores.mathGeometryRaw = row.raw_score ?? null;
              break;
            case "확률과통계":
              scores.mathStatistics = row.standard_score ?? null;
              scores.mathStatisticsRaw = row.raw_score ?? null;
              break;
          }
        } else {
          // 추론 실패 → 미적분으로 기본 매핑 + 경고
          scores.mathCalculus = row.standard_score ?? null;
          scores.mathCalculusRaw = row.raw_score ?? null;
          warnings.push(`수학 선택과목 미구분 — "${subjectName}"을 미적분으로 기본 매핑`);
        }
        break;
      }

      case "영어":
        scores.english = row.grade_score ?? null;
        break;

      case "사회":
      case "과학":
        // 탐구 과목 → inquiry[과목명] = 원점수
        if (subjectName && row.raw_score != null) {
          scores.inquiry[subjectName] = row.raw_score;
        }
        break;

      default:
        // 교과군 미분류 → 과목명으로 한국사/제2외국어 판별
        if (isHistorySubject(subjectName)) {
          scores.history = row.grade_score ?? null;
        } else if (isForeignLangSubject(subjectName)) {
          scores.foreignLang = row.grade_score ?? null;
        }
        break;
    }
  }

  // 5. 누락 검증
  if (scores.korean == null && scores.koreanRaw == null) {
    warnings.push("국어 성적 누락");
  }
  if (
    scores.mathCalculus == null &&
    scores.mathGeometry == null &&
    scores.mathStatistics == null
  ) {
    warnings.push("수학 성적 누락");
  }
  if (scores.english == null) {
    warnings.push("영어 등급 누락");
  }
  if (Object.keys(scores.inquiry).length === 0) {
    warnings.push("탐구 과목 누락");
  }

  return {
    scores,
    warnings,
    examDate: targetExamDate!,
    examTitle: targetExamTitle,
  };
}

// ─── 헬퍼 ──────────────────────────────────

function resolveMathVariant(
  dbVariant: string | null,
  subjectName: string,
): "미적분" | "기하" | "확률과통계" | null {
  // DB에 명시된 경우 우선
  if (dbVariant && (dbVariant === "미적분" || dbVariant === "기하" || dbVariant === "확률과통계")) {
    return dbVariant;
  }

  // 과목명에서 추론
  const normalized = subjectName.replace(/\s/g, "");
  for (const [keyword, variant] of Object.entries(MATH_VARIANT_KEYWORDS)) {
    if (normalized.includes(keyword)) return variant;
  }

  return null;
}

function isHistorySubject(name: string): boolean {
  return HISTORY_KEYWORDS.some((k) => name.includes(k));
}

function isForeignLangSubject(name: string): boolean {
  return FOREIGN_KEYWORDS.some((k) => name.includes(k));
}
