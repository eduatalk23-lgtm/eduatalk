import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ProgressRow = {
  content_type?: string | null;
  content_id?: string | null;
  progress?: number | null;
};

export async function ContentProgressSection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();

  // 진행률 조회
  const selectProgress = () =>
    supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress")
      .order("progress", { ascending: false })
      .limit(10);

  let { data: progressData, error } = await selectProgress().eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ data: progressData, error } = await selectProgress());
  }

  const progressRows = (progressData as ProgressRow[] | null) ?? [];

  // 콘텐츠 정보 조회
  const contentMap = new Map<string, { title: string; subject: string | null }>();

  for (const progress of progressRows) {
    if (!progress.content_type || !progress.content_id) continue;
    const key = `${progress.content_type}:${progress.content_id}`;

    try {
      const tableName =
        progress.content_type === "book"
          ? "books"
          : progress.content_type === "lecture"
          ? "lectures"
          : "student_custom_contents";

      const { data: content } = await supabase
        .from(tableName)
        .select("title,subject")
        .eq("id", progress.content_id)
        .eq("student_id", studentId)
        .maybeSingle();

      if (content) {
        contentMap.set(key, {
          title: (content as { title?: string | null }).title ?? "제목 없음",
          subject: (content as { subject?: string | null }).subject ?? null,
        });
      }
    } catch (error) {
      console.error(`[admin/students] 콘텐츠 정보 조회 실패 (${key})`, error);
    }
  }

  const contentTypeLabels: Record<string, string> = {
    book: "책",
    lecture: "강의",
    custom: "커스텀",
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">콘텐츠 진행 요약</h2>
      {progressRows.length === 0 ? (
        <p className="text-sm text-gray-500">진행 중인 콘텐츠가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {progressRows.map((progress, index) => {
            if (!progress.content_type || !progress.content_id) return null;
            const key = `${progress.content_type}:${progress.content_id}`;
            const contentInfo = contentMap.get(key) ?? { title: "제목 없음", subject: null };

            return (
              <div key={index} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{contentInfo.title}</div>
                    <div className="text-xs text-gray-500">
                      {contentTypeLabels[progress.content_type] ?? progress.content_type}
                      {contentInfo.subject ? ` · ${contentInfo.subject}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {progress.progress ?? 0}%
                  </div>
                </div>
                <ProgressBar
                  value={progress.progress ?? 0}
                  max={100}
                  color="indigo"
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

