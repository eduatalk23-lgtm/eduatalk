"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getScheduleResultDataAction,
  generatePlansFromGroupAction,
  checkPlansExistAction,
} from "@/app/(student)/actions/planGroupActions";
import { ScheduleTableView } from "./Step7ScheduleResult/ScheduleTableView";
import type {
  ContentData,
  BlockData,
} from "./utils/scheduleTransform";

type Step7ScheduleResultProps = {
  groupId: string;
  onComplete: () => void;
};

export function Step7ScheduleResult({
  groupId,
  onComplete,
}: Step7ScheduleResultProps) {
  const queryClient = useQueryClient();

  // 플랜 존재 여부 확인
  const { data: plansCheck, isLoading: isCheckingPlans } = useQuery({
    queryKey: ["plansExist", groupId],
    queryFn: () => checkPlansExistAction(groupId),
    staleTime: 1000 * 60, // 1분간 캐시 유지
  });

  // 플랜 생성 뮤테이션
  const generatePlansMutation = useMutation({
    mutationFn: () => generatePlansFromGroupAction(groupId),
    onSuccess: async () => {
      // 플랜 생성 후 관련 쿼리 캐시 무효화 및 재조회
      await queryClient.invalidateQueries({ queryKey: ["plansExist", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["planSchedule", groupId] });
      // plansCheck를 즉시 재조회하여 hasPlans 상태 업데이트
      await queryClient.refetchQueries({ queryKey: ["plansExist", groupId] });
    },
  });

  // 플랜 재생성 핸들러
  const handleRegenerate = () => {
    if (
      !confirm(
        "플랜을 재생성하시겠습니까? 기존 플랜이 삭제되고 새로 생성됩니다."
      )
    ) {
      return;
    }

    generatePlansMutation.mutate();
  };

  // 스케줄 결과 데이터 조회 (기존 PlanScheduleView와 동일한 queryKey 사용)
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["planSchedule", groupId],
    queryFn: async () => {
      const result = await getScheduleResultDataAction(groupId);

      if (result.plans.length === 0) {
        throw new Error("생성된 플랜이 없습니다.");
      }

      // contents 배열을 Map으로 변환
      const contentsMap = new Map(
        result.contents.map((c) => [c.id, c])
      );

      return {
        dailySchedule: result.dailySchedule || [],
        plans: result.plans || [],
        contents: contentsMap,
        blocks: result.blocks || [],
      };
    },
    enabled: Boolean(plansCheck?.hasPlans || generatePlansMutation.isSuccess),
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
    gcTime: 1000 * 60 * 10, // 10분간 메모리 유지
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const isGenerating = generatePlansMutation.isPending;
  const isLoadingData = isLoading || isCheckingPlans;
  const hasError = error || generatePlansMutation.error;

  if (isLoadingData || isGenerating) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isGenerating ? "플랜을 생성하는 중입니다..." : "생성된 학습 플랜을 확인할 수 있습니다."}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <p className="mt-4 text-sm text-gray-500">
            {isGenerating ? "플랜 생성 중..." : "데이터를 불러오는 중..."}
          </p>
        </div>
      </div>
    );
  }

  if (hasError) {
    const errorMessage = 
      generatePlansMutation.error instanceof Error 
        ? `플랜 생성 실패: ${generatePlansMutation.error.message}`
        : error instanceof Error 
        ? error.message
        : "데이터를 불러오는 중 오류가 발생했습니다.";

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            생성된 학습 플랜을 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">오류</h3>
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // 플랜이 없을 때 UI 표시
  if (!data && !isLoadingData && !isGenerating) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            플랜을 생성하면 학습 스케줄을 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="mb-4 text-sm text-gray-600">
            아직 플랜이 생성되지 않았습니다. 아래 버튼을 클릭하여 플랜을 생성하세요.
          </p>
          <button
            type="button"
            onClick={() => {
              if (generatePlansMutation.isPending || generatePlansMutation.isSuccess) {
                return;
              }
              generatePlansMutation.mutate();
            }}
            disabled={generatePlansMutation.isPending || generatePlansMutation.isSuccess}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {generatePlansMutation.isPending ? "플랜 생성 중..." : "플랜 생성하기"}
          </button>
        </div>
      </div>
    );
  }

  // 플랜이 있을 때 스케줄 결과 표시
  if (!data) {
    return null;
  }

  const { dailySchedule, plans, contents, blocks } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
          <p className="mt-1 text-sm text-gray-500">
            생성된 학습 플랜을 확인할 수 있습니다. 총 {plans.length}개의 플랜이 생성되었습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={generatePlansMutation.isPending}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {generatePlansMutation.isPending ? "재생성 중..." : "플랜 재생성"}
        </button>
      </div>

      <ScheduleTableView
        dailySchedule={dailySchedule}
        plans={plans}
        contents={contents}
        blocks={blocks}
      />

      {/* 완료 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            // 플랜이 생성 중이거나 이미 생성 완료된 경우 완료 버튼 비활성화
            if (generatePlansMutation.isPending || generatePlansMutation.isSuccess) {
              return;
            }
            // 플랜이 없으면 생성 후 완료
            if (!plansCheck?.hasPlans) {
              generatePlansMutation.mutate(undefined, {
                onSuccess: () => {
                  // 플랜 생성 후 완료 핸들러 호출
                  onComplete();
                },
                onError: (error) => {
                  alert(
                    error instanceof Error
                      ? `플랜 생성 실패: ${error.message}`
                      : "플랜 생성에 실패했습니다."
                  );
                },
              });
              return;
            }
            // 플랜이 있으면 바로 완료
            onComplete();
          }}
          disabled={generatePlansMutation.isPending || generatePlansMutation.isSuccess || isLoadingData}
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {generatePlansMutation.isPending ? "플랜 생성 중..." : "완료"}
        </button>
      </div>
    </div>
  );
}

