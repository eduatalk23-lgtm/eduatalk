import { queryOptions } from "@tanstack/react-query";
import { fetchActivitySummaries } from "@/lib/domains/student-record/actions/activitySummary";

export const activitySummaryKeys = {
  all: ["activitySummary"] as const,
  list: (studentId: string) =>
    [...activitySummaryKeys.all, "list", studentId] as const,
};

export function activitySummaryListOptions(studentId: string) {
  return queryOptions({
    queryKey: activitySummaryKeys.list(studentId),
    queryFn: async () => {
      const result = await fetchActivitySummaries(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}
