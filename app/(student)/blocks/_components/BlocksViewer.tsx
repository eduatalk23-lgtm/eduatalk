"use client";

import { useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BlockForm from "./BlockForm";
import { createBlockSet } from "@/app/actions/blockSets";
import { validateFormData, blockSetSchema } from "@/lib/validation/schemas";

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
}: BlocksViewerProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  
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
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
            setCreating(false);
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
          onCancel={() => setCreating(false)}
          existingCount={existingSetCount}
        />
      )}

      {/* 블록 세트 목록 */}
      {blockSetsWithStats.length > 0 ? (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-gray-900">등록된 시간 블록</h2>
            {existingSetCount < 5 && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + 새 세트 추가하기
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blockSetsWithStats.map((set) => (
              <div
                key={set.id}
                className={`bg-white border-2 rounded-lg p-6 transition-all hover:shadow-md flex flex-col ${
                  activeSetId === set.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{set.name}</h3>
                    {activeSetId === set.id && (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded">
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
                      } catch (error: any) {
                        alert(error.message || "세트 삭제에 실패했습니다.");
                      }
                    }}
                    className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                  <p className="text-sm text-gray-600 mb-4">{set.description}</p>
                )}

                {/* 통계 정보 */}
                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">블록 개수</span>
                    <span className="font-medium text-gray-900">{set.blockCount}개</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">주간 총 시간</span>
                    <span className="font-medium text-gray-900">
                      {set.totalHours}시간 {set.remainingMinutes}분
                    </span>
                  </div>
                  {set.blockCount > 0 && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">요일별 블록</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(set.dayDistribution).map(([day, count]) => (
                          <span
                            key={day}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
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
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">⏰</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              등록된 시간 블록이 없습니다
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              위의 폼을 사용하여 시간 블록을 추가하세요.
            </p>
            <p className="text-xs text-gray-400">
              새 세트 추가하기 버튼을 통해 블록 세트를 먼저 생성할 수 있습니다.
            </p>
          </div>
        </div>
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
    async (_prev: { error: string | null }, formData: FormData) => {
      try {
        // 세트 생성
        const validation = validateFormData(formData, blockSetSchema);
        if (!validation.success) {
          const firstError = validation.errors.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다." };
        }

        const result = await createBlockSet(formData);
        
        // 시간 블록이 입력된 경우 추가
        if (selectedWeekdays.length > 0 && startTime && endTime) {
          const { addBlocksToMultipleDays } = await import("@/app/actions/blocks");
          const blockFormData = new FormData();
          blockFormData.append("target_days", selectedWeekdays.join(","));
          blockFormData.append("start_time", startTime);
          blockFormData.append("end_time", endTime);
          blockFormData.append("block_set_id", result.blockSetId);
          
          try {
            await addBlocksToMultipleDays(blockFormData);
          } catch (blockError: any) {
            // 블록 추가 실패해도 세트는 생성되었으므로 성공으로 처리
            console.warn("블록 추가 실패:", blockError);
          }
        }
        
        router.refresh();
        onSuccess(result.blockSetId);
        return { error: null };
      } catch (err: any) {
        return { error: err.message || "세트 생성에 실패했습니다." };
      }
    },
    { error: null }
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
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">새 블록 세트 추가</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isPending}
          >
            <span className="text-2xl">×</span>
          </button>
        </div>
        
        <form action={formAction} className="flex flex-col gap-4">
          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{state.error}</p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">세트 이름</label>
            <input
              type="text"
              name="name"
              placeholder="예: 여름방학용"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">설명 (선택)</label>
            <textarea
              name="description"
              placeholder="세트에 대한 설명을 입력하세요"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">시간 블록 추가 (선택)</h4>
            
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium text-gray-700">추가할 요일 선택</label>
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
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {day.label}요일
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">시작 시간</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">종료 시간</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

