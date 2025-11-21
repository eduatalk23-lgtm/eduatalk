export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { StudentSelector } from "../_components/StudentSelector";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

type HistoryEvent = {
  id: string;
  event_type: string;
  detail: any;
  created_at: string;
};

const eventTypeLabels: Record<string, string> = {
  plan_completed: "플랜 완료",
  study_session: "학습 세션",
  goal_progress: "목표 진행",
  goal_created: "목표 생성",
  goal_completed: "목표 완료",
  score_added: "성적 입력",
  score_updated: "성적 수정",
  content_progress: "콘텐츠 진행",
  auto_schedule_generated: "자동 스케줄 생성",
};

export default async function ParentHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900 mb-2">
            연결된 자녀가 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/history");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 히스토리 조회 (최근 50개)
  const selectHistory = () =>
    supabase
      .from("student_history")
      .select("id, event_type, detail, created_at")
      .eq("student_id", selectedStudentId)
      .order("created_at", { ascending: false })
      .limit(50);

  let { data: historyData, error } = await selectHistory();

  if (error && error.code === "42703") {
    ({ data: historyData, error } = await selectHistory());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[parent/history] 히스토리 조회 실패", error);
  }

  const historyEvents = (historyData as HistoryEvent[] | null) ?? [];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">학습 활동 이력</h1>
          <p className="mt-1 text-sm text-gray-500">
            자녀의 최근 학습 활동을 확인하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          대시보드로 돌아가기
        </Link>
      </div>

      {/* 학생 선택 */}
      <div className="mb-6">
        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />
      </div>

      {historyEvents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">기록된 활동이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            최근 활동 요약
          </h2>
          <div className="space-y-3">
            {historyEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {eventTypeLabels[event.event_type] || event.event_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {event.detail && typeof event.detail === "object" && (
                    <div className="text-xs text-gray-600">
                      {JSON.stringify(event.detail, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

