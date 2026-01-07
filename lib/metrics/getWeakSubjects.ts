import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { WEAK_SUBJECT_CONSTANTS } from "@/lib/metrics/constants";
import type {
  SupabaseServerClient,
  MetricsResult,
  WeeklyMetricsOptions,
} from "./types";
import {
  toDateString,
  handleMetricsError,
  nullToDefault,
  isNotNullString,
  isNotNullNumber,
} from "./utils";

type PlanRow = {
  id: string;
  content_type: string | null;
  content_id: string | null;
};

type ContentRow = {
  id: string;
  subject: string | null;
};

type AnalysisRow = {
  subject: string | null;
  risk_score: number | null;
};

/**
 * 취약 과목 메트릭 타입
 * 
 * @property weakSubjects - 취약 과목 목록 (risk_score >= 50인 과목)
 * @property subjectStudyTime - 과목별 학습시간 맵 (과목명 -> 분 단위)
 * @property totalStudyTime - 전체 학습시간 (분)
 * @property weakSubjectStudyTimeRatio - 취약 과목 학습시간 비율 (0-100, 취약 과목 학습시간 / 전체 학습시간 * 100)
 */
export type WeakSubjectMetrics = {
  weakSubjects: string[]; // 취약 과목 목록
  subjectStudyTime: Map<string, number>; // 과목별 학습시간 (분)
  totalStudyTime: number; // 전체 학습시간 (분)
  weakSubjectStudyTimeRatio: number; // 취약 과목 학습시간 비율 (0-100)
};

