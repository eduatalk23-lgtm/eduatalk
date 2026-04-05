/**
 * 4축 합격 진단 프로필 조합 함수 (F1-2)
 *
 * 4개 기존 엔진의 결과를 조합하여 학생의 학종 합격 가능성을
 * 다차원으로 진단하는 순수 함수.
 *
 * - DB 호출 없음
 * - 외부 의존 없음
 * - 모든 입력 타입은 기존 엔진 출력 타입 그대로 사용
 *
 * 4축:
 *   1축 profileMatch     — 계열 적합도 (matchUniversityProfiles 결과)
 *   2축 courseAdequacy   — 교과 이수 적합도 (calculateCourseAdequacy 결과)
 *   3축 flowCompletion   — 세특 완성도 (computeAggregateFlowCompletion 결과)
 *   4축 admissionReference — 학종 입결 내신 참조
 */

import type { UniversityMatchAnalysis } from "@/lib/domains/student-record/eval/university-profile-matcher";
import type { CourseAdequacyResult } from "@/lib/domains/student-record/types";
import type { FlowCompletionResult } from "@/lib/domains/student-record/evaluation-criteria/flow-completion";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

/** 4축 합격 진단 결과 */
export interface FourAxisDiagnosis {
  /** 1축: 계열 적합도 (0~100, S~D) — matchUniversityProfiles 결과 */
  profileMatch: {
    score: number;
    grade: "S" | "A" | "B" | "C" | "D";
    topTrack: { track: string; label: string };
    strengths: string[];
    gaps: string[];
  };

  /** 2축: 교과 이수 적합도 (0~100%) — calculateCourseAdequacy 결과 */
  courseAdequacy: {
    score: number;
    taken: string[];
    notTaken: string[];
    generalRate: number;
    careerRate: number;
  } | null;

  /** 3축: 세특 완성도 (0~100%) — computeAggregateFlowCompletion 결과 */
  flowCompletion: {
    avgPercent: number;
    tier: { label: string; description: string };
    /** 진로교과 세특 평균 (null이면 진로교과 없음) */
    careerAvg: number | null;
    /** 비진로교과 세특 평균 (null이면 비진로교과 없음) */
    nonCareerAvg: number | null;
  };

  /** 4축: 학종 입결 참조 (내신 등급 비교) */
  admissionReference: {
    /** 목표 대학 입결 평균 내신 (있으면) */
    avgAdmissionGrade: number | null;
    /** 학생 평균 내신 */
    studentAvgGrade: number | null;
    /** 판정: 학생 내신이 입결 이내인지 */
    level: "above" | "within" | "below" | "unknown";
  } | null;

  /** 종합 의견 (규칙 기반 1~3문장) */
  summary: string;

  /** 4축 중 가장 약한 축 */
  weakestAxis: "profileMatch" | "courseAdequacy" | "flowCompletion" | "admissionReference";
}

/** buildFourAxisDiagnosis 입력 타입 */
export interface FourAxisDiagnosisInput {
  /** matchUniversityProfiles() 결과 */
  universityMatch: UniversityMatchAnalysis;
  /** calculateCourseAdequacy() 결과 (null이면 전공 미설정) */
  courseAdequacy: CourseAdequacyResult | null;
  /** computeAggregateFlowCompletion() 결과 */
  flowCompletion: {
    avgPercent: number;
    tier: { label: string; description: string };
    byRecord: FlowCompletionResult[];
  };
  /** 학종 입결 내신 등급 (선택) */
  admissionGrade?: number | null;
  /** 학생 평균 내신 등급 (선택) */
  studentGrade?: number | null;
  /**
   * 진로교과 과목명 목록 (flowCompletion byRecord 분리용)
   * byRecord와 순서를 맞춰 사용하거나, isCareerSubject 플래그를 직접 활용.
   */
  careerSubjects?: string[];
}

// ─── 내부 유틸 ──────────────────────────────────────────────────────────────

/**
 * 4축 각각을 0~100 점수로 정규화.
 *
 * - profileMatch: score 그대로 (0~100)
 * - courseAdequacy: score 그대로 (0~100), null이면 50 기본값
 * - flowCompletion: avgPercent (0~100)
 * - admissionReference: above=90, within=70, below=40, unknown=50 / null=50
 */
