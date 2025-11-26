type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

export type StudentInfo = {
  name: string | null;
  grade: string | null;
  class: string | null;
  birth_date: string | null;
};

export type WeeklyLearningSummary = {
  totalLearningTime: number; // 총 학습 시간 (분)
  completedPlans: number; // 완료된 플랜 수
  totalPlans: number; // 전체 플랜 수
  completionRate: number; // 완료율 (%)
  subjects: string[]; // 학습한 과목 목록
};

export type SubjectGradeTrend = {
  subject: string;
  recentGrades: Array<{
    test_date: string;
    grade: number;
    raw_score: number | null;
  }>;
  averageGrade: number;
  trend: "improving" | "declining" | "stable";
};

export type WeakSubjectAlert = {
  subject: string;
  risk_score: number;
  reason: string;
};

export type LearningStrategy = {
  subject: string;
  strategy: string;
  priority: "high" | "medium" | "low";
};

export type NextWeekSchedule = {
  date: string;
  dayOfWeek: string;
  plans: Array<{
    time: string;
    content: string;
    subject: string | null;
  }>;
};

export type ReportData = {
  studentInfo: StudentInfo;
  period: "weekly" | "monthly";
  periodLabel: string; // "2024년 1월 1주차" 형식
  weeklySummary: WeeklyLearningSummary;
  gradeTrends: SubjectGradeTrend[];
  weakSubjects: WeakSubjectAlert[];
  strategies: LearningStrategy[];
  nextWeekSchedule: NextWeekSchedule[];
};

// 학생 정보 조회
export async function fetchStudentInfo(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<StudentInfo> {
  try {
    const selectStudent = () =>
      supabase.from("students").select("name,grade,class,birth_date").eq("id", studentId);

    let { data, error } = await selectStudent();

    if (error && error.code === "42703") {
      ({ data, error } = await selectStudent());
    }

    if (error) throw error;

    const student = (data as StudentInfo[] | null)?.[0];
    return student ?? { name: null, grade: null, class: null, birth_date: null };
  } catch (error) {
    console.error("[reports] 학생 정보 조회 실패", error);
    return { name: null, grade: null, class: null, birth_date: null };
  }
}

// 주간 학습 요약
export async function fetchWeeklyLearningSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  startDate: Date,
  endDate: Date
): Promise<WeeklyLearningSummary> {
  try {
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,content_type,content_id,completed_amount,plan_date")
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    if (error) throw error;

    const planRows = (plans as Array<{
      id: string;
      content_type?: string | null;
      content_id?: string | null;
      completed_amount?: number | null;
      plan_date?: string | null;
    }> | null) ?? [];

    // 진행률 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress");

    let { data: progressData, error: progressError } = await selectProgress().eq(
      "student_id",
      studentId
    );

    if (progressError && progressError.code === "42703") {
      ({ data: progressData, error: progressError } = await selectProgress());
    }

    const progressMap = new Map<string, number>();
    (progressData as Array<{
      content_type?: string | null;
      content_id?: string | null;
      progress?: number | null;
    }> | null)?.forEach((p) => {
      if (p.content_type && p.content_id) {
        progressMap.set(`${p.content_type}:${p.content_id}`, p.progress ?? 0);
      }
    });

    // 콘텐츠 정보 조회 (과목 추출용)
    const [books, lectures, custom] = await Promise.all([
      supabase.from("books").select("id,subject").eq("student_id", studentId),
      supabase.from("lectures").select("id,subject").eq("student_id", studentId),
      supabase
        .from("student_custom_contents")
        .select("id,subject")
        .eq("student_id", studentId),
    ]);

    const contentSubjectMap = new Map<string, string | null>();

    (books.data ?? []).forEach((b: { id: string; subject?: string | null }) => {
      contentSubjectMap.set(`book:${b.id}`, b.subject ?? null);
    });
    (lectures.data ?? []).forEach((l: { id: string; subject?: string | null }) => {
      contentSubjectMap.set(`lecture:${l.id}`, l.subject ?? null);
    });
    (custom.data ?? []).forEach((c: { id: string; subject?: string | null }) => {
      contentSubjectMap.set(`custom:${c.id}`, c.subject ?? null);
    });

    const totalLearningTime = planRows.reduce((sum, plan) => {
      return sum + (plan.completed_amount ?? 0);
    }, 0);

    const completedPlans = planRows.filter((plan) => {
      const key = `${plan.content_type}:${plan.content_id}`;
      const progress = progressMap.get(key) ?? 0;
      return progress >= 100;
    }).length;

    const subjects = new Set<string>();
    planRows.forEach((plan) => {
      const key = `${plan.content_type}:${plan.content_id}`;
      const subject = contentSubjectMap.get(key);
      if (subject) subjects.add(subject);
    });

    return {
      totalLearningTime,
      completedPlans,
      totalPlans: planRows.length,
      completionRate: planRows.length > 0 ? (completedPlans / planRows.length) * 100 : 0,
      subjects: Array.from(subjects).sort(),
    };
  } catch (error) {
    console.error("[reports] 주간 학습 요약 조회 실패", error);
    return {
      totalLearningTime: 0,
      completedPlans: 0,
      totalPlans: 0,
      completionRate: 0,
      subjects: [],
    };
  }
}

