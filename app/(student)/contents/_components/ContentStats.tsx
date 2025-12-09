import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContentStatsProps = {
  studentId: string;
};

export async function ContentStats({ studentId }: ContentStatsProps) {
  const supabase = await createSupabaseServerClient();

  // 교재 통계
  const { count: bookCount } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  // 강의 통계
  const { count: lectureCount } = await supabase
    .from("lectures")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  // 연결된 교재가 있는 강의 수
  const { count: linkedLectureCount } = await supabase
    .from("lectures")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .not("linked_book_id", "is", null);

  // 커스텀 콘텐츠 통계
  const { count: customContentCount } = await supabase
    .from("student_custom_contents")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <span className="text-2xl">📚</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">총 교재</p>
            <p className="text-2xl font-semibold text-gray-900">
              {bookCount ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <span className="text-2xl">🎧</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">총 강의</p>
            <p className="text-2xl font-semibold text-gray-900">
              {lectureCount ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <span className="text-2xl">📝</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">커스텀 콘텐츠</p>
            <p className="text-2xl font-semibold text-gray-900">
              {customContentCount ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2">
            <span className="text-2xl">🔗</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">연결된 교재</p>
            <p className="text-2xl font-semibold text-gray-900">
              {linkedLectureCount ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

