/**
 * 성적 분석 유틸리티 함수
 * 
 * 내신 및 모의고사 성적의 추이, 순위, 취약점 등을 분석합니다.
 */

import type { EnrichedInternalScore, EnrichedMockScore } from "@/lib/types/scoreAnalysis";

/**
 * GPA 추이 계산 (학기별)
 * 
 * @param scores - 내신 성적 배열
 * @returns 학기별 GPA 배열
 */
export function calculateGPATrend(scores: EnrichedInternalScore[]): Array<{
  grade: number;
  semester: number;
  gpa: number;
  term: string;
}> {
  // 학기별로 그룹화
  const groupedByTerm = scores.reduce((acc, score) => {
    if (!score.rank_grade) return acc;

    const key = `${score.grade}-${score.semester}`;
    if (!acc[key]) {
      acc[key] = {
        grade: score.grade,
        semester: score.semester,
        scores: [],
        credits: [],
      };
    }

    acc[key].scores.push(score.rank_grade);
    acc[key].credits.push(score.credit_hours);

    return acc;
  }, {} as Record<string, { grade: number; semester: number; scores: number[]; credits: number[] }>);

  // GPA 계산 (학점 가중 평균)
  type TermData = { grade: number; semester: number; scores: number[]; credits: number[] };
  return (Object.values(groupedByTerm) as TermData[])
    .map((term) => {
      const totalCredits = term.credits.reduce((sum, c) => sum + c, 0);
      const weightedSum = term.scores.reduce(
        (sum, score, idx) => sum + score * term.credits[idx],
        0
      );
      const gpa = totalCredits > 0 ? weightedSum / totalCredits : 0;

      return {
        grade: term.grade,
        semester: term.semester,
        gpa: Math.round(gpa * 100) / 100,
        term: `${term.grade}학년 ${term.semester}학기`,
      };
    })
    .sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.semester - b.semester;
    });
}

/**
 * 과목별 순위 계산 (성적 우수 순)
 * 
 * @param scores - 내신 성적 배열
 * @returns 성적 우수 순으로 정렬된 과목 배열
 */
export function calculateSubjectRanking(
  scores: EnrichedInternalScore[]
): Array<{
  subject_id: string;
  subject_name: string;
  subject_group_name: string;
  average_grade: number;
  count: number;
}> {
  // 과목별로 그룹화
  const groupedBySubject = scores.reduce((acc, score) => {
    if (!score.rank_grade) return acc;

    const subjectId = score.subject_id;
    if (!acc[subjectId]) {
      acc[subjectId] = {
        subject_id: subjectId,
        subject_name: score.subject_name || "알 수 없음",
        subject_group_name: score.subject_group_name || "기타",
        grades: [],
      };
    }

    acc[subjectId].grades.push(score.rank_grade);

    return acc;
  }, {} as Record<string, { subject_id: string; subject_name: string; subject_group_name: string; grades: number[] }>);

  // 평균 등급 계산 및 정렬
  type SubjectData = { subject_id: string; subject_name: string; subject_group_name: string; grades: number[] };
  return (Object.values(groupedBySubject) as SubjectData[])
    .map((subject) => ({
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      subject_group_name: subject.subject_group_name,
      average_grade:
        subject.grades.reduce((sum, g) => sum + g, 0) / subject.grades.length,
      count: subject.grades.length,
    }))
    .sort((a, b) => a.average_grade - b.average_grade); // 1등급이 가장 우수
}

/**
 * 취약 과목 분석
 * 
 * @param scores - 내신 성적 배열
 * @param threshold - 취약 기준 등급 (기본값: 5등급)
 * @returns 취약 과목 배열
 */
export function analyzeWeakPoints(
  scores: EnrichedInternalScore[],
  threshold: number = 5
): Array<{
  subject_id: string;
  subject_name: string;
  subject_group_name: string;
  average_grade: number;
  recent_grade: number | null;
  improvement_needed: boolean;
}> {
  const ranking = calculateSubjectRanking(scores);

  return ranking
    .filter((subject) => subject.average_grade >= threshold)
    .map((subject) => {
      // 최근 성적 조회
      const recentScores = scores
        .filter((s) => s.subject_id === subject.subject_id && s.rank_grade)
        .sort((a, b) => {
          if (a.grade !== b.grade) return b.grade - a.grade;
          return b.semester - a.semester;
        });

      return {
        subject_id: subject.subject_id,
        subject_name: subject.subject_name,
        subject_group_name: subject.subject_group_name,
        average_grade: subject.average_grade,
        recent_grade: recentScores[0]?.rank_grade || null,
        improvement_needed: true,
      };
    });
}

/**
 * 평균 대비 분석
 * 
 * @param score - 개별 성적
 * @returns Z-Score 및 해석
 */
