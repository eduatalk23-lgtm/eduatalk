
import { WizardData } from "../PlanGroupWizard";
import { ContentInfo } from "./types";

type ComparisonTableProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contentInfos: ContentInfo[];
  recommendedRanges: Map<
    string,
    { start: number; end: number; reason: string }
  >;
};

export function ComparisonTable({
  data,
  onUpdate,
  contentInfos,
  recommendedRanges,
}: ComparisonTableProps) {
  if (recommendedRanges.size === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">학습 범위 비교</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // 과목별 적용을 위한 과목 목록 추출
              const subjects = Array.from(
                new Set(
                  contentInfos
                    .map((c) => c.subject_category)
                    .filter((s): s is string => !!s)
                )
              );
              if (subjects.length === 0) {
                alert("과목별 적용할 과목이 없습니다.");
                return;
              }
              const selectedSubject = prompt(
                `적용할 과목을 선택하세요:\n${subjects
                  .map((s, i) => `${i + 1}. ${s}`)
                  .join("\n")}\n\n번호를 입력하세요:`
              );
              if (!selectedSubject) return;
              const subjectIndex = parseInt(selectedSubject) - 1;
              if (
                isNaN(subjectIndex) ||
                subjectIndex < 0 ||
                subjectIndex >= subjects.length
              ) {
                alert("올바른 번호를 입력해주세요.");
                return;
              }
              const targetSubject = subjects[subjectIndex];

              // 해당 과목의 콘텐츠만 추천 범위 적용
              const updatedStudent = [...data.student_contents];
              const updatedRecommended = [...data.recommended_contents];

              // contentKey 매핑 생성 (최적화)
              const contentKeyMap = new Map<
                string,
                { type: "student" | "recommended"; index: number }
              >();
              data.student_contents.forEach((c, idx) => {
                contentKeyMap.set(c.content_id, {
                  type: "student",
                  index: idx,
                });
              });
              data.recommended_contents.forEach((c, idx) => {
                contentKeyMap.set(c.content_id, {
                  type: "recommended",
                  index: idx,
                });
              });

              contentInfos.forEach((info) => {
                if (info.subject_category !== targetSubject) return;

                const mapping = contentKeyMap.get(info.content_id);
                if (!mapping) return;

                const contentKey = `${mapping.type}-${mapping.index}`;
                const recommended = recommendedRanges.get(contentKey);
                if (!recommended) return;

                if (mapping.type === "recommended") {
                  updatedRecommended[mapping.index] = {
                    ...updatedRecommended[mapping.index],
                    start_range: recommended.start,
                    end_range: recommended.end,
                  };
                } else {
                  updatedStudent[mapping.index] = {
                    ...updatedStudent[mapping.index],
                    start_range: recommended.start,
                    end_range: recommended.end,
                  };
                }
              });

              onUpdate({
                student_contents: updatedStudent,
                recommended_contents: updatedRecommended,
              });
            }}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            과목별 적용
          </button>
          <button
            type="button"
            onClick={() => {
              // 전체 추천 범위 일괄 적용
              const updatedStudent = [...data.student_contents];
              const updatedRecommended = [...data.recommended_contents];

              // contentKey 매핑 생성 (최적화)
              const contentKeyMap = new Map<
                string,
                { type: "student" | "recommended"; index: number }
              >();
              data.student_contents.forEach((c, idx) => {
                contentKeyMap.set(c.content_id, {
                  type: "student",
                  index: idx,
                });
              });
              data.recommended_contents.forEach((c, idx) => {
                contentKeyMap.set(c.content_id, {
                  type: "recommended",
                  index: idx,
                });
              });

              contentInfos.forEach((info) => {
                const mapping = contentKeyMap.get(info.content_id);
                if (!mapping) return;

                const contentKey = `${mapping.type}-${mapping.index}`;
                const recommended = recommendedRanges.get(contentKey);
                if (!recommended) return;

                if (mapping.type === "recommended") {
                  updatedRecommended[mapping.index] = {
                    ...updatedRecommended[mapping.index],
                    start_range: recommended.start,
                    end_range: recommended.end,
                  };
                } else {
                  updatedStudent[mapping.index] = {
                    ...updatedStudent[mapping.index],
                    start_range: recommended.start,
                    end_range: recommended.end,
                  };
                }
              });

              onUpdate({
                student_contents: updatedStudent,
                recommended_contents: updatedRecommended,
              });
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            전체 적용
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-800">
                콘텐츠
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-800">
                학생 지정
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-800">
                추천 범위
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-800">
                차이
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-800">
                적용
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // contentKey와 content 매핑을 미리 생성 (최적화)
              const contentKeyMap = new Map<string, string>();
              const contentMap = new Map<
                string,
                | (typeof data.student_contents)[0]
                | (typeof data.recommended_contents)[0]
              >();

              data.student_contents.forEach((c, idx) => {
                const key = `student-${idx}`;
                const mapKey = `${c.content_id}:student`;
                contentKeyMap.set(mapKey, key);
                contentMap.set(key, c);
              });

              data.recommended_contents.forEach((c, idx) => {
                const key = `recommended-${idx}`;
                const mapKey = `${c.content_id}:recommended`;
                contentKeyMap.set(mapKey, key);
                contentMap.set(key, c);
              });

              return contentInfos.map((info, idx) => {
                const mapKey = `${info.content_id}:${
                  info.isRecommended ? "recommended" : "student"
                }`;
                const contentKey = contentKeyMap.get(mapKey);
                if (!contentKey) return null;

                const content = contentMap.get(contentKey);
                if (!content) return null;

                const recommended = recommendedRanges.get(contentKey);
                const studentRange = content.end_range - content.start_range + 1;
                const recommendedRange = recommended
                  ? recommended.end - recommended.start + 1
                  : null;
                const difference =
                  recommendedRange !== null
                    ? studentRange - recommendedRange
                    : null;
                const isOver = difference !== null && difference > 0;
                const isUnder = difference !== null && difference < 0;

                const uniqueKey = `${contentKey}-${idx}`;

                return (
                  <tr key={uniqueKey} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900">
                              {info.title}
                            </div>
                            {info.isRecommended ? (
                              <>
                                {info.is_auto_recommended ? (
                                  <span
                                    className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800"
                                    title={
                                      info.recommendation_reason ||
                                      "자동 추천된 콘텐츠"
                                    }
                                  >
                                    🤖 자동 추천
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                                    추천 콘텐츠
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                                학생 콘텐츠
                              </span>
                            )}
                          </div>
                          {info.is_auto_recommended &&
                            info.recommendation_reason && (
                              <div className="text-xs text-purple-600">
                                💡 {info.recommendation_reason}
                              </div>
                            )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            {info.content_type === "book" && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                                📚 교재
                              </span>
                            )}
                            {info.content_type === "lecture" && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                                🎧 강의
                              </span>
                            )}
                            {info.subject && (
                              <>
                                <span>·</span>
                                <span>{info.subject}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-900">
                      <div>{studentRange}</div>
                      <div className="text-[10px] text-gray-500">
                        ({content.start_range} ~ {content.end_range})
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-900">
                      {recommended ? (
                        <>
                          <div>{recommendedRange}</div>
                          <div className="text-[10px] text-gray-500">
                            ({recommended.start} ~ {recommended.end})
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {difference !== null && difference !== 0 ? (
                        <span
                          className={
                            isOver
                              ? "text-red-600"
                              : isUnder
                              ? "text-green-600"
                              : "text-gray-600"
                          }
                        >
                          {difference > 0 ? "+" : ""}
                          {difference}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {recommended ? (
                        <button
                          type="button"
                          onClick={() => {
                            // 개별 적용
                            if (info.isRecommended) {
                              const updated = [...data.recommended_contents];
                              const idx = data.recommended_contents.findIndex(
                                (c) => c.content_id === info.content_id
                              );
                              if (idx !== -1) {
                                updated[idx] = {
                                  ...updated[idx],
                                  start_range: recommended.start,
                                  end_range: recommended.end,
                                };
                                onUpdate({ recommended_contents: updated });
                              }
                            } else {
                              const updated = [...data.student_contents];
                              const idx = data.student_contents.findIndex(
                                (c) => c.content_id === info.content_id
                              );
                              if (idx !== -1) {
                                updated[idx] = {
                                  ...updated[idx],
                                  start_range: recommended.start,
                                  end_range: recommended.end,
                                };
                                onUpdate({ student_contents: updated });
                              }
                            }
                          }}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          적용
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
