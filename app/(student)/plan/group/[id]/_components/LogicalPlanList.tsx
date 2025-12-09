"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Book, Video, FileText, GripVertical } from "lucide-react";
import type { PlanGroupItem, PlanGroupItemInput } from "@/lib/types/plan";
import {
  createLogicalPlan,
  updateLogicalPlan,
  deleteLogicalPlan,
} from "@/app/(student)/actions/plan-groups/items";

type LogicalPlanListProps = {
  planGroupId: string;
  tenantId: string | null;
  initialItems?: PlanGroupItem[];
  readOnly?: boolean;
  onItemsChange?: (items: PlanGroupItem[]) => void;
};

const contentTypeIcons = {
  book: Book,
  lecture: Video,
  custom: FileText,
};

const contentTypeLabels = {
  book: "교재",
  lecture: "강의",
  custom: "커스텀",
};

export function LogicalPlanList({
  planGroupId,
  tenantId,
  initialItems = [],
  readOnly = false,
  onItemsChange,
}: LogicalPlanListProps) {
  const router = useRouter();
  const [items, setItems] = useState<PlanGroupItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PlanGroupItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  const handleCreate = async (input: PlanGroupItemInput) => {
    setIsLoading(true);
    setError(null);

    const result = await createLogicalPlan(planGroupId, input);

    if (result.success && result.itemId) {
      // 새로 생성된 아이템을 다시 조회해야 함 (또는 낙관적 업데이트)
      // 일단 성공하면 목록을 다시 불러오는 것이 안전
      router.refresh();
      setIsAddModalOpen(false);
    } else {
      setError(result.error || "생성에 실패했습니다.");
    }

    setIsLoading(false);
  };

  const handleUpdate = async (itemId: string, input: Partial<PlanGroupItemInput>) => {
    setIsLoading(true);
    setError(null);

    const result = await updateLogicalPlan(itemId, input);

    if (result.success) {
      // 업데이트 성공 시 목록 새로고침
      router.refresh();
      setEditingItem(null);
    } else {
      setError(result.error || "수정에 실패했습니다.");
    }

    setIsLoading(false);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("이 논리 플랜을 삭제하시겠습니까?")) return;

    setIsLoading(true);
    setError(null);

    const result = await deleteLogicalPlan(itemId);

    if (result.success) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      setError(result.error || "삭제에 실패했습니다.");
    }

    setIsLoading(false);
  };

  if (items.length === 0 && readOnly) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          논리 플랜이 없습니다
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          이 플랜 그룹에는 논리 플랜이 정의되지 않았습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">논리 플랜 목록</h3>
          <p className="text-sm text-gray-500">
            콘텐츠별 학습 계획 단위를 관리합니다.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="space-y-2">
        {items
          .sort((a, b) => a.display_order - b.display_order)
          .map((item) => {
            const Icon = contentTypeIcons[item.content_type];

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300"
              >
                {/* 드래그 핸들 (향후 구현) */}
                {!readOnly && (
                  <GripVertical className="h-5 w-5 cursor-grab text-gray-400" />
                )}

                {/* 콘텐츠 타입 아이콘 */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {contentTypeLabels[item.content_type]}
                    </span>
                    {item.is_review && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        복습
                      </span>
                    )}
                    {item.repeat_count > 1 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {item.repeat_count}회
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-gray-900">
                    콘텐츠 ID: {item.content_id.slice(0, 8)}...
                  </p>
                  {(item.target_start_page_or_time !== null ||
                    item.target_end_page_or_time !== null) && (
                    <p className="text-xs text-gray-500">
                      범위: {item.target_start_page_or_time ?? 0} ~{" "}
                      {item.target_end_page_or_time ?? "끝"}
                    </p>
                  )}
                </div>

                {/* 우선순위 */}
                <div className="text-center">
                  <span className="text-xs text-gray-500">우선순위</span>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.priority}
                  </p>
                </div>

                {/* 액션 버튼 */}
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingItem(item)}
                      disabled={isLoading}
                      className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      title="수정"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isLoading}
                      className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* 빈 상태 (추가 가능) */}
      {items.length === 0 && !readOnly && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            논리 플랜 추가
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            학습할 콘텐츠와 범위를 정의하세요.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            첫 논리 플랜 추가
          </button>
        </div>
      )}

      {/* 추가/수정 모달 (간단한 폼) */}
      {(isAddModalOpen || editingItem) && (
        <LogicalPlanFormModal
          item={editingItem}
          onSubmit={(input) => {
            if (editingItem) {
              handleUpdate(editingItem.id, input);
            } else {
              handleCreate(input);
            }
          }}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingItem(null);
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// 간단한 폼 모달
function LogicalPlanFormModal({
  item,
  onSubmit,
  onClose,
  isLoading,
}: {
  item: PlanGroupItem | null;
  onSubmit: (input: PlanGroupItemInput) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [contentType, setContentType] = useState<"book" | "lecture" | "custom">(
    item?.content_type || "book"
  );
  const [contentId, setContentId] = useState(item?.content_id || "");
  const [startRange, setStartRange] = useState<number | "">(
    item?.target_start_page_or_time ?? ""
  );
  const [endRange, setEndRange] = useState<number | "">(
    item?.target_end_page_or_time ?? ""
  );
  const [repeatCount, setRepeatCount] = useState(item?.repeat_count || 1);
  const [isReview, setIsReview] = useState(item?.is_review || false);
  const [priority, setPriority] = useState(item?.priority || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!contentId.trim()) {
      alert("콘텐츠 ID를 입력하세요.");
      return;
    }

    onSubmit({
      content_type: contentType,
      content_id: contentId.trim(),
      target_start_page_or_time: startRange === "" ? 0 : startRange,
      target_end_page_or_time: endRange === "" ? 0 : endRange,
      repeat_count: repeatCount,
      is_review: isReview,
      priority,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          {item ? "논리 플랜 수정" : "논리 플랜 추가"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 콘텐츠 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              콘텐츠 유형
            </label>
            <select
              value={contentType}
              onChange={(e) =>
                setContentType(e.target.value as "book" | "lecture" | "custom")
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="book">교재</option>
              <option value="lecture">강의</option>
              <option value="custom">커스텀</option>
            </select>
          </div>

          {/* 콘텐츠 ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              콘텐츠 ID
            </label>
            <input
              type="text"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="UUID 형식의 콘텐츠 ID"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 범위 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                시작 (페이지/분)
              </label>
              <input
                type="number"
                value={startRange}
                onChange={(e) =>
                  setStartRange(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="0"
                min={0}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                종료 (페이지/분)
              </label>
              <input
                type="number"
                value={endRange}
                onChange={(e) =>
                  setEndRange(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="100"
                min={0}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 반복 횟수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              반복 횟수
            </label>
            <input
              type="number"
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              min={1}
              max={10}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 복습 여부 & 우선순위 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isReview"
                checked={isReview}
                onChange={(e) => setIsReview(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isReview" className="text-sm text-gray-700">
                복습 플랜
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                우선순위
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                max={100}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "저장 중..." : item ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

