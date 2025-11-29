import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type SchoolScoreSummary = {
  subject: string;
  recentGrade: number | null; // 최근 등급
  averageGrade: number | null; // 평균 등급
  gradeVariance: number; // 등급 편차
  scoreVariance: number; // 원점수 편차
  nextTestDate: string | null; // 다음 시험일
  daysUntilNextTest: number | null; // 다음 시험까지 남은 일수
  semesterUrgency: number; // 학기 종료 임박도 (0-100)
};

export type MockScoreSummary = {
  subject: string;
  recentPercentile: number | null; // 최근 백분위
  recentGrade: number | null; // 최근 등급
  averagePercentile: number | null; // 평균 백분위
  averageGrade: number | null; // 평균 등급
  nextTestDate: string | null; // 다음 시험일
  daysUntilNextTest: number | null; // 다음 시험까지 남은 일수
};

export type RiskIndex = {
  subject: string;
  riskScore: number; // 0-100
  reasons: string[];
};

// 내신 성적 요약 조회
export async function getSchoolScoreSummary(
  studentId: string
): Promise<Map<string, SchoolScoreSummary>> {
  const supabase = await createSupabaseServerClient();
  const result = new Map<string, SchoolScoreSummary>();

  try {
    const selectScores = () =>
      supabase
        .from("student_internal_scores")
        .select("*, subject_groups(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

    let { data: scores, error } = await selectScores();

    if (error && error.code === "42703") {
      ({ data: scores, error } = await supabase
        .from("student_internal_scores")
        .select("*, subject_groups(name)")
        .order("created_at", { ascending: false }));
    }

    if (error) {
      // 에러 객체의 모든 속성을 안전하게 추출
      let errorMessage: string | undefined;
      let errorCode: string | undefined;
      let errorDetails: any;
      let errorHint: string | undefined;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        // Supabase PostgREST 에러 객체 처리
        errorMessage = "message" in error ? String(error.message) : undefined;
        errorCode = "code" in error ? String(error.code) : undefined;
        errorDetails = "details" in error ? error.details : undefined;
        errorHint = "hint" in error ? String(error.hint) : undefined;
      } else {
        errorMessage = String(error);
      }
      
      // 에러 객체 전체를 JSON으로 직렬화 시도
      let errorStringified: string | undefined;
      try {
        errorStringified = JSON.stringify(error, null, 2);
      } catch {
        errorStringified = String(error);
      }
      
      console.error("[scoreLoader] 내신 성적 조회 실패", {
        message: errorMessage || "에러 메시지 없음",
        code: errorCode,
        details: errorDetails,
        hint: errorHint,
        errorType: error instanceof Error ? "Error" : typeof error,
        errorStringified,
        errorRaw: error,
        context: {
          studentId,
        },
      });
      return result;
    }

    if (!scores || scores.length === 0) {
      return result;
    }

    // 과목별로 그룹화 (소문자로 정규화하여 매칭)
    const subjectMap = new Map<string, typeof scores>();

    (scores as Array<{
      subject_groups: { name: string } | null;
      rank_grade: number | null;
      raw_score: number | null;
      semester: number | null;
      grade: number | null;
    }>).forEach((score) => {
      if (!score.subject_groups?.name) return;
      const subject = score.subject_groups.name.toLowerCase().trim();
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, []);
      }
      subjectMap.get(subject)!.push(score);
    });

    // 각 과목별 요약 계산
    subjectMap.forEach((subjectScores, subject) => {
      const validGrades = subjectScores
        .map((s) => s.rank_grade)
        .filter((g): g is number => g !== null && g !== undefined);
      const validRawScores = subjectScores
        .map((s) => s.raw_score)
        .filter((r): r is number => r !== null && r !== undefined);

      if (validGrades.length === 0) {
        result.set(subject, {
          subject,
          recentGrade: null,
          averageGrade: null,
          gradeVariance: 0,
          scoreVariance: 0,
          nextTestDate: null,
          daysUntilNextTest: null,
          semesterUrgency: 0,
        });
        return;
      }

      // 최근 등급
      const recentGrade = validGrades[0];

      // 평균 등급
      const averageGrade =
        validGrades.reduce((a, b) => a + b, 0) / validGrades.length;

      // 등급 편차 계산
      const gradeVariance =
        validGrades.length > 1
          ? Math.sqrt(
              validGrades.reduce((sum, g) => {
                return sum + Math.pow(g - averageGrade, 2);
              }, 0) / validGrades.length
            )
          : 0;

      // 원점수 편차 계산
      let scoreVariance = 0;
      if (validRawScores.length > 1) {
        const mean =
          validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length;
        scoreVariance = Math.sqrt(
          validRawScores.reduce((sum, s) => {
            return sum + Math.pow(s - mean, 2);
          }, 0) / validRawScores.length
        );
      }

      // 다음 시험일 계산 (test_date 컬럼이 제거되어 null로 설정)
      // TODO: 향후 다른 방식으로 다음 시험일 추적 필요
      const nextTestDate: string | null = null;
      const daysUntilNextTest: number | null = null;

      // 학기 종료 임박도 계산
      // test_date가 없으므로 기본값 설정
      const semesterUrgency = 0;

      result.set(subject, {
        subject,
        recentGrade,
        averageGrade,
        gradeVariance,
        scoreVariance,
        nextTestDate,
        daysUntilNextTest,
        semesterUrgency,
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
    
    console.error("[scoreLoader] 내신 성적 요약 계산 실패", {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      context: {
        studentId,
      },
    });
  }

  return result;
}

// 모의고사 성적 요약 조회
export async function getMockScoreSummary(
  studentId: string
): Promise<Map<string, MockScoreSummary>> {
  const supabase = await createSupabaseServerClient();
  const result = new Map<string, MockScoreSummary>();

  try {
    const selectScores = () =>
      supabase
        .from("student_mock_scores")
        .select("*, subject_groups(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

    let { data: scores, error } = await selectScores();

    if (error && error.code === "42703") {
      ({ data: scores, error } = await supabase
        .from("student_mock_scores")
        .select("*, subject_groups(name)")
        .order("created_at", { ascending: false }));
    }

    if (error) {
      console.error("[scoreLoader] 모의고사 성적 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      });
      return result;
    }

    if (!scores || scores.length === 0) {
      return result;
    }

    // 과목별로 그룹화 (소문자로 정규화하여 매칭)
    const subjectMap = new Map<string, typeof scores>();

    (scores as Array<{
      subject_groups: { name: string } | null;
      percentile: number | null;
      grade_score: number | null;
    }>).forEach((score) => {
      if (!score.subject_groups?.name) return;
      const subject = score.subject_groups.name.toLowerCase().trim();
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, []);
      }
      subjectMap.get(subject)!.push(score);
    });

    // 각 과목별 요약 계산
    subjectMap.forEach((subjectScores, subject) => {
      const validPercentiles = subjectScores
        .map((s) => s.percentile)
        .filter((p): p is number => p !== null && p !== undefined);
      const validGrades = subjectScores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);

      const recentPercentile = validPercentiles.length > 0 ? validPercentiles[0] : null;
      const recentGrade = validGrades.length > 0 ? validGrades[0] : null;

      const averagePercentile =
        validPercentiles.length > 0
          ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
          : null;
      const averageGrade =
        validGrades.length > 0
          ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length
          : null;

      // 다음 시험일 계산 (test_date 컬럼이 제거되어 null로 설정)
      // TODO: 향후 다른 방식으로 다음 시험일 추적 필요
      const nextTestDate: string | null = null;
      const daysUntilNextTest: number | null = null;

      result.set(subject, {
        subject,
        recentPercentile,
        recentGrade,
        averagePercentile,
        averageGrade,
        nextTestDate,
        daysUntilNextTest,
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
    
    console.error("[scoreLoader] 모의고사 성적 요약 계산 실패", {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      context: {
        studentId,
      },
    });
  }

  return result;
}

// 과목별 Risk Index 계산
export async function getRiskIndexBySubject(
  studentId: string
): Promise<Map<string, RiskIndex>> {
  const result = new Map<string, RiskIndex>();

  try {
    const [schoolSummary, mockSummary] = await Promise.all([
      getSchoolScoreSummary(studentId),
      getMockScoreSummary(studentId),
    ]);

    // 모든 과목 수집
    const allSubjects = new Set<string>();
    schoolSummary.forEach((_, subject) => allSubjects.add(subject));
    mockSummary.forEach((_, subject) => allSubjects.add(subject));

    allSubjects.forEach((subject) => {
      const school = schoolSummary.get(subject);
      const mock = mockSummary.get(subject);
      const reasons: string[] = [];
      let riskScore = 0;

      // 내신 기준 위험도
      if (school) {
        // 평균 등급이 낮을수록 위험 (6등급 이상)
        if (school.averageGrade !== null && school.averageGrade >= 6) {
          riskScore += 40;
          reasons.push(`내신 평균 등급 ${school.averageGrade.toFixed(1)}등급 (낮음)`);
        } else if (school.averageGrade !== null && school.averageGrade >= 5) {
          riskScore += 20;
          reasons.push(`내신 평균 등급 ${school.averageGrade.toFixed(1)}등급`);
        }

        // 최근 등급 하락
        if (school.recentGrade !== null && school.averageGrade !== null) {
          if (school.recentGrade > school.averageGrade) {
            const decline = school.recentGrade - school.averageGrade;
            riskScore += decline * 15;
            reasons.push(`최근 등급 ${decline}단계 하락`);
          }
        }

        // 원점수 편차가 큰 경우
        if (school.scoreVariance > 20) {
          riskScore += 15;
          reasons.push(`점수 편차 큼 (불안정)`);
        }
      }

      // 모의고사 기준 위험도
      if (mock) {
        // 백분위 50 미만
        if (mock.recentPercentile !== null && mock.recentPercentile < 50) {
          riskScore += 50;
          reasons.push(`모의고사 백분위 ${mock.recentPercentile.toFixed(1)}% (낮음)`);
        }

        // 등급 6 이상
        if (mock.recentGrade !== null && mock.recentGrade >= 6) {
          riskScore += 40;
          reasons.push(`모의고사 등급 ${mock.recentGrade}등급 (낮음)`);
        }
      }

      // 데이터가 부족한 경우 기본 위험도
      if (!school && !mock) {
        riskScore = 30;
        reasons.push("성적 데이터 부족");
      }

      result.set(subject, {
        subject,
        riskScore: Math.min(100, riskScore),
        reasons,
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
    
    console.error("[scoreLoader] Risk Index 계산 실패", {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      context: {
        studentId,
      },
    });
  }

  return result;
}

