import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, textPrimary, textSecondary } from "@/lib/utils/darkMode";

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
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <h2 className={cn("text-xl font-semibold", textPrimary)}>학습 추천</h2>

        <ul className="flex flex-col gap-3">
          {topRecommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {index + 1}
              </span>
              <p className={cn("flex-1 text-sm leading-relaxed", textSecondary)}>{rec}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

