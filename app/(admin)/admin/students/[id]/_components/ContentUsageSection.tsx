import { getStudentContentUsageForAdmin } from "@/lib/data/admin/studentData";
import { StatCard } from "@/components/molecules/StatCard";
import ProgressBar from "@/components/atoms/ProgressBar";

const contentTypeLabels: Record<string, string> = {
  book: "책",
  lecture: "강의",
  custom: "커스텀",
};

export async function ContentUsageSection({ studentId }: { studentId: string }) {
  try {
    const contentUsage = await getStudentContentUsageForAdmin(studentId);

    const allContents = [
      ...contentUsage.books.map((b) => ({
        ...b,
        type: "book" as const,
        key: `book:${b.id}`,
      })),
      ...contentUsage.lectures.map((l) => ({
        ...l,
        type: "lecture" as const,
        key: `lecture:${l.id}`,
      })),
      ...contentUsage.customContents.map((c) => ({
        ...c,
        type: "custom" as const,
        key: `custom:${c.id}`,
      })),
    ];

    // 진행률이 있는 콘텐츠만 필터링
    const contentsWithProgress = allContents
      .map((content) => {
        const progress = contentUsage.progressMap.get(content.key);
        return {
          ...content,
          progress: progress?.progress ?? 0,
          completedAmount: progress?.completedAmount ?? 0,
        };
      })
      .filter((c) => c.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-gray-900">콘텐츠 사용 현황</h2>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="책"
              value={`${contentUsage.books.length}개`}
              color="blue"
            />
            <StatCard
              label="강의"
              value={`${contentUsage.lectures.length}개`}
              color="purple"
            />
            <StatCard
              label="커스텀"
              value={`${contentUsage.customContents.length}개`}
              color="emerald"
            />
          </div>

          {/* 진행 중인 콘텐츠 */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700">진행 중인 콘텐츠 (상위 10개)</h3>
            {contentsWithProgress.length === 0 ? (
              <p className="text-sm text-gray-500">진행 중인 콘텐츠가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {contentsWithProgress.map((content) => (
                  <div
                    key={content.key}
                    className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {contentTypeLabels[content.type] ?? content.type}
                          </span>
                          <span className="font-medium text-gray-900">{content.title}</span>
                          {content.subject && (
                            <span className="text-xs text-gray-500">· {content.subject}</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {content.progress}%
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(100, content.progress)}
                        max={100}
                        color="indigo"
                        height="sm"
                      />
                      {content.completedAmount > 0 && (
                        <div className="text-xs text-gray-500">
                          완료량: {content.completedAmount}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("[ContentUsageSection] 콘텐츠 사용 현황 조회 실패", error);
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">
          콘텐츠 사용 현황 정보를 불러오는 중 오류가 발생했습니다.
        </p>
      </div>
    );
  }
}

