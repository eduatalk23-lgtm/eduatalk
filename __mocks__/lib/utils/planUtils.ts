import { vi } from "vitest";

// 실제 구현과 동일하게 더미 콘텐츠 판별
// "dummy"로 시작하는 모든 content_id를 더미로 간주
function isDummyContent(contentId: string | null | undefined): boolean {
  if (!contentId) return false;
  return contentId.startsWith("dummy");
}

export const isCompletedPlan = vi.fn((plan: any) => {
  return !!plan?.actual_end_time;
});

export const filterLearningPlans = vi.fn().mockImplementation((plans: any[]) => {
  if (!Array.isArray(plans)) return [];
  // 실제 구현과 동일하게 더미 콘텐츠 필터링
  // "dummy"로 시작하는 content_id를 가진 플랜 제외
  return plans.filter((plan) => {
    if (!plan) return false;
    const contentId = plan.content_id;
    if (!contentId) return true; // content_id가 없으면 포함
    return !contentId.startsWith("dummy");
  });
});