/**
 * 취약 과목 메트릭 조회
 * 
 * N+1 쿼리 최적화: 플랜과 콘텐츠 정보를 배치로 조회
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 메트릭 조회 옵션
 * @param options.studentId - 학생 ID
 * @param options.weekStart - 주간 시작일
 * @param options.weekEnd - 주간 종료일
 * @returns 취약 과목 메트릭 결과
 * 
 * @example
 * ```typescript
 * const result = await getWeakSubjects(supabase, {
 *   studentId: "student-123",
 *   weekStart: new Date('2025-01-13'),
 *   weekEnd: new Date('2025-01-19'),
 * });
 * 
 * if (result.success) {
 *   console.log(`취약 과목: ${result.data.weakSubjects.join(', ')}`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function getWeakSubjects(
  supabase: SupabaseServerClient,
  options: WeeklyMetricsOptions
): Promise<MetricsResult<WeakSubjectMetrics>> {
  try {
    const { studentId, weekStart, weekEnd } = options;
    const weekStartStr = toDateString(weekStart);
    const weekEndStr = toDateString(weekEnd);

    // 이번 주 세션 조회
    const sessions = await getSessionsByDateRange(
      supabase,
      studentId,
      weekStartStr,
      weekEndStr
    );

    // 1. plan_id와 content_type/content_id 수집
    const planIds = new Set<string>();
    const directContentKeys = new Set<string>(); // "contentType:contentId" 형식

    sessions.forEach((session) => {
      if (session.plan_id) {
        planIds.add(session.plan_id);
      } else if (session.content_type && session.content_id) {
        directContentKeys.add(`${session.content_type}:${session.content_id}`);
      }
    });

    // 2. 플랜 정보 배치 조회
    const planMap = new Map<string, { contentType: string; contentId: string }>();
    if (planIds.size > 0) {
      const plans = await safeQueryArray<PlanRow>(
        async () => {
          const result = await supabase
            .from("student_plan")
            .select("id,content_type,content_id")
            .eq("student_id", studentId)
            .in("id", Array.from(planIds));
          return { data: result.data as PlanRow[] | null, error: result.error };
        },
        async () => {
          const result = await supabase
            .from("student_plan")
            .select("id,content_type,content_id")
            .in("id", Array.from(planIds));
          return { data: result.data as PlanRow[] | null, error: result.error };
        },
        { context: "[metrics/getWeakSubjects] 플랜 조회" }
      );

      plans.forEach((plan) => {
        if (plan.content_type && plan.content_id) {
          planMap.set(plan.id, {
            contentType: plan.content_type,
            contentId: plan.content_id,
          });
        }
      });
    }

    // 3. 콘텐츠 키 수집 (플랜에서 추출 + 직접 세션에서 추출)
    const contentKeys = new Map<string, { contentType: string; contentId: string }>();
    
    // 플랜에서 추출
    planMap.forEach((content, planId) => {
      contentKeys.set(`${content.contentType}:${content.contentId}`, content);
    });
    
    // 직접 세션에서 추출
    directContentKeys.forEach((key) => {
      const [contentType, contentId] = key.split(":");
      if (contentType && contentId) {
        contentKeys.set(key, { contentType, contentId });
      }
    });

    // 4. 콘텐츠 타입별로 분류
    const bookIds: string[] = [];
    const lectureIds: string[] = [];
    const customIds: string[] = [];

    contentKeys.forEach(({ contentType, contentId }) => {
      if (contentType === "book") {
        bookIds.push(contentId);
      } else if (contentType === "lecture") {
        lectureIds.push(contentId);
      } else if (contentType === "custom") {
        customIds.push(contentId);
      }
    });

    // 5. 콘텐츠 정보 배치 조회 (병렬)
    const [booksResult, lecturesResult, customResult] = await Promise.all([
      bookIds.length > 0
        ? safeQueryArray<ContentRow>(
            async () => {
              const result = await supabase
                .from("books")
                .select("id,subject")
                .eq("student_id", studentId)
                .in("id", bookIds);
              return { data: result.data as ContentRow[] | null, error: result.error };
            },
            undefined,
            { context: "[metrics/getWeakSubjects] 책 조회" }
          )
        : Promise.resolve([]),
      lectureIds.length > 0
        ? safeQueryArray<ContentRow>(
            async () => {
              const result = await supabase
                .from("lectures")
                .select("id,subject")
                .eq("student_id", studentId)
                .in("id", lectureIds);
              return { data: result.data as ContentRow[] | null, error: result.error };
            },
            undefined,
            { context: "[metrics/getWeakSubjects] 강의 조회" }
          )
        : Promise.resolve([]),
      customIds.length > 0
        ? safeQueryArray<ContentRow>(
            async () => {
              const result = await supabase
                .from("student_custom_contents")
                .select("id,subject")
                .eq("student_id", studentId)
                .in("id", customIds);
              return { data: result.data as ContentRow[] | null, error: result.error };
            },
            undefined,
            { context: "[metrics/getWeakSubjects] 커스텀 콘텐츠 조회" }
          )
        : Promise.resolve([]),
    ]);

    // 6. 콘텐츠 ID -> 과목 매핑 생성
    const contentSubjectMap = new Map<string, string | null>();
    booksResult.forEach((book) => {
      contentSubjectMap.set(`book:${book.id}`, book.subject);
    });
    lecturesResult.forEach((lecture) => {
      contentSubjectMap.set(`lecture:${lecture.id}`, lecture.subject);
    });
    customResult.forEach((custom) => {
      contentSubjectMap.set(`custom:${custom.id}`, custom.subject);
    });

    // 7. 세션별로 과목 매핑하여 학습시간 계산
    const subjectTimeMap = new Map<string, number>();

    sessions.forEach((session) => {
      if (!session.duration_seconds) return;

      let subject: string | null = null;

      if (session.plan_id) {
        const planContent = planMap.get(session.plan_id);
        if (planContent) {
          const contentKey = `${planContent.contentType}:${planContent.contentId}`;
          subject = contentSubjectMap.get(contentKey) ?? null;
        }
      } else if (session.content_type && session.content_id) {
        const contentKey = `${session.content_type}:${session.content_id}`;
        subject = contentSubjectMap.get(contentKey) ?? null;
      }

      if (subject) {
        const current = subjectTimeMap.get(subject) || 0;
        subjectTimeMap.set(subject, current + Math.floor(session.duration_seconds / 60));
      }
    });

    // 8. 취약 과목 조회 (student_analysis 테이블)
    const analyses = await safeQueryArray<AnalysisRow>(
      async () => {
        const result = await supabase
          .from("student_analysis")
          .select("subject,risk_score")
          .eq("student_id", studentId)
          .order("risk_score", { ascending: false });
        return { data: result.data as AnalysisRow[] | null, error: result.error };
      },
      async () => {
        const result = await supabase
          .from("student_analysis")
          .select("subject,risk_score")
          .order("risk_score", { ascending: false });
        return { data: result.data as AnalysisRow[] | null, error: result.error };
      },
      { context: "[metrics/getWeakSubjects] 분석 조회" }
    );

    // 위험도가 높은 과목을 취약 과목으로 간주
    const weakSubjects = analyses
      .filter(
        (a) =>
          isNotNullString(a.subject) &&
          isNotNullNumber(a.risk_score) &&
          a.risk_score >= WEAK_SUBJECT_CONSTANTS.RISK_SCORE_THRESHOLD
      )
      .map((a) => a.subject as string);

    // 전체 학습시간 계산
    const totalStudyTime = Array.from(subjectTimeMap.values()).reduce(
      (sum, minutes) => sum + minutes,
      0
    );

    // 취약 과목 학습시간 합계
    const weakSubjectStudyTime = weakSubjects.reduce(
      (sum, subject) => sum + (subjectTimeMap.get(subject) || 0),
      0
    );

    // 취약 과목 학습시간 비율
    const weakSubjectStudyTimeRatio =
      totalStudyTime > 0 ? Math.round((weakSubjectStudyTime / totalStudyTime) * 100) : 0;

    return {
      success: true,
      data: {
        weakSubjects,
        subjectStudyTime: subjectTimeMap,
        totalStudyTime,
        weakSubjectStudyTimeRatio,
      },
    };
  } catch (error) {
    return handleMetricsError(
      error,
      "[metrics/getWeakSubjects]",
      {
        weakSubjects: [],
        subjectStudyTime: new Map(),
        totalStudyTime: 0,
        weakSubjectStudyTimeRatio: 0,
      }
    );
  }
}

