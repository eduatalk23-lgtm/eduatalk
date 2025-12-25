"use client";

import { useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import TemplateBlockForm from "./TemplateBlockForm";
import { createTenantBlockSet } from "@/lib/domains/tenant";
import { validateFormData, blockSetSchema } from "@/lib/validation/schemas";
import { useToast } from "@/components/ui/ToastProvider";
import type { Block, BlockSet } from "@/lib/types/time-management";
import { enrichBlockSetWithStats } from "@/lib/utils/timeUtils";
import { blockFormSchema, isStartTimeBeforeEndTime } from "@/lib/validation/timeSchema";
import { DAY_NAMES } from "@/lib/utils/timeUtils";

type TemplateBlocksViewerProps = {
  templateId: string;
  blocks: Block[];
  blockSets: BlockSet[];
  selectedBlockSetId: string | null;
  isLoading?: boolean;
  onCreateSetSuccess?: () => void;
  onBlockChange?: (setId: string) => Promise<void>;
  existingSetCount?: number;
};

export default function TemplateBlocksViewer({
  templateId,
  blocks,
  blockSets,
  selectedBlockSetId,
  isLoading = false,
  onCreateSetSuccess,
  onBlockChange,
  existingSetCount = 0,
}: TemplateBlocksViewerProps) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  
  // 각 블록 세트별 총 시간 계산 (유틸리티 함수 사용)
  const blockSetsWithStats = useMemo(() => {
    return blockSets.map((set) => enrichBlockSetWithStats(set));
  }, [blockSets]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="flex flex-col gap-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
        <TemplateBlockSetCreateForm
          templateId={templateId}
          onSuccess={async (newSetId?: string) => {
            setCreating(false);
            if (newSetId && onBlockChange) {
              await onBlockChange(newSetId);
            }
            if (onCreateSetSuccess) {
              await onCreateSetSuccess();
            }
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
          existingCount={existingSetCount}
        />
      )}

      {/* 블록 세트 목록 */}
      {blockSetsWithStats.length > 0 ? (
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-gray-900">등록된 블록 세트</h2>
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="새 블록 세트 추가"
            >
              + 새 세트 추가하기
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blockSetsWithStats.map((set) => (
              <div
                key={set.id}
                className={`bg-white border-2 rounded-lg p-6 transition-all hover:shadow-md flex flex-col ${
                  selectedBlockSetId === set.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{set.name}</h3>
                    {selectedBlockSetId === set.id && (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded">
                        선택됨
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
                        const { deleteTenantBlockSet } = await import("@/lib/domains/tenant");
                        const formData = new FormData();
                        formData.append("id", set.id);
                        await deleteTenantBlockSet(formData);
                        if (onCreateSetSuccess) {
                          await onCreateSetSuccess();
                        }
                        router.refresh();
                      } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : "세트 삭제에 실패했습니다.";
                        toast.showError(errorMessage);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label={`${set.name} 세트 삭제`}
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
                  <p className="text-sm text-gray-600">{set.description}</p>
                )}

                {/* 통계 정보 */}
                <div className="flex flex-col gap-2 flex-1">
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
                    <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">요일별 블록</div>
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

                {/* 액션 버튼들 - 하단 고정 */}
                <div className="flex gap-2 mt-auto">
                  {selectedBlockSetId !== set.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`"${set.name}" 블록 세트를 이 템플릿에 연결하시겠습니까?`)) {
                          return;
                        }
                        try {
                          const { updateCampTemplateAction } = await import("@/lib/domains/camp/actions");
                          // 템플릿 조회
                          const { getCampTemplateById } = await import("@/lib/domains/camp/actions");
                          const templateResult = await getCampTemplateById(templateId);
                          if (!templateResult.success || !templateResult.template) {
                            throw new Error("템플릿을 찾을 수 없습니다.");
                          }
                          
                          // template_data 업데이트
                          const templateData = (templateResult.template.template_data as Record<string, unknown>) || {};
                          const updatedTemplateData = {
                            ...templateData,
                            block_set_id: set.id,
                          };
                          
                          const formData = new FormData();
                          formData.append("name", templateResult.template.name);
                          formData.append("program_type", templateResult.template.program_type ?? "기타");
                          formData.append("description", templateResult.template.description || "");
                          formData.append("status", templateResult.template.status ?? "draft");
                          formData.append("template_data", JSON.stringify(updatedTemplateData));
                          
                          const result = await updateCampTemplateAction(templateId, formData);
                          if (!result.success) {
                            throw new Error(result.error || "템플릿 업데이트에 실패했습니다.");
                          }
                          
                          toast.showSuccess("블록 세트가 템플릿에 연결되었습니다.");
                          router.refresh();
                        } catch (error: unknown) {
                          const errorMessage = error instanceof Error ? error.message : "블록 세트 연결에 실패했습니다.";
                          toast.showError(errorMessage);
                        }
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      선택하기
                    </button>
                  )}
                  <a
                    href={`/admin/camp-templates/${templateId}/time-management/${set.id}`}
                    className={`${selectedBlockSetId === set.id ? 'flex-1 ' : ''}block text-center px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors`}
                  >
                    상세 보기
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-6xl">⏰</div>
            <h3 className="text-lg font-semibold text-gray-900">
              등록된 블록 세트가 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              위의 버튼을 사용하여 블록 세트를 추가하세요.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              aria-label="새 블록 세트 추가"
            >
              + 새 세트 추가하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// TemplateBlockSetCreateForm 컴포넌트
function TemplateBlockSetCreateForm({
  templateId,
  onSuccess,
  onCancel,
  existingCount,
}: {
  templateId: string;
  onSuccess: (newSetId?: string) => void | Promise<void>;
  onCancel: () => void;
  existingCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
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

        // template_id는 더 이상 필요 없음 (tenant_id만 사용)
        const result = await createTenantBlockSet(formData);
        
        // 시간 블록이 입력된 경우 추가
        if (selectedWeekdays.length > 0 && startTime && endTime) {
          // 시간 유효성 검사
          if (!isStartTimeBeforeEndTime(startTime, endTime)) {
            return { error: "시작 시간은 종료 시간보다 이전이어야 합니다." };
          }

          // 폼 데이터 유효성 검사
          const formValidation = blockFormSchema.safeParse({
            selectedWeekdays,
            start_time: startTime,
            end_time: endTime,
            block_set_id: result.blockSetId,
          });

          if (!formValidation.success) {
            const firstError = formValidation.error.issues[0];
            return { error: firstError?.message || "입력값이 올바르지 않습니다." };
          }

          const { addTenantBlock } = await import("@/lib/domains/tenant");
          for (const day of selectedWeekdays) {
            const blockFormData = new FormData();
            blockFormData.append("day", String(day));
            blockFormData.append("start_time", startTime);
            blockFormData.append("end_time", endTime);
            blockFormData.append("block_set_id", result.blockSetId);
            
            try {
              await addTenantBlock(blockFormData);
            } catch (blockError: unknown) {
              const errorMessage = blockError instanceof Error ? blockError.message : "블록 추가 실패";
              console.warn("블록 추가 실패:", errorMessage);
            }
          }
        }
        
        router.refresh();
        onSuccess(result.blockSetId);
        return { error: null };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "세트 생성에 실패했습니다.";
        return { error: errorMessage };
      }
    },
    { error: null }
  );

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="flex flex-col gap-4 bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">새 블록 세트 추가</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isPending}
            aria-label="닫기"
          >
            <span className="text-2xl" aria-hidden="true">×</span>
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
              placeholder="예: 기본 시간표"
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

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700">시간 블록 추가 (선택)</h4>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">추가할 요일 선택</label>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="요일 선택"
              >
                {DAY_NAMES.map((dayLabel, dayIndex) => (
                  <button
                    key={dayIndex}
                    type="button"
                    onClick={() => toggleWeekday(dayIndex)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedWeekdays.includes(dayIndex)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    aria-pressed={selectedWeekdays.includes(dayIndex)}
                    aria-label={`${dayLabel}요일 ${selectedWeekdays.includes(dayIndex) ? "선택됨" : "선택 안됨"}`}
                  >
                    {dayLabel}요일
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="start-time-create-camp" className="text-sm font-medium text-gray-700">
                  시작 시간
                </label>
                <input
                  id="start-time-create-camp"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  aria-label="시작 시간"
                  aria-required="false"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="end-time-create-camp" className="text-sm font-medium text-gray-700">
                  종료 시간
                </label>
                <input
                  id="end-time-create-camp"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  aria-label="종료 시간"
                  aria-required="false"
                />
              </div>
            </div>
            {startTime && endTime && !isStartTimeBeforeEndTime(startTime, endTime) && (
              <p className="text-xs text-red-600" role="alert">
                시작 시간은 종료 시간보다 이전이어야 합니다.
              </p>
            )}
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

