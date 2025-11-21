import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule } from "@/lib/types/plan";

const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
};

type Step6DetailViewProps = {
  group: PlanGroup;
  contents: Array<PlanContent & {
    contentTitle: string;
    contentSubtitle: string | null;
    isRecommended: boolean;
  }>;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
};

export function Step6DetailView({
  group,
  contents,
  exclusions,
  academySchedules,
}: Step6DetailViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">최종 검토</h2>
        <p className="mt-1 text-sm text-gray-500">
          플랜 그룹의 모든 설정을 최종 확인할 수 있습니다.
        </p>
      </div>

      {/* 기본 정보 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">기본 정보</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">플랜 그룹 이름</dt>
            <dd className="mt-1 text-sm text-gray-900">{group.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">플랜 목적</dt>
            <dd className="mt-1 text-sm text-gray-900">{group.plan_purpose || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">기간</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {group.period_start && group.period_end
                ? `${new Date(group.period_start).toLocaleDateString("ko-KR")} ~ ${new Date(group.period_end).toLocaleDateString("ko-KR")}`
                : "—"}
            </dd>
          </div>
        </div>
      </div>

      {/* 콘텐츠 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">학습 대상 콘텐츠</h3>
        <p className="mb-4 text-sm text-gray-600">
          총 {contents.length}개의 콘텐츠가 선택되었습니다.
        </p>
        <div className="space-y-2">
          {contents.map((content) => (
            <div
              key={content.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{contentTypeLabels[content.content_type]}</span>
                <span className="text-sm font-medium text-gray-900">
                  {content.contentTitle}
                </span>
                {content.isRecommended && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    추천
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-600">
                {content.start_range} ~ {content.end_range}
                {content.content_type === "book" && "p"}
                {content.content_type === "lecture" && "강"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 제외일 및 학원 일정 요약 */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">학습 제외일</h3>
          <p className="text-sm text-gray-600">
            {exclusions.length > 0 ? `${exclusions.length}일` : "없음"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">학원 일정</h3>
          <p className="text-sm text-gray-600">
            {academySchedules.length > 0 ? `${academySchedules.length}개` : "없음"}
          </p>
        </div>
      </div>
    </div>
  );
}

