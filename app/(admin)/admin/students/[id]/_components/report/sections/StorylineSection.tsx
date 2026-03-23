import type { StorylineTabData } from "@/lib/domains/student-record/types";

const STRENGTH_BADGE: Record<string, { label: string; color: string }> = {
  strong: { label: "강", color: "text-emerald-700 bg-emerald-50" },
  moderate: { label: "중", color: "text-amber-700 bg-amber-50" },
  weak: { label: "약", color: "text-red-600 bg-red-50" },
};

const AREA_LABELS: Record<string, string> = {
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
  setek: "세특",
  personal_setek: "개인세특",
  reading: "독서",
  course_selection: "교과선택",
};

interface StorylineSectionProps {
  storylineData: StorylineTabData;
  studentGrade: number;
}

export function StorylineSection({
  storylineData,
  studentGrade,
}: StorylineSectionProps) {
  const { storylines, roadmapItems } = storylineData;

  if (storylines.length === 0 && roadmapItems.length === 0) {
    return (
      <section className="print-break-before">
        <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
          스토리라인
        </h2>
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">스토리라인이 아직 등록되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">3년간 성장 서사를 구성하면 테마별 연결과 로드맵이 표시됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        스토리라인
      </h2>

      {/* 스토리라인 카드 */}
      <div className="space-y-5 pt-4">
        {storylines.map((sl) => {
          const badge = STRENGTH_BADGE[sl.strength ?? "moderate"];
          const linkedItems = roadmapItems.filter(
            (r) => r.storyline_id === sl.id,
          );

          return (
            <div
              key={sl.id}
              className="rounded-lg border border-gray-200 p-4 print-avoid-break"
            >
              {/* 제목 + 배지 */}
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {sl.title}
                </h3>
                {badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                )}
                {sl.career_field && (
                  <span className="text-xs text-gray-500">
                    {sl.career_field}
                  </span>
                )}
              </div>

              {/* 키워드 */}
              {sl.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {sl.keywords.map((kw: string, i: number) => (
                    <span
                      key={i}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* 학년별 테마 타임라인 */}
              {(sl.grade_1_theme || sl.grade_2_theme || sl.grade_3_theme) && (
                <div className="flex gap-2 pt-3">
                  {[
                    { grade: 1, theme: sl.grade_1_theme },
                    { grade: 2, theme: sl.grade_2_theme },
                    { grade: 3, theme: sl.grade_3_theme },
                  ]
                    .filter((t) => t.grade <= studentGrade)
                    .map((t) => (
                      <div
                        key={t.grade}
                        className="flex-1 rounded bg-gray-50 p-2"
                      >
                        <p className="text-xs font-medium text-gray-500">
                          {t.grade}학년
                        </p>
                        <p className="text-sm text-gray-800">
                          {t.theme || "-"}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {/* 서술 */}
              {sl.narrative && (
                <p className="whitespace-pre-wrap pt-3 text-sm leading-relaxed text-gray-700">
                  {sl.narrative}
                </p>
              )}

              {/* 연결된 로드맵 아이템 */}
              {linkedItems.length > 0 && (
                <div className="pt-3">
                  <p className="text-xs font-medium text-gray-500">
                    로드맵 항목
                  </p>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-1 text-left text-gray-500">
                          학년
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          영역
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          계획
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          실행
                        </th>
                        <th className="px-2 py-1 text-center text-gray-500">
                          일치
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedItems
                        .sort((a, b) => a.grade - b.grade)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100"
                          >
                            <td className="px-2 py-1">{item.grade}</td>
                            <td className="px-2 py-1">
                              {AREA_LABELS[item.area] ?? item.area}
                            </td>
                            <td className="px-2 py-1">{item.plan_content}</td>
                            <td className="px-2 py-1">
                              {item.execution_content ?? "-"}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {item.match_rate != null
                                ? `${item.match_rate}%`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
