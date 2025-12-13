
import { WizardData } from "../PlanGroupWizard";
import { ContentInfo } from "./types";

type ContentAllocationUIProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contentInfos: ContentInfo[];
};

export function ContentAllocationUI({
  data,
  onUpdate,
  contentInfos,
}: ContentAllocationUIProps) {
  // 교과별로 콘텐츠 그룹화
  const contentsBySubject = new Map<string, typeof contentInfos>();
  contentInfos.forEach((content) => {
    if (content.subject_category) {
      if (!contentsBySubject.has(content.subject_category)) {
        contentsBySubject.set(content.subject_category, []);
      }
      contentsBySubject.get(content.subject_category)!.push(content);
    }
  });

  const subjects = Array.from(contentsBySubject.keys()).sort();

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠의 과목 정보가 없습니다.</p>
      </div>
    );
  }

  const handleContentAllocationChange = (
    content: { content_type: string; content_id: string },
    allocation: {
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    const currentAllocations = data.content_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) =>
        !(
          a.content_type === content.content_type &&
          a.content_id === content.content_id
        )
    );
    updatedAllocations.push({
      content_type: content.content_type as "book" | "lecture",
      content_id: content.content_id,
      subject_type: allocation.subject_type,
      weekly_days: allocation.weekly_days,
    });
    onUpdate({ content_allocations: updatedAllocations });
  };

  // 폴백 메커니즘: content_allocations → subject_allocations → default
  const getEffectiveAllocation = (content: (typeof contentInfos)[0]) => {
    // 1순위: 콘텐츠별 설정
    const contentAlloc = (data.content_allocations || []).find(
      (a) =>
        a.content_type === content.content_type &&
        a.content_id === content.content_id
    );
    if (contentAlloc) {
      return {
        subject_type: contentAlloc.subject_type,
        weekly_days: contentAlloc.weekly_days,
        source: "content" as const,
      };
    }

    // 2순위: 교과별 설정 (폴백)
    if (content.subject_category) {
      const subjectAlloc = (data.subject_allocations || []).find(
        (a) => a.subject_name === content.subject_category
      );
      if (subjectAlloc) {
        return {
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
          source: "subject" as const,
        };
      }
    }

    // 3순위: 기본값
    return {
      subject_type: "weakness" as const,
      weekly_days: undefined,
      source: "default" as const,
    };
  };

  return (
    <div className="space-y-6">
      {subjects.map((subject) => {
        const contents = contentsBySubject.get(subject) || [];

        return (
          <div
            key={subject}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {subject}
            </h3>
            <div className="space-y-3">
              {contents.map((content) => {
                const effectiveAlloc = getEffectiveAllocation(content);
                const subjectType = effectiveAlloc.subject_type;
                const weeklyDays = effectiveAlloc.weekly_days || 3;
                const source = effectiveAlloc.source;

                return (
                  <div
                    key={`${content.content_type}-${content.content_id}`}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {content.content_type === "book" ? "📚" : "🎧"}{" "}
                          {content.title}
                        </div>
                        {source !== "content" && (
                          <div className="text-xs text-gray-600">
                            {source === "subject" && "교과별 설정 적용 중"}
                            {source === "default" && "기본값 (취약과목)"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`content_type_${content.content_type}_${content.content_id}`}
                            value="weakness"
                            checked={subjectType === "weakness"}
                            onChange={() => {
                              handleContentAllocationChange(content, {
                                subject_type: "weakness",
                              });
                            }}
                            className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-900">취약과목</span>
                        </label>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`content_type_${content.content_type}_${content.content_id}`}
                            value="strategy"
                            checked={subjectType === "strategy"}
                            onChange={() => {
                              handleContentAllocationChange(content, {
                                subject_type: "strategy",
                                weekly_days: 3,
                              });
                            }}
                            className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-900">전략과목</span>
                        </label>
                      </div>

                      {subjectType === "strategy" && (
                        <div>
                          <select
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                            value={weeklyDays}
                            onChange={(e) => {
                              handleContentAllocationChange(content, {
                                subject_type: "strategy",
                                weekly_days: Number(e.target.value),
                              });
                            }}
                          >
                            <option value="2">주 2일</option>
                            <option value="3">주 3일</option>
                            <option value="4">주 4일</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 설정 요약 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <h4 className="mb-2 text-xs font-semibold text-blue-800">설정 요약</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• 콘텐츠별 설정: {(data.content_allocations || []).length}개</p>
          <p>
            • 교과별 설정 (폴백): {(data.subject_allocations || []).length}개
          </p>
          <p className="text-blue-800">
            콘텐츠별 설정이 우선 적용되며, 설정되지 않은 콘텐츠는 교과별 설정을
            따릅니다.
          </p>
        </div>
      </div>
    </div>
  );
}
