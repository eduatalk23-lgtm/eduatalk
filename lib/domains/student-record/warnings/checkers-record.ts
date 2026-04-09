// ============================================
// 기록 관련 경고 체커 (Phase 6.5)
// ============================================
// checkMissingCareerActivity, checkChangcheEmpty, checkHaengteukDraft,
// checkReadingInsufficient, checkReadingNotConnected

import type { RecordWarning } from "./types";
import type { WarningCheckInput } from "./engine";
import { getEffective } from "./engine";
import { WARNING_THRESHOLDS } from "../evaluation-criteria/defaults";

const MIN_READINGS_PER_GRADE = WARNING_THRESHOLDS.minReadingsPerGrade;

export function checkMissingCareerActivity(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const hasCareer = data.changche.some(
      (c) => c.activity_type === "career" && getEffective(c).length > 10,
    );
    if (!hasCareer) {
      results.push({
        ruleId: "missing_career_activity",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "진로활동 미기록",
        message: `${grade}학년 진로활동 기록이 없습니다.`,
        suggestion: "진로 관련 창체활동을 기록해주세요.",
      });
    }
  }
  return results;
}

export function checkChangcheEmpty(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  const labels: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const emptyTypes = ["autonomy", "club", "career"].filter((type) => {
      const record = data.changche.find((c) => c.activity_type === type);
      return !record || getEffective(record).length < 10;
    });
    if (emptyTypes.length > 0) {
      results.push({
        ruleId: "changche_empty",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "창체 미작성",
        message: `${grade}학년 ${emptyTypes.map((t) => labels[t] ?? t).join(", ")} 영역이 비어있습니다.`,
        suggestion: "해당 학년의 창체 활동을 기록해주세요.",
      });
    }
  }
  return results;
}

export function checkHaengteukDraft(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade >= input.currentGrade) continue; // 이전 학년만 체크
    // 4계층(imported > confirmed > content > ai_draft) 유효 콘텐츠 기준으로 판단.
    // NEIS import 데이터는 imported_content에 저장되므로 content만 보면 false positive 발생.
    const effective = data.haengteuk ? getEffective(data.haengteuk) : "";
    if (effective.length < 20) {
      results.push({
        ruleId: "haengteuk_draft",
        severity: "high",
        category: "record",
        title: "행특 미확정",
        message: `${grade}학년 행동특성 및 종합의견이 작성되지 않았습니다.`,
        suggestion: "이전 학년 행특을 완성해주세요.",
      });
    }
  }
  return results;
}

/**
 * 독서활동 부족 — 누적 판단 + 현재 학년 단일 경보
 *
 * 취지: "과거 학년의 공백"은 수정 불가. 경보의 목적은 학생이 **현재 진행 학년에서
 * 독서 기반 탐구를 보완**하도록 안내하는 것이다. 따라서 학년별로 N개를 찍지 않고,
 * 현재 학년까지의 누적 상태를 1회 집계해 경보 1개만 생성한다.
 *
 * 임계: 누적 학년 × MIN_READINGS_PER_GRADE
 *   - 0권: medium (보완 필수)
 *   - 임계 미만: low (권장 수준)
 *   - 임계 이상: 경보 없음
 */
export function checkReadingInsufficient(input: WarningCheckInput): RecordWarning[] {
  let totalReadings = 0;
  let gradesCovered = 0;
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    totalReadings += data.readings.length;
    gradesCovered += 1;
  }

  // 학년 데이터가 없으면 경보 생략 (판단 근거 없음)
  if (gradesCovered === 0) return [];

  const minRequired = gradesCovered * MIN_READINGS_PER_GRADE;

  if (totalReadings === 0) {
    return [{
      ruleId: "reading_insufficient",
      severity: "medium",
      category: "record",
      title: "독서 기반 탐구 부재",
      message: `지금까지 독서 기록이 없습니다. 이번 학년 세특/자율 탐구에 '어떤 책을 읽고 어떻게 탐구했는지'가 드러나도록 설계하세요.`,
      suggestion: "관심 주제의 도서를 선정하여 '탐구 질문 → 자료조사 → 결론/제언'의 흐름이 세특에 녹아들도록 하세요. 권수보다 활용이 중요합니다.",
    }];
  }

  if (totalReadings < minRequired) {
    return [{
      ruleId: "reading_insufficient",
      severity: "low",
      category: "record",
      title: "독서 활용 보완 권장",
      message: `누적 독서 ${totalReadings}권 (${gradesCovered}개 학년 기준 권장 ${minRequired}권). 권수보다 세특 내 독서 기반 탐구 활용이 더 중요합니다.`,
      suggestion: "이번 학년에 관심 주제 심화 도서를 선정하여 세특 탐구로 연결하세요. 학년이 올라갈수록 난도 있는 독서로 심화하면 좋습니다.",
    }];
  }

  return [];
}

/**
 * 독서-세특 미연결 경고
 * [2026-04-03 컨설턴트 피드백]
 * 독서 기록은 있지만 세특에서 활용되지 않으면:
 * 1) 면접에서 압박질문 리스크 (양 채우기로 보임)
 * 2) 다음 학년에서 독서→심화탐구로 이어가도록 유도 필요
 */
export function checkReadingNotConnected(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    if (data.readings.length === 0) continue; // 독서 없으면 reading_insufficient가 처리

    // 세특 유효 콘텐츠에서 독서 제목이 한 번이라도 언급되는지 확인
    const allSetekContent = [
      ...data.seteks.map((s) => getEffective(s)),
      ...data.personalSeteks.map((s) => getEffective(s)),
    ].join(" ");

    const connectedCount = data.readings.filter((r) => {
      const title = (r.book_title ?? "").trim();
      if (title.length < 2) return false; // 너무 짧은 제목은 skip
      return allSetekContent.includes(title);
    }).length;

    const totalReadings = data.readings.length;
    const disconnectedCount = totalReadings - connectedCount;

    // 독서 기록이 2개 이상이면서, 절반 이상이 세특과 미연결
    if (totalReadings >= 2 && disconnectedCount > totalReadings / 2) {
      results.push({
        ruleId: "reading_not_connected",
        severity: "medium",
        category: "record",
        title: "독서-탐구 미연결",
        message: `${grade}학년 독서 ${totalReadings}건 중 ${disconnectedCount}건이 세특에서 활용되지 않았습니다. 독서 나열만으로는 면접에서 압박질문 리스크가 있습니다.`,
        suggestion: "다음 학년 활동 설계 시, 기존 독서 중 관심 주제를 선별하여 심화탐구로 이어가세요. 독서 → 탐구 질문 → 실험/조사 → 결론의 흐름이 세특에 드러나면 좋은 평가를 받습니다.",
      });
    }
  }
  return results;
}
