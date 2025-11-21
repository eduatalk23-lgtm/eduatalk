import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function RecommendationSection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await getRecommendations(supabase, studentId);
  const topRecommendations = getTopRecommendations(recommendations, 5);

  if (topRecommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <span className="text-2xl">💡</span>
        우리 아이에게 필요한 학습 제안
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        자녀의 학습 데이터를 기반으로 생성된 맞춤 추천입니다
      </p>

      <ul className="space-y-3">
        {topRecommendations.map((rec, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {index + 1}
            </span>
            <p className="flex-1 text-sm text-gray-700 leading-relaxed">{rec}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