function normalizeAxisScores(diagnosis: {
  profileMatch: FourAxisDiagnosis["profileMatch"];
  courseAdequacy: FourAxisDiagnosis["courseAdequacy"];
  flowCompletion: FourAxisDiagnosis["flowCompletion"];
  admissionReference: FourAxisDiagnosis["admissionReference"];
}): Record<FourAxisDiagnosis["weakestAxis"], number> {
  const profileScore = diagnosis.profileMatch.score;

  const courseScore =
    diagnosis.courseAdequacy !== null ? diagnosis.courseAdequacy.score : 50;

  const flowScore = diagnosis.flowCompletion.avgPercent;

  let admissionScore = 50;
  if (diagnosis.admissionReference !== null) {
    const level = diagnosis.admissionReference.level;
    if (level === "above") admissionScore = 90;
    else if (level === "within") admissionScore = 70;
    else if (level === "below") admissionScore = 40;
    else admissionScore = 50; // unknown
  }

  return {
    profileMatch: profileScore,
    courseAdequacy: courseScore,
    flowCompletion: flowScore,
    admissionReference: admissionScore,
  };
}

/**
 * 4축 점수에서 가장 낮은 축 식별.
 * 동점이면 정의 순서 우선(profileMatch → courseAdequacy → flowCompletion → admissionReference).
 */
function findWeakestAxis(
  scores: Record<FourAxisDiagnosis["weakestAxis"], number>,
): FourAxisDiagnosis["weakestAxis"] {
  const axes: FourAxisDiagnosis["weakestAxis"][] = [
    "profileMatch",
    "courseAdequacy",
    "flowCompletion",
    "admissionReference",
  ];

  let weakest: FourAxisDiagnosis["weakestAxis"] = axes[0];
  let minScore = scores[axes[0]];

  for (const axis of axes) {
    if (scores[axis] < minScore) {
      minScore = scores[axis];
      weakest = axis;
    }
  }

  return weakest;
}

/**
 * 약한 축 이름을 한국어로 변환 (summary 문구 생성용).
 */
function axisLabel(axis: FourAxisDiagnosis["weakestAxis"]): string {
  switch (axis) {
    case "profileMatch":
      return "계열 적합도";
    case "courseAdequacy":
      return "교과 이수 적합도";
    case "flowCompletion":
      return "세특 완성도";
    case "admissionReference":
      return "내신 수준";
  }
}

/**
 * 내신 등급 비교 → admissionReference.level 판정.
 *
 * 내신은 낮을수록 좋음 (1등급이 최상). 학생 등급 ≤ 입결 등급이면 "above"(초과).
 *
 * - above : 학생 내신 > 입결 기준 (학생이 더 우수, 등급값이 낮음)
 * - within: 학생 내신이 입결 기준 ±0.5 이내
 * - below : 학생 내신 < 입결 기준 (학생이 미달)
 * - unknown: 데이터 없음
 */
function compareGrades(
  studentGrade: number | null | undefined,
  admissionGrade: number | null | undefined,
): "above" | "within" | "below" | "unknown" {
  if (
    studentGrade == null ||
    admissionGrade == null ||
    isNaN(studentGrade) ||
    isNaN(admissionGrade)
  ) {
    return "unknown";
  }

  const diff = studentGrade - admissionGrade; // 양수 = 학생이 불리 (등급 숫자가 높음)

  if (diff <= -0.5) return "above"; // 학생이 입결보다 0.5등급 이상 우수
  if (diff <= 0.5) return "within"; // ±0.5 이내
  return "below"; // 학생이 입결보다 미달
}

/**
 * flowCompletion byRecord에서 진로교과/비진로교과 평균 분리.
 *
 * byRecord[i].isCareerSubject 플래그를 사용.
 */
function splitFlowByCareer(byRecord: FlowCompletionResult[]): {
  careerAvg: number | null;
  nonCareerAvg: number | null;
} {
  const career = byRecord.filter((r) => r.isCareerSubject);
  const nonCareer = byRecord.filter((r) => !r.isCareerSubject);

  const avg = (records: FlowCompletionResult[]): number | null => {
    if (records.length === 0) return null;
    const sum = records.reduce((s, r) => s + r.completionPercent, 0);
    return Math.round((sum / records.length) * 10) / 10;
  };

  return {
    careerAvg: avg(career),
    nonCareerAvg: avg(nonCareer),
  };
}

// ─── summary 생성 ────────────────────────────────────────────────────────────