// 과목별 성적 변화 추이
export async function fetchSubjectGradeTrends(
  supabase: SupabaseServerClient,
  studentId: string,
  startDate: Date,
  endDate: Date
): Promise<SubjectGradeTrend[]> {
  try {
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const selectScores = () =>
      supabase
        .from("student_scores")
        .select("course,course_detail,grade,raw_score,test_date")
        .gte("test_date", startDateStr)
        .lte("test_date", endDateStr)
        .order("test_date", { ascending: true });

    let { data: scores, error } = await selectScores().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: scores, error } = await selectScores());
    }

    if (error) throw error;

    const scoreRows = (scores as Array<{
      course?: string | null;
      course_detail?: string | null;
      grade?: number | null;
      raw_score?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

    // 과목별로 그룹화
    const subjectMap = new Map<string, Array<{
      test_date: string;
      grade: number;
      raw_score: number | null;
    }>>();

    scoreRows.forEach((score) => {
      if (!score.course || score.grade === null) return;
      const subject = score.course.toLowerCase().trim();
      const existing = subjectMap.get(subject) ?? [];
      existing.push({
        test_date: score.test_date ?? "",
        grade: score.grade ?? 0,
        raw_score: score.raw_score ?? null,
      });
      subjectMap.set(subject, existing);
    });

    const trends: SubjectGradeTrend[] = [];

    subjectMap.forEach((grades, subject) => {
      const sortedGrades = grades.sort((a, b) =>
        a.test_date.localeCompare(b.test_date)
      );

      const averageGrade =
        sortedGrades.length > 0
          ? sortedGrades.reduce((sum, g) => sum + g.grade, 0) / sortedGrades.length
          : 0;

      let trend: "improving" | "declining" | "stable" = "stable";
      if (sortedGrades.length >= 2) {
        const first = sortedGrades[0].grade;
        const last = sortedGrades[sortedGrades.length - 1].grade;
        if (last < first) {
          trend = "improving"; // 등급이 낮아짐 = 개선
        } else if (last > first) {
          trend = "declining"; // 등급이 높아짐 = 하락
        }
      }

      trends.push({
        subject,
        recentGrades: sortedGrades,
        averageGrade,
        trend,
      });
    });

    return trends.sort((a, b) => a.subject.localeCompare(b.subject));
  } catch (error) {
    console.error("[reports] 성적 추이 조회 실패", error);
    return [];
  }
}

