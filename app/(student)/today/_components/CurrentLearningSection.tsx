import { fetchActivePlanIdOnly } from "@/app/(student)/dashboard/_utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ActiveLearningWidget } from "@/app/(student)/dashboard/_components/ActiveLearningWidget";
import { formatDateString } from "@/lib/date/calendarUtils";

type CurrentLearningSectionProps = {
  campMode?: boolean;
};

export async function CurrentLearningSection({ campMode = false }: CurrentLearningSectionProps) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = formatDateString(today);

    // 지연 로딩을 위해 activePlanId만 확인
    const activePlanId = await fetchActivePlanIdOnly(supabase, user.userId, todayDate);

    if (!activePlanId) {
      return null;
    }

    return (
      <div>
        <ActiveLearningWidget activePlanId={activePlanId} campMode={campMode} />
      </div>
    );
  } catch (error) {
    console.error("[CurrentLearningSection] 컴포넌트 렌더링 실패", error);
    return null;
  }
}

