import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { getActiveGoals } from "@/lib/goals/queries";
import { getSubjectFromContent } from "@/lib/studySessions/summary";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ContentProgress = {
  id: string;
  contentType: "book" | "lecture" | "custom";
  title: string;
  subject: string | null;
  total: number | null;
  progress: number | null;
  progressPercent: number;
  lastUsedDate: string | null;
};

// Supabase 쿼리 결과 타입
type ProgressRow = {
  content_type: string;
  content_id: string;
  progress: number | null;
};

type BookRow = {
  id: string;
  title: string;
  subject: string | null;
  total_pages: number | null;
};

type LectureRow = {
  id: string;
  title: string;
  subject: string | null;
  duration: number | null;
};

type CustomContentRow = {
  id: string;
  title: string;
  subject: string | null;
  total_page_or_time: number | null;
};

/**
 * 콘텐츠(책/강의/커스텀) 추천 생성
 * - 콘텐츠별 진행률
 * - 최근 사용 기록
 * - 목표와 콘텐츠 매칭
 */
export async function getContentRecommendations(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    // 최근 2주 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // 진행률 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress")
        .eq("student_id", studentId);

    let { data: progressRows } = await selectProgress();
    if (!progressRows) {
      ({ data: progressRows } = await selectProgress());
    }

    const progressMap = new Map<string, number | null>();
    (progressRows || []).forEach((row: ProgressRow) => {
      const key = `${row.content_type}:${row.content_id}`;
      progressMap.set(key, row.progress);
    });

    // 최근 세션 조회 (사용 기록 확인)
    const sessions = await getSessionsByDateRange(
      supabase,
      studentId,
      twoWeeksAgoStr,
      todayStr
    );

    const contentLastUsed = new Map<string, string>();
    sessions.forEach((session) => {
      if (session.content_type && session.content_id) {
        const key = `${session.content_type}:${session.content_id}`;
        const sessionDate = session.started_at
          ? new Date(session.started_at).toISOString().slice(0, 10)
          : null;
        if (sessionDate) {
          const existing = contentLastUsed.get(key);
          if (!existing || sessionDate > existing) {
            contentLastUsed.set(key, sessionDate);
          }
        }
      }
    });

    // 콘텐츠 목록 조회 및 진행률 계산
    const contents: ContentProgress[] = [];

    // 책 조회
    const selectBooks = () =>
      supabase
        .from("books")
        .select("id,title,subject,total_pages")
        .eq("student_id", studentId);

    let { data: books } = await selectBooks();
    if (!books) {
      ({ data: books } = await selectBooks());
    }

    (books || []).forEach((book: BookRow) => {
      const key = `book:${book.id}`;
      const progressValue = progressMap.get(key);
      // progress는 percentage일 수도 있고 amount일 수도 있음
      // total_pages가 있으면 amount로 가정, 없으면 percentage로 가정
      const total = book.total_pages || null;
      let progress: number | null = null;
      let progressPercent = 0;
      
      if (progressValue !== null && progressValue !== undefined) {
        if (total && total > 0) {
          // progress가 amount인 경우
          progress = progressValue;
          progressPercent = (progressValue / total) * 100;
        } else {
          // progress가 percentage인 경우
          progressPercent = progressValue;
          progress = null;
        }
      }
      
      contents.push({
        id: book.id,
        contentType: "book",
        title: book.title,
        subject: book.subject,
        total,
        progress,
        progressPercent,
        lastUsedDate: contentLastUsed.get(key) || null,
      });
    });

    // 강의 조회
    const selectLectures = () =>
      supabase
        .from("lectures")
        .select("id,title,subject,duration")
        .eq("student_id", studentId);

    let { data: lectures } = await selectLectures();
    if (!lectures) {
      ({ data: lectures } = await selectLectures());
    }

    (lectures || []).forEach((lecture: LectureRow) => {
      const key = `lecture:${lecture.id}`;
      const progressValue = progressMap.get(key);
      const total = lecture.duration || null;
      let progress: number | null = null;
      let progressPercent = 0;
      
      if (progressValue !== null && progressValue !== undefined) {
        if (total && total > 0) {
          progress = progressValue;
          progressPercent = (progressValue / total) * 100;
        } else {
          progressPercent = progressValue;
          progress = null;
        }
      }
      
      contents.push({
        id: lecture.id,
        contentType: "lecture",
        title: lecture.title,
        subject: lecture.subject,
        total,
        progress,
        progressPercent,
        lastUsedDate: contentLastUsed.get(key) || null,
      });
    });

    // 커스텀 콘텐츠 조회
    const selectCustom = () =>
      supabase
        .from("student_custom_contents")
        .select("id,title,subject,total_page_or_time")
        .eq("student_id", studentId);

    let { data: customContents } = await selectCustom();
    if (!customContents) {
      ({ data: customContents } = await selectCustom());
    }

    (customContents || []).forEach((custom: CustomContentRow) => {
      const key = `custom:${custom.id}`;
      const progressValue = progressMap.get(key);
      const total = custom.total_page_or_time || null;
      let progress: number | null = null;
      let progressPercent = 0;
      
      if (progressValue !== null && progressValue !== undefined) {
        if (total && total > 0) {
          progress = progressValue;
          progressPercent = (progressValue / total) * 100;
        } else {
          progressPercent = progressValue;
          progress = null;
        }
      }
      
      contents.push({
        id: custom.id,
        contentType: "custom",
        title: custom.title,
        subject: custom.subject,
        total,
        progress,
        progressPercent,
        lastUsedDate: contentLastUsed.get(key) || null,
      });
    });

    // 활성 목표 조회
    const activeGoals = await getActiveGoals(supabase, studentId, todayStr);
    const goalsBySubject = new Set(
      activeGoals.map((g) => g.subject).filter((s): s is string => s !== null)
    );

    // Rule 1: 50% 미만 진행 중인 콘텐츠 → '꾸준히 진행' 추천
    const lowProgressContents = contents.filter(
      (c) => c.progressPercent > 0 && c.progressPercent < 50 && c.total !== null
    );

    for (const content of lowProgressContents.slice(0, 3)) {
      const contentTypeLabel =
        content.contentType === "book"
          ? "교재"
          : content.contentType === "lecture"
          ? "강의"
          : "콘텐츠";
      recommendations.push(
        `${contentTypeLabel} "${content.title}"은 ${Math.round(content.progressPercent)}% 진행되었습니다. 이번주에 ${Math.round(content.progressPercent + 10)}%까지 끌어올리는 것을 추천합니다.`
      );
    }

    // Rule 2: 최근 사용 0인 콘텐츠 → '재활성화' 추천
    const unusedContents = contents.filter(
      (c) => !c.lastUsedDate || new Date(c.lastUsedDate) < twoWeeksAgo
    );

    for (const content of unusedContents.slice(0, 2)) {
      const contentTypeLabel =
        content.contentType === "book"
          ? "교재"
          : content.contentType === "lecture"
          ? "강의"
          : "콘텐츠";
      recommendations.push(
        `${contentTypeLabel} "${content.title}"은 최근 2주 동안 사용 기록이 없습니다. 주 1회라도 학습해보세요.`
      );
    }

    // Rule 3: 목표 대비 콘텐츠 매칭 안 됨 → '콘텐츠 등록/연결' 추천
    for (const goal of activeGoals) {
      if (!goal.subject) continue;

      // 해당 과목의 콘텐츠가 있는지 확인
      const hasContentForSubject = contents.some(
        (c) => c.subject === goal.subject && c.progressPercent > 0
      );

      if (!hasContentForSubject) {
        recommendations.push(
          `목표 "${goal.title}"과 관련된 콘텐츠가 선택되지 않았습니다. 관련 교재 또는 강의를 등록하세요.`
        );
      }
    }

    // Rule 4: 진행률이 높은데 멈춘 콘텐츠
    const highProgressStopped = contents.filter(
      (c) =>
        c.progressPercent >= 50 &&
        c.progressPercent < 100 &&
        (!c.lastUsedDate || new Date(c.lastUsedDate) < twoWeeksAgo)
    );

    for (const content of highProgressStopped.slice(0, 2)) {
      const contentTypeLabel =
        content.contentType === "book"
          ? "교재"
          : content.contentType === "lecture"
          ? "강의"
          : "콘텐츠";
      recommendations.push(
        `${contentTypeLabel} "${content.title}"은 ${Math.round(content.progressPercent)}% 진행되었지만 최근 사용하지 않았습니다. 완주를 위해 다시 시작하세요.`
      );
    }

    return recommendations;
  } catch (error) {
    console.error("[recommendations/content] 콘텐츠 추천 생성 실패", error);
    return [];
  }
}