export function compareWithAverage(score: {
  raw_score?: number | null;
  avg_score?: number | null;
  std_dev?: number | null;
}): {
  z_score: number | null;
  interpretation: "우수" | "평균" | "미흡" | "분석불가";
  difference: number | null;
} {
  if (
    score.raw_score === null ||
    score.raw_score === undefined ||
    score.avg_score === null ||
    score.avg_score === undefined ||
    score.std_dev === null ||
    score.std_dev === undefined ||
    score.std_dev === 0
  ) {
    return {
      z_score: null,
      interpretation: "분석불가",
      difference: null,
    };
  }

  const difference = score.raw_score - score.avg_score;
  const z_score = difference / score.std_dev;

  let interpretation: "우수" | "평균" | "미흡" | "분석불가";
  if (z_score >= 1.0) {
    interpretation = "우수";
  } else if (z_score >= -0.5) {
    interpretation = "평균";
  } else {
    interpretation = "미흡";
  }

  return {
    z_score: Math.round(z_score * 100) / 100,
    interpretation,
    difference: Math.round(difference * 10) / 10,
  };
}

/**
 * 모의고사 백분위 추이 분석
 * 
 * @param scores - 모의고사 성적 배열 (시간순 정렬됨)
 * @returns 추이 분석 결과
 */
export function analyzeMockTrend(scores: EnrichedMockScore[]): {
  trend: "상승" | "유지" | "하락" | "분석불가";
  recent_average_percentile: number | null;
  change_from_previous: number | null;
} {
  const scoresWithPercentile = scores.filter(
    (s) => s.percentile !== null && s.percentile !== undefined
  );

  if (scoresWithPercentile.length === 0) {
    return {
      trend: "분석불가",
      recent_average_percentile: null,
      change_from_previous: null,
    };
  }

  // 최근 3회 평균 백분위
  const recentScores = scoresWithPercentile.slice(-3);
  const recentAverage =
    recentScores.reduce((sum, s) => sum + (s.percentile || 0), 0) /
    recentScores.length;

  // 이전 3회와 비교
  if (scoresWithPercentile.length < 3) {
    return {
      trend: "분석불가",
      recent_average_percentile: Math.round(recentAverage * 10) / 10,
      change_from_previous: null,
    };
  }

  const previousScores = scoresWithPercentile.slice(-6, -3);
  if (previousScores.length === 0) {
    return {
      trend: "분석불가",
      recent_average_percentile: Math.round(recentAverage * 10) / 10,
      change_from_previous: null,
    };
  }

  const previousAverage =
    previousScores.reduce((sum, s) => sum + (s.percentile || 0), 0) /
    previousScores.length;

  const change = recentAverage - previousAverage;

  let trend: "상승" | "유지" | "하락";
  if (change >= 5) {
    trend = "상승";
  } else if (change <= -5) {
    trend = "하락";
  } else {
    trend = "유지";
  }

  return {
    trend,
    recent_average_percentile: Math.round(recentAverage * 10) / 10,
    change_from_previous: Math.round(change * 10) / 10,
  };
}

/**
 * 과목별 모의고사 성적 비교 (최근 2회)
 * 
 * @param scores - 과목별 모의고사 성적 배열 (시간순 정렬)
 * @returns 최근 2회 비교 결과
 */
export function compareTwoRecentMockScores(
  scores: EnrichedMockScore[]
): Array<{
  subject_id: string;
  subject_name: string;
  recent_score: {
    exam_title: string;
    grade_score: number | null;
    percentile: number | null;
  };
  previous_score: {
    exam_title: string;
    grade_score: number | null;
    percentile: number | null;
  } | null;
  change: {
    grade_change: number | null;
    percentile_change: number | null;
  };
}> {
  // 과목별로 그룹화
  const groupedBySubject = scores.reduce((acc, score) => {
    const subjectId = score.subject_id;
    if (!acc[subjectId]) {
      acc[subjectId] = {
        subject_id: subjectId,
        subject_name: score.subject_name || "알 수 없음",
        scores: [],
      };
    }

    acc[subjectId].scores.push(score);

    return acc;
  }, {} as Record<string, { subject_id: string; subject_name: string; scores: EnrichedMockScore[] }>);

  // 최근 2회 비교
  type MockSubjectData = { subject_id: string; subject_name: string; scores: EnrichedMockScore[] };
  return (Object.values(groupedBySubject) as MockSubjectData[]).map((subject) => {
    const sortedScores = subject.scores.sort(
      (a, b) =>
        new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime()
    );

    const recent = sortedScores[0];
    const previous = sortedScores[1] || null;

    let grade_change: number | null = null;
    let percentile_change: number | null = null;

    if (previous) {
      if (recent.grade_score !== null && previous.grade_score !== null) {
        grade_change = previous.grade_score - recent.grade_score; // 등급은 낮을수록 좋음
      }
      if (recent.percentile !== null && previous.percentile !== null) {
        percentile_change = recent.percentile - previous.percentile;
      }
    }

    return {
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      recent_score: {
        exam_title: recent.exam_title,
        grade_score: recent.grade_score,
        percentile: recent.percentile,
      },
      previous_score: previous
        ? {
            exam_title: previous.exam_title,
            grade_score: previous.grade_score,
            percentile: previous.percentile,
          }
        : null,
      change: {
        grade_change,
        percentile_change,
      },
    };
  });
}