/**
 * 4축 분석 결과를 바탕으로 규칙 기반 종합 의견을 생성.
 *
 * 우선순위:
 *  1. courseAdequacy null → 전공 미설정 안내 (단독 메시지)
 *  2. 4축 모두 양호 → 긍정 메시지
 *  3. 2축 이상 미흡 → 미흡 축 나열 + 조언
 *  4. flow만 미흡 → 세특 개선 안내
 *  5. 1축 미흡 (weakestAxis 기준) → 해당 축 개선 안내
 */
function buildSummary(
  profileMatch: FourAxisDiagnosis["profileMatch"],
  courseAdequacy: FourAxisDiagnosis["courseAdequacy"],
  flowCompletion: FourAxisDiagnosis["flowCompletion"],
  admissionReference: FourAxisDiagnosis["admissionReference"],
  weakestAxis: FourAxisDiagnosis["weakestAxis"],
  axisScores: Record<FourAxisDiagnosis["weakestAxis"], number>,
): string {
  const topTrackLabel = profileMatch.topTrack.label;

  // 1. 전공 미설정
  if (courseAdequacy === null) {
    const profileGrade = profileMatch.grade;
    const flowOk = flowCompletion.avgPercent >= 60;
    if (profileGrade === "S" || profileGrade === "A") {
      return (
        `${topTrackLabel} 계열 적합성은 우수합니다. ` +
        (flowOk ? "세특 완성도도 양호한 편입니다. " : "") +
        "목표 전공 설정 후 교과 이수 적합도를 확인해 주세요."
      );
    }
    return "목표 전공 설정 후 교과 이수 적합도를 확인해 주세요.";
  }

  // 각 축 양호 기준
  const profileOk = axisScores.profileMatch >= 80;       // A 이상
  const courseOk = axisScores.courseAdequacy >= 70;      // 70% 이상
  const flowOk = axisScores.flowCompletion >= 60;         // 60% 이상
  const admissionLevel = admissionReference?.level ?? "unknown";
  const admissionOk =
    admissionLevel === "above" || admissionLevel === "within";

  // 2. 4축 모두 양호
  if (profileOk && courseOk && flowOk && admissionOk) {
    return (
      `학종 서류 경쟁력이 고르게 갖춰져 있습니다. ` +
      `${topTrackLabel} 계열 지원 시 유리합니다.`
    );
  }

  // 미흡 축 목록
  const weakAxes: FourAxisDiagnosis["weakestAxis"][] = [];
  if (!profileOk) weakAxes.push("profileMatch");
  if (!courseOk) weakAxes.push("courseAdequacy");
  if (!flowOk) weakAxes.push("flowCompletion");
  if (!admissionOk && admissionReference !== null) weakAxes.push("admissionReference");

  // 3. 2축 이상 미흡
  if (weakAxes.length >= 2) {
    const labels = weakAxes.map(axisLabel);
    const main = labels.slice(0, 2).join("과 ");
    const advice = weakAxes.includes("flowCompletion")
      ? "세특 탐구 완성도를 높이고, "
      : "";
    const courseAdvice = weakAxes.includes("courseAdequacy")
      ? `${courseAdequacy.notTaken.slice(0, 2).join(", ")} 등 미이수 과목 보완이 필요합니다.`
      : "역량 강화가 선행되어야 합니다.";
    return `${main}이 보완이 필요합니다. ${advice}${courseAdvice}`;
  }

  // 4. flow만 미흡
  if (!flowOk && profileOk && courseOk) {
    return "교과 이수와 역량은 양호하나, 세특 작성 완성도 개선이 필요합니다.";
  }

  // 5. 단일 축 미흡
  switch (weakestAxis) {
    case "profileMatch":
      return (
        `${topTrackLabel} 계열 적합도 점수(${profileMatch.score}점)가 낮습니다. ` +
        `${profileMatch.gaps[0] ?? "핵심 역량"} 역량을 보완하면 경쟁력이 향상됩니다.`
      );
    case "courseAdequacy": {
      const notTakenSample = courseAdequacy.notTaken.slice(0, 2).join(", ");
      return (
        `교과 이수 적합도(${courseAdequacy.score}%)가 낮습니다. ` +
        (notTakenSample ? `${notTakenSample} 등 권장 과목 이수를 검토해 주세요.` : "권장 과목 이수를 검토해 주세요.")
      );
    }
    case "flowCompletion":
      return (
        `세특 완성도(${flowCompletion.avgPercent}%)가 낮습니다. ` +
        `탐구 흐름 8단계 중 미충족 단계를 집중 보완해 주세요.`
      );
    case "admissionReference":
      if (admissionReference?.level === "below") {
        const gap =
          admissionReference.studentAvgGrade !== null &&
          admissionReference.avgAdmissionGrade !== null
            ? `(학생 ${admissionReference.studentAvgGrade}등급 vs 입결 ${admissionReference.avgAdmissionGrade}등급)`
            : "";
        return `내신 등급이 목표 대학 입결 기준에 미치지 못합니다${gap}. 내신 관리가 우선 과제입니다.`;
      }
      return "내신 데이터를 확인하고 목표 대학 입결과 비교해 주세요.";
  }
}

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * 4축 합격 진단 프로필 조합 함수
 *
 * 4개 엔진 결과를 받아 다차원 학종 합격 가능성을 진단한다.
 * 순수 함수 — DB 호출 없음, async 없음.
 *
 * @param input.universityMatch     matchUniversityProfiles() 결과
 * @param input.courseAdequacy      calculateCourseAdequacy() 결과 (null=전공 미설정)
 * @param input.flowCompletion      computeAggregateFlowCompletion() 결과
 * @param input.admissionGrade      목표 대학 입결 평균 내신 등급 (선택)
 * @param input.studentGrade        학생 평균 내신 등급 (선택)
 * @param input.careerSubjects      진로교과 과목명 목록 (flowCompletion 분리용, 선택)
 * @returns FourAxisDiagnosis
 */
