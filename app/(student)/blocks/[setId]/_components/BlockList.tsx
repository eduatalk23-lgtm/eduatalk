"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBlock, deleteBlock } from "@/lib/domains/block/actions";
import { validateFormData, blockSchema } from "@/lib/validation/schemas";
import { EmptyState } from "@/components/molecules/EmptyState";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { useServerForm } from "@/lib/hooks/useServerForm";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BlockListProps = {
  blocks: Block[];
  blockSetId: string;
  onAddBlock?: () => void;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function BlockList({ blocks, blockSetId, onAddBlock }: BlockListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (blockId: string) => {
    if (!confirm("이 블록을 삭제하시겠습니까?")) return;

    const formData = new FormData();
    formData.append("id", blockId);
    deleteActionHook.execute(formData);
  };

  const deleteActionHook = useServerAction(deleteBlock, {
    onSuccess: () => {
      setDeletingId(null);
      router.refresh();
    },
    onError: (error) => {
      alert(error);
    },
  });

  // 요일별로 그룹화
  const blocksByDay = DAYS.map((day, dayIndex) => ({
    day,
    dayIndex,
    blocks: blocks.filter((b) => b.day_of_week === dayIndex),
  })).filter((group) => group.blocks.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-gray-900">시간 블록 목록</h2>
        {onAddBlock && (
          <button
            type="button"
            onClick={onAddBlock}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="블록 추가"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>
      {blocksByDay.length === 0 ? (
        <EmptyState
          icon="⏰"
          title="등록된 시간 블록이 없습니다"
          description="위의 + 버튼을 클릭하여 시간 블록을 추가하세요."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {blocksByDay.map(({ day, dayIndex, blocks: dayBlocks }) => (
            <div key={dayIndex} className="flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{day}요일</h3>
              <div className="flex flex-col gap-2">
                {dayBlocks.map((block) => {
                  const isEditing = editingId === block.id;
                  const isDeleting = deletingId === block.id;

                  if (isEditing) {
                    return (
                      <BlockEditForm
                        key={block.id}
                        block={block}
                        onSuccess={() => {
                          setEditingId(null);
                          router.refresh();
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    );
                  }

                  return (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-900">
                          {block.start_time} ~ {block.end_time}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round(
                            ((new Date(`2000-01-01T${block.end_time}`).getTime() -
                              new Date(`2000-01-01T${block.start_time}`).getTime()) /
                              60000)
                          )}분
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(block.id)}
                          disabled={isDeleting}
                          className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingId(block.id);
                            handleDelete(block.id);
                          }}
                          disabled={deleteActionHook.isPending}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        >
                          {deleteActionHook.isPending ? "삭제 중..." : "삭제"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

type BlockEditFormProps = {
  block: Block;
  onSuccess: () => void;
  onCancel: () => void;
};

function BlockEditForm({ block, onSuccess, onCancel }: BlockEditFormProps) {
  // 래퍼 함수: block.id를 FormData에 추가
  const wrappedUpdateAction = async (formData: FormData) => {
    formData.append("id", block.id);
    const validation = validateFormData(formData, blockSchema);
    if (!validation.success) {
      const firstError = validation.errors.issues[0];
      return {
        success: false as const,
        error: firstError?.message || "입력값이 올바르지 않습니다.",
      };
    }
    return await updateBlock(formData);
  };

  const { action: serverAction, state, isPending, error, fieldErrors } = useServerForm(wrappedUpdateAction, null, {
    onSuccess: () => {
      onSuccess();
    },
  });
  
  // form action은 void를 반환해야 하므로 래퍼 함수 생성
  const action = async (formData: FormData) => {
    await serverAction(formData);
  };

  return (
    <div className="p-4 bg-white border-2 border-indigo-500 rounded-lg">
      <form action={action} className="flex flex-col gap-3">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}
        {fieldErrors && Object.keys(fieldErrors).length > 0 && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {Object.values(fieldErrors).flat().join(", ")}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">요일</label>
          <select
            name="day"
            defaultValue={block.day_of_week}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          >
            {DAYS.map((day, index) => (
              <option key={index} value={index}>
                {day}요일
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">시작 시간</label>
            <input
              type="time"
              name="start_time"
              defaultValue={block.start_time}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">종료 시간</label>
            <input
              type="time"
              name="end_time"
              defaultValue={block.end_time}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "저장 중..." : "저장"}
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
  );
}