// 취약과목 알림
export async function fetchWeakSubjects(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<WeakSubjectAlert[]> {
  try {
    const selectAnalysis = () =>
      supabase
        .from("student_analysis")
        .select("subject,risk_score")
        .gte("risk_score", 50)
        .order("risk_score", { ascending: false });

    let { data: analyses, error } = await selectAnalysis().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: analyses, error } = await selectAnalysis());
    }

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const analysisRows = (analyses as Array<{
      subject?: string | null;
      risk_score?: number | null;
    }> | null) ?? [];

    return analysisRows
      .filter((a) => a.subject && a.risk_score !== null)
      .map((a) => ({
        subject: a.subject!,
        risk_score: a.risk_score!,
        reason:
          a.risk_score! >= 70
            ? "매우 위험 - 즉시 집중 학습 필요"
            : a.risk_score! >= 50
            ? "위험 - 집중 학습 권장"
            : "주의 필요",
      }));
  } catch (error) {
    console.error("[reports] 취약과목 조회 실패", error);
    return [];
  }
}

// 추천 학습 전략
export function generateLearningStrategies(
  weakSubjects: WeakSubjectAlert[],
  gradeTrends: SubjectGradeTrend[]
): LearningStrategy[] {
  const strategies: LearningStrategy[] = [];

  weakSubjects.forEach((weak) => {
    const trend = gradeTrends.find((t) => t.subject === weak.subject);
    let strategy = "";
    let priority: "high" | "medium" | "low" = "medium";

    if (weak.risk_score >= 70) {
      priority = "high";
      strategy = "매우 위험한 과목입니다. 매일 최소 1시간 이상 집중 학습을 권장합니다.";
    } else if (weak.risk_score >= 50) {
      priority = "high";
      strategy = "위험한 과목입니다. 주 3-4회 정기적인 학습을 권장합니다.";
    } else {
      priority = "medium";
      strategy = "주의가 필요한 과목입니다. 주 2-3회 학습을 권장합니다.";
    }

    if (trend && trend.trend === "declining") {
      strategy += " 최근 성적이 하락하고 있어 더욱 집중이 필요합니다.";
      priority = "high";
    }

    strategies.push({
      subject: weak.subject,
      strategy,
      priority,
    });
  });

  // 성적이 개선되고 있는 과목도 포함
  gradeTrends
    .filter((t) => t.trend === "improving" && !weakSubjects.some((w) => w.subject === t.subject))
    .forEach((trend) => {
      strategies.push({
        subject: trend.subject,
        strategy: "성적이 개선되고 있습니다. 현재 학습 패턴을 유지하세요.",
        priority: "low",
      });
    });

  return strategies.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

// 다음주 학습 스케줄 요약
export async function fetchNextWeekSchedule(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<NextWeekSchedule[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(today.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

    const startDateStr = nextWeekStart.toISOString().slice(0, 10);
    const endDateStr = nextWeekEnd.toISOString().slice(0, 10);

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,block_index,content_type,content_id")
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr)
        .order("plan_date", { ascending: true })
        .order("block_index", { ascending: true });

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    if (error) throw error;

    const planRows = (plans as Array<{
      id: string;
      plan_date?: string | null;
      block_index?: number | null;
      content_type?: string | null;
      content_id?: string | null;
    }> | null) ?? [];

    // 블록 정보 조회
    const selectBlocks = () =>
      supabase
        .from("student_block_schedule")
        .select("day_of_week,block_index,start_time,end_time");

    let { data: blocks, error: blockError } = await selectBlocks().eq("student_id", studentId);

    if (blockError && blockError.code === "42703") {
      ({ data: blocks, error: blockError } = await selectBlocks());
    }

    const blockMap = new Map<string, { start_time: string | null; end_time: string | null }>();
    (blocks as Array<{
      day_of_week?: number | null;
      block_index?: number | null;
      start_time?: string | null;
      end_time?: string | null;
    }> | null)?.forEach((block) => {
      if (block.day_of_week !== null && block.block_index !== null) {
        const key = `${block.day_of_week}:${block.block_index}`;
        blockMap.set(key, {
          start_time: block.start_time ?? null,
          end_time: block.end_time ?? null,
        });
      }
    });

    // 콘텐츠 정보 조회
    const [books, lectures, custom] = await Promise.all([
      supabase.from("books").select("id,title,subject").eq("student_id", studentId),
      supabase.from("lectures").select("id,title,subject").eq("student_id", studentId),
      supabase
        .from("student_custom_contents")
        .select("id,title,subject")
        .eq("student_id", studentId),
    ]);

    const contentMap = new Map<string, { title: string; subject: string | null }>();

    (books.data ?? []).forEach((b: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`book:${b.id}`, {
        title: b.title ?? "제목 없음",
        subject: b.subject ?? null,
      });
    });
    (lectures.data ?? []).forEach((l: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`lecture:${l.id}`, {
        title: l.title ?? "제목 없음",
        subject: l.subject ?? null,
      });
    });
    (custom.data ?? []).forEach((c: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`custom:${c.id}`, {
        title: c.title ?? "제목 없음",
        subject: c.subject ?? null,
      });
    });

    // 날짜별로 그룹화
    const dateMap = new Map<string, NextWeekSchedule>();

    planRows.forEach((plan) => {
      if (!plan.plan_date) return;

      const planDate = new Date(plan.plan_date);
      const dayOfWeek = planDate.getDay();
      const blockIndex = plan.block_index ?? 1;

      const blockKey = `${dayOfWeek}:${blockIndex}`;
      const block = blockMap.get(blockKey);

      const contentKey = `${plan.content_type}:${plan.content_id}`;
      const content = contentMap.get(contentKey) ?? {
        title: "콘텐츠 정보 없음",
        subject: null,
      };

      const timeStr = block?.start_time && block?.end_time
        ? `${block.start_time.slice(0, 5)}-${block.end_time.slice(0, 5)}`
        : "시간 미정";

      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const dayName = dayNames[dayOfWeek];

      if (!dateMap.has(plan.plan_date)) {
        dateMap.set(plan.plan_date, {
          date: plan.plan_date,
          dayOfWeek: dayName,
          plans: [],
        });
      }

      const schedule = dateMap.get(plan.plan_date)!;
      schedule.plans.push({
        time: timeStr,
        content: content.title,
        subject: content.subject,
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("[reports] 다음주 스케줄 조회 실패", error);
    return [];
  }
}

// 리포트 데이터 수집
export async function collectReportData(
  supabase: SupabaseServerClient,
  studentId: string,
  period: "weekly" | "monthly"
): Promise<ReportData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate: Date;
  let endDate: Date;
  let periodLabel: string;

  if (period === "weekly") {
    // 이번 주 (월요일부터)
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate = new Date(today);
    startDate.setDate(today.getDate() + mondayOffset);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const weekNumber = Math.ceil((startDate.getDate() + (7 - startDate.getDay())) / 7);
    periodLabel = `${year}년 ${month}월 ${weekNumber}주차`;
  } else {
    // 이번 달
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    periodLabel = `${year}년 ${month}월`;
  }

  const [studentInfo, weeklySummary, gradeTrends, weakSubjects, nextWeekSchedule] =
    await Promise.all([
      fetchStudentInfo(supabase, studentId),
      fetchWeeklyLearningSummary(supabase, studentId, startDate, endDate),
      fetchSubjectGradeTrends(supabase, studentId, startDate, endDate),
      fetchWeakSubjects(supabase, studentId),
      fetchNextWeekSchedule(supabase, studentId),
    ]);

  const strategies = generateLearningStrategies(weakSubjects, gradeTrends);

  return {
    studentInfo,
    period,
    periodLabel,
    weeklySummary,
    gradeTrends,
    weakSubjects,
    strategies,
    nextWeekSchedule,
  };
}

