"use client";

import { useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BlockForm from "./BlockForm";
import { createBlockSet } from "@/app/actions/blockSets";
import { validateFormData, blockSetSchema } from "@/lib/validation/schemas";
import { EmptyState } from "@/components/molecules/EmptyState";
import { cn } from "@/lib/cn";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_index?: number | null;
};

type BlockSet = {
  id: string;
  name: string;
  description?: string | null;
  display_order?: number;
  blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
};

type BlocksViewerProps = {
  blocks: Block[];
  blockSets: BlockSet[];
  activeSetId: string | null;
  isLoading?: boolean;
  onCreateSetSuccess?: () => void;
  onBlockChange?: (setId: string) => Promise<void>;
  existingSetCount?: number;
  onCreateSetRequest?: () => void;
  creating?: boolean;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function BlocksViewer({
  blocks,
  blockSets,
  activeSetId,
  isLoading = false,
  onCreateSetSuccess,
  onBlockChange,
  existingSetCount = 0,
  onCreateSetRequest,
  creating = false,
}: BlocksViewerProps) {
  const router = useRouter();
  
  // 각 블록 세트별 총 시간 계산
  const blockSetsWithStats = useMemo(() => {
    return blockSets.map((set) => {
      const setBlocks = set.blocks ?? [];
      const totalMinutes = setBlocks.reduce((acc, block) => {
        const [startH, startM] = (block.start_time ?? "00:00").split(":").map(Number);
        const [endH, endM] = (block.end_time ?? "00:00").split(":").map(Number);
        const start = startH * 60 + startM;
        const end = endH * 60 + endM;
        const duration = end - start;
        return acc + (duration > 0 ? duration : 0);
      }, 0);

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = Math.max(0, totalMinutes % 60);

      // 요일별 블록 개수 계산
      const dayDistribution = setBlocks.reduce((acc, block) => {
        const day = DAYS[block.day_of_week] ?? "";
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        ...set,
        blockCount: setBlocks.length,
        totalHours,
        remainingMinutes,
        dayDistribution,
      };
    });
  }, [blockSets]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="flex flex-col gap-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>

      {/* 새 세트 추가 폼 (모달) */}
      {creating && (
        <BlockSetCreateForm
          onSuccess={async (newSetId?: string) => {
            onCreateSetRequest?.(); // 상위 컴포넌트에 creating 상태 해제 요청
            // 새 세트가 생성되고 블록이 추가된 경우, 해당 세트만 업데이트
            if (newSetId && onBlockChange) {
              await onBlockChange(newSetId);
            }
            // 데이터 새로고침을 위해 콜백 먼저 호출 (loadData 완료 대기)
            if (onCreateSetSuccess) {
              await onCreateSetSuccess();
            }
            // loadData 완료 후 서버 컴포넌트 새로고침
            router.refresh();
          }}
          onCancel={() => onCreateSetRequest?.()} // 상위 컴포넌트에 creating 상태 해제 요청
          existingCount={existingSetCount}
        />
      )}

      {/* 블록 세트 목록 */}
      {blockSetsWithStats.length > 0 ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blockSetsWithStats.map((set) => (
              <div
                key={set.id}
                className={cn(
                  "bg-white dark:bg-gray-800 border-2 rounded-lg p-6 shadow-[var(--elevation-1)] transition-base hover:shadow-[var(--elevation-4)] flex flex-col gap-4",
                  activeSetId === set.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-[var(--elevation-4)]"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-1 flex-col gap-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{set.name}</h3>
                    {activeSetId === set.id && (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 rounded">
                        활성
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`"${set.name}" 세트를 삭제하시겠습니까? 포함된 모든 블록도 함께 삭제됩니다.`)) {
                        return;
                      }
                      try {
                        const { deleteBlockSet } = await import("@/app/actions/blockSets");
                        const formData = new FormData();
                        formData.append("id", set.id);
                        await deleteBlockSet(formData);
                        // 데이터 새로고침을 위해 콜백 먼저 호출 (loadData 완료 대기)
                        if (onCreateSetSuccess) {
                          await onCreateSetSuccess();
                        }
                        // 서버 컴포넌트 새로고침은 loadData 완료 후
                        router.refresh();
                      } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : "세트 삭제에 실패했습니다.";
                        alert(errorMessage);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="세트 삭제"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                {/* 설명 */}
                {set.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{set.description}</p>
                )}

                {/* 통계 정보 */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">블록 개수</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{set.blockCount}개</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">주간 총 시간</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {set.totalHours}시간 {set.remainingMinutes}분
                    </span>
                  </div>
                  {set.blockCount > 0 && (
                    <div className="flex flex-col gap-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400">요일별 블록</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(set.dayDistribution).map(([day, count]) => (
                          <span
                            key={day}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                          >
                            {day} {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 상세 보기 버튼 - 하단 고정 */}
                <Link
                  href={`/blocks/${set.id}`}
                  className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors mt-auto"
                >
                  상세 보기
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="등록된 블록 세트가 없습니다"
          description="새 블록 세트를 추가하여 학습 시간을 관리하세요."
          icon="📅"
        />
      )}
    </>
  );
}

// BlockSetCreateForm 컴포넌트 (세트 + 시간 블록 함께 입력)
function BlockSetCreateForm({
  onSuccess,
  onCancel,
  existingCount,
}: {
  onSuccess: (newSetId?: string) => void | Promise<void>;
  onCancel: () => void;
  existingCount: number;
}) {
  const router = useRouter();
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string | undefined } | { error: null }, formData: FormData) => {
      try {
        // 세트 생성
        const validation = validateFormData(formData, blockSetSchema);
        if (!validation.success) {
          const firstError = validation.errors.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다." };
        }

        const result = await createBlockSet(formData);
        
        if (!isSuccessResponse(result) || !result.data) {
          const errorMessage = isErrorResponse(result) ? (result.error || result.message) : "세트 생성에 실패했습니다.";
          return { error: errorMessage || undefined };
        }
        
        // 시간 블록이 입력된 경우 추가
        if (selectedWeekdays.length > 0 && startTime && endTime) {
          const { addBlocksToMultipleDays } = await import("@/app/actions/blocks");
          const blockFormData = new FormData();
          blockFormData.append("target_days", selectedWeekdays.join(","));
          blockFormData.append("start_time", startTime);
          blockFormData.append("end_time", endTime);
          blockFormData.append("block_set_id", result.data.blockSetId);
          
          try {
            await addBlocksToMultipleDays(blockFormData);
          } catch (blockError: unknown) {
            // 블록 추가 실패해도 세트는 생성되었으므로 성공으로 처리
            console.warn("블록 추가 실패:", blockError);
          }
        }
        
        router.refresh();
        onSuccess(result.data.blockSetId);
        return { error: undefined };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "세트 생성에 실패했습니다.";
        return { error: errorMessage };
      }
    },
    { error: undefined }
  );

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  if (existingCount >= 5) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[var(--elevation-8)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">새 블록 세트 추가</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            disabled={isPending}
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">{state.error}</p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">세트 이름</label>
            <input
              type="text"
              name="name"
              placeholder="예: 여름방학용"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm"
              required
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">설명 (선택)</label>
            <textarea
              name="description"
              placeholder="세트에 대한 설명을 입력하세요"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">시간 블록 추가 (선택)</h4>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">추가할 요일 선택</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: "일" },
                  { value: 1, label: "월" },
                  { value: 2, label: "화" },
                  { value: 3, label: "수" },
                  { value: 4, label: "목" },
                  { value: 5, label: "금" },
                  { value: 6, label: "토" },
                ].map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedWeekdays.includes(day.value)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {day.label}요일
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">시작 시간</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종료 시간</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isPending ? "생성 중..." : "생성"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

