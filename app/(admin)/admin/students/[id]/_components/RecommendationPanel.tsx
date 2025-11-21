import { getRecommendations, getAllRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function RecommendationPanel({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await getRecommendations(supabase, studentId);
  const allRecommendations = getAllRecommendations(recommendations);

  if (allRecommendations.length === 0) {
    return null;
  }

  // 상위 10개만 표시
  const topRecommendations = allRecommendations.slice(0, 10);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-2xl">💡</span>
        Recommendation Panel
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        학생 데이터 기반 자동 생성 추천 (총 {allRecommendations.length}개)
      </p>

      <div className="space-y-4">
        {/* 과목별 추천 */}
        {recommendations.subjects.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
              <span>📚</span>
              과목별 집중 추천 ({recommendations.subjects.length}개)
            </h3>
            <ul className="space-y-2 ml-6">
              {recommendations.subjects.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 목표 기반 추천 */}
        {recommendations.goals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
              <span>🎯</span>
              목표 기반 행동 추천 ({recommendations.goals.length}개)
            </h3>
            <ul className="space-y-2 ml-6">
              {recommendations.goals.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 학습 플랜 추천 */}
        {recommendations.studyPlan.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
              <span>📅</span>
              다음주 학습시간/플랜 추천 ({recommendations.studyPlan.length}개)
            </h3>
            <ul className="space-y-2 ml-6">
              {recommendations.studyPlan.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 콘텐츠 추천 */}
        {recommendations.contents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
              <span>📖</span>
              콘텐츠 추천 ({recommendations.contents.length}개)
            </h3>
            <ul className="space-y-2 ml-6">
              {recommendations.contents.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 leading-relaxed">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

