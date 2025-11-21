import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function TodayRecommendations() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const recommendations = await getRecommendations(supabase, user.userId).catch(
      (error) => {
        console.error("[TodayRecommendations] 추천 조회 실패", error);
        return { subjects: [], goals: [], studyPlan: [], contents: [] };
      }
    );
    const topRecommendations = getTopRecommendations(recommendations, 3);

    if (topRecommendations.length === 0) {
      return null;
    }

  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">오늘 추천</h2>
      <ul className="space-y-2">
        {topRecommendations.map((rec, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {index + 1}
            </span>
            <p className="flex-1 text-sm leading-relaxed text-gray-700">{rec}</p>
          </li>
        ))}
      </ul>
    </div>
  );
  } catch (error) {
    console.error("[TodayRecommendations] 컴포넌트 렌더링 실패", error);
    return null;
  }
}

