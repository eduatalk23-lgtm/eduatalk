import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function RecommendationCard() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const recommendations = await getRecommendations(supabase, user.id);
  const topRecommendations = getTopRecommendations(recommendations, 3);

  if (topRecommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">학습 추천</h2>
      </div>

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

