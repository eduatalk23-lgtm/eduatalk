
import { WizardData } from "../PlanGroupWizard";
import { ContentInfo } from "./types";

type SubjectAllocationUIProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contentInfos: ContentInfo[];
};

export function SubjectAllocationUI({
  data,
  onUpdate,
  contentInfos,
}: SubjectAllocationUIProps) {
  // 과목 추출
  const allSubjects = new Set<string>();
  contentInfos.forEach((content) => {
    if (content.subject_category) {
      allSubjects.add(content.subject_category);
    }
  });
  const subjects = Array.from(allSubjects).sort();

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠의 과목 정보가 없습니다.</p>
      </div>
    );
  }

  const handleSubjectAllocationChange = (
    subject: string,
    allocation: {
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    const currentAllocations = data.subject_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) => a.subject_name !== subject
    );
    updatedAllocations.push(allocation);
    onUpdate({ subject_allocations: updatedAllocations });
  };

  return (
    <div className="space-y-4">
      {subjects.map((subject) => {
        const existingAllocation = (data.subject_allocations || []).find(
          (a) => a.subject_name === subject
        );
        const subjectType = existingAllocation?.subject_type || "weakness";
        const weeklyDays = existingAllocation?.weekly_days || 3;

        const subjectContentCount = contentInfos.filter(
          (c) => c.subject_category === subject
        ).length;

        return (
          <div
            key={subject}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{subject}</h3>
              <span className="text-xs text-gray-600">
                {subjectContentCount}개 콘텐츠
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-gray-600">
                  과목 유형
                </label>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                    <input
                      type="radio"
                      name={`subject_type_${subject}`}
                      value="weakness"
                      checked={subjectType === "weakness"}
                      onChange={() => {
                        handleSubjectAllocationChange(subject, {
                          subject_id: subject
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                          subject_name: subject,
                          subject_type: "weakness",
                        });
                      }}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        취약과목
                      </div>
                      <div className="text-xs text-gray-600">
                        전체 학습일에 플랜 배정
                      </div>
                    </div>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                    <input
                      type="radio"
                      name={`subject_type_${subject}`}
                      value="strategy"
                      checked={subjectType === "strategy"}
                      onChange={() => {
                        handleSubjectAllocationChange(subject, {
                          subject_id: subject
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                          subject_name: subject,
                          subject_type: "strategy",
                          weekly_days: 3,
                        });
                      }}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        전략과목
                      </div>
                      <div className="text-xs text-gray-600">
                        주당 배정 일수에 따라 배정
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {subjectType === "strategy" && (
                <div className="flex flex-col gap-2">
                  <label className="block text-xs font-medium text-gray-600">
                    주당 배정 일수
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    value={weeklyDays}
                    onChange={(e) => {
                      handleSubjectAllocationChange(subject, {
                        subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                        subject_name: subject,
                        subject_type: "strategy",
                        weekly_days: Number(e.target.value),
                      });
                    }}
                  >
                    <option value="2">주 2일</option>
                    <option value="3">주 3일</option>
                    <option value="4">주 4일</option>
                  </select>
                  <p className="text-xs text-gray-600">
                    선택한 주당 일수에 따라 학습일에 균등하게 배정됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
