import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";

export async function RecommendationSection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await getRecommendations(supabase, studentId);
  const topRecommendations = getTopRecommendations(recommendations, 5);

  if (topRecommendations.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "flex flex-col gap-4 rounded-xl border p-6 shadow-sm",
      "border-blue-200 dark:border-blue-800",
      "bg-gradient-to-br from-blue-50 to-indigo-50",
      "dark:from-blue-900/30 dark:to-indigo-900/30"
    )}>
      <h3 className={cn("text-lg font-semibold flex items-center gap-2", textPrimary)}>
        <span className="text-2xl">💡</span>
        우리 아이에게 필요한 학습 제안
      </h3>
      <p className={cn("text-sm", textSecondary)}>
        자녀의 학습 데이터를 기반으로 생성된 맞춤 추천입니다
      </p>

      <ul className="flex flex-col gap-3">
        {topRecommendations.map((rec, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-semibold text-blue-700 dark:text-blue-300">
              {index + 1}
            </span>
            <p className={cn("flex-1 text-sm leading-relaxed", textSecondary)}>{rec}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