export function buildFourAxisDiagnosis(
  input: FourAxisDiagnosisInput,
): FourAxisDiagnosis {
  const { universityMatch, courseAdequacy, flowCompletion } = input;
  const admissionGrade = input.admissionGrade ?? null;
  const studentGrade = input.studentGrade ?? null;

  // ── 1축: 계열 적합도 ────────────────────────────────────────
  const topMatch = universityMatch.topMatch;
  const profileMatchAxis: FourAxisDiagnosis["profileMatch"] = {
    score: topMatch.matchScore,
    grade: topMatch.grade,
    topTrack: {
      track: topMatch.track,
      label: topMatch.label,
    },
    strengths: topMatch.strengths,
    gaps: topMatch.gaps,
  };

  // ── 2축: 교과 이수 적합도 ────────────────────────────────────
  const courseAdequacyAxis: FourAxisDiagnosis["courseAdequacy"] =
    courseAdequacy !== null
      ? {
          score: courseAdequacy.score,
          taken: courseAdequacy.taken,
          notTaken: courseAdequacy.notTaken,
          generalRate: courseAdequacy.generalRate,
          careerRate: courseAdequacy.careerRate,
        }
      : null;

  // ── 3축: 세특 완성도 ─────────────────────────────────────────
  const { careerAvg, nonCareerAvg } = splitFlowByCareer(flowCompletion.byRecord);

  const flowCompletionAxis: FourAxisDiagnosis["flowCompletion"] = {
    avgPercent: flowCompletion.avgPercent,
    tier: {
      label: flowCompletion.tier.label,
      description: flowCompletion.tier.description,
    },
    careerAvg,
    nonCareerAvg,
  };

  // ── 4축: 학종 입결 참조 ──────────────────────────────────────
  const admissionLevel = compareGrades(studentGrade, admissionGrade);

  const admissionReferenceAxis: FourAxisDiagnosis["admissionReference"] =
    admissionGrade != null || studentGrade != null
      ? {
          avgAdmissionGrade: admissionGrade,
          studentAvgGrade: studentGrade,
          level: admissionLevel,
        }
      : null;

  // ── weakestAxis 판정 ─────────────────────────────────────────
  const axisScores = normalizeAxisScores({
    profileMatch: profileMatchAxis,
    courseAdequacy: courseAdequacyAxis,
    flowCompletion: flowCompletionAxis,
    admissionReference: admissionReferenceAxis,
  });

  const weakestAxis = findWeakestAxis(axisScores);

  // ── summary 생성 ──────────────────────────────────────────────
  const summary = buildSummary(
    profileMatchAxis,
    courseAdequacyAxis,
    flowCompletionAxis,
    admissionReferenceAxis,
    weakestAxis,
    axisScores,
  );

  return {
    profileMatch: profileMatchAxis,
    courseAdequacy: courseAdequacyAxis,
    flowCompletion: flowCompletionAxis,
    admissionReference: admissionReferenceAxis,
    summary,
    weakestAxis,
  };
}
