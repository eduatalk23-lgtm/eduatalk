import { queryOptions } from "@tanstack/react-query";
import { fetchSetekGuides } from "@/lib/domains/student-record/actions/activitySummary";

export const setekGuideKeys = {
  all: ["setekGuide"] as const,
  list: (studentId: string) =>
    [...setekGuideKeys.all, "list", studentId] as const,
};

export function setekGuideListOptions(studentId: string) {
  return queryOptions({
    queryKey: setekGuideKeys.list(studentId),
    queryFn: async () => {
      const result = await fetchSetekGuides(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}
