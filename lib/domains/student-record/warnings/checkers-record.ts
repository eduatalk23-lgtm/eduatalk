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

export function checkReadingInsufficient(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;

    // 독서 0건이면 경고 (최소한의 기준)
    if (data.readings.length === 0) {
      results.push({
        ruleId: "reading_insufficient",
        severity: "medium",
        category: "record",
        title: "독서활동 미기록",
        message: `${grade}학년 독서활동이 기록되지 않았습니다.`,
        suggestion: "독서 권수보다 중요한 것은 '읽은 책을 탐구에 어떻게 활용했는가'입니다. 세특에서 독서 기반 탐구가 드러나도록 교과 단원과 연계한 독서를 기록하세요.",
      });
    } else if (data.readings.length < MIN_READINGS_PER_GRADE) {
      // 1건은 있으나 권장 미달 — severity를 low로 격하
      results.push({
        ruleId: "reading_insufficient",
        severity: "low",
        category: "record",
        title: "독서활동 참고",
        message: `${grade}학년 독서활동 ${data.readings.length}건 (참고: 권장 ${MIN_READINGS_PER_GRADE}권 이상). 권수보다 세특 내 독서 기반 탐구 활용이 더 중요합니다.`,
        suggestion: "독서를 통해 지적 호기심을 해결하는 과정이 세특에 드러나면 좋은 평가를 받습니다. 학년이 올라갈수록 난도 있는 독서로 심화하세요.",
      });
    }
  }
  return results;
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
