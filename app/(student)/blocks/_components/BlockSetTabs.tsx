"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createBlockSet,
  updateBlockSet,
  deleteBlockSet,
  setActiveBlockSet,
  duplicateBlockSet,
} from "@/lib/domains/block/actions";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";
import {
  inputFieldBase,
  inlineButtonPrimary,
  modalCancelButton,
  textPrimary,
  textSecondary,
  textTertiary,
  textMuted,
  bgSurface,
  borderDefault,
  borderInput,
  bgStyles,
  getGrayBgClasses,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

type BlockSet = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
};

type BlockSetTabsProps = {
  sets: BlockSet[];
  activeSetId: string | null;
  onSetChange?: (setId: string | null) => void;
};

const MAX_SETS = 5;

export default function BlockSetTabs({
  sets,
  activeSetId,
  onSetChange,
}: BlockSetTabsProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleSetActive = async (setId: string) => {
    const formData = new FormData();
    formData.append("id", setId);
    const result = await setActiveBlockSet(formData);
    
    if (isSuccessResponse(result)) {
      // onSetChange 콜백 호출하여 부모 컴포넌트 상태 업데이트 (완료 대기)
      if (onSetChange) {
        await onSetChange(setId);
      }
      
      // 클라이언트 상태로 관리하므로 refresh 불필요
      // router.refresh();
    } else if (isErrorResponse(result)) {
      alert(result.error || "활성 세트 전환에 실패했습니다.");
    }
  };

  const handleDelete = async (setId: string, setName: string) => {
    if (!confirm(`"${setName}" 세트를 삭제하시겠습니까? 포함된 모든 블록도 함께 삭제됩니다.`)) {
      return;
    }

    const formData = new FormData();
    formData.append("id", setId);
    const result = await deleteBlockSet(formData);
    
    if (isSuccessResponse(result)) {
      router.refresh();
    } else if (isErrorResponse(result)) {
      alert(result.error || "세트 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className={cn("text-lg font-semibold", textPrimary)}>블록 세트</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={sets.length >= MAX_SETS || creating}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + 새 세트 추가
        </button>
      </div>

      {/* 세트 생성 폼 */}
      {creating && (
        <BlockSetCreateForm
          onSuccess={() => {
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
          existingCount={sets.length}
        />
      )}

      {/* 탭 목록 */}
      <div className="flex flex-wrap gap-2">
        {sets.map((set) => (
          <div
            key={set.id}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              activeSetId === set.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                : cn(borderDefault, bgSurface, "hover:border-gray-300 dark:hover:border-gray-600")
            }`}
          >
            {editingId === set.id ? (
              <BlockSetEditForm
                set={set}
                onSuccess={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSetActive(set.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className={cn("font-medium", textPrimary)}>{set.name}</div>
                    {activeSetId === set.id && (
                      <div className="text-xs text-indigo-600 dark:text-indigo-400">활성</div>
                    )}
                  </div>
                </button>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setEditingId(set.id)}
                    className={cn("p-1", textMuted, "hover:text-gray-700 dark:hover:text-gray-300")}
                    title="이름 수정"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicatingId(set.id)}
                    className={cn("p-1", textMuted, "hover:text-gray-700 dark:hover:text-gray-300")}
                    title="복제"
                  >
                    📋
                  </button>
                  {sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(set.id, set.name)}
                      className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {duplicatingId && (
          <BlockSetDuplicateForm
            sourceSet={sets.find((s) => s.id === duplicatingId)!}
            onSuccess={() => setDuplicatingId(null)}
            onCancel={() => setDuplicatingId(null)}
            existingCount={sets.length}
          />
        )}
      </div>

      {sets.length === 0 && (
        <div className={cn("p-4 rounded-lg text-center", bgStyles.gray, borderDefault)}>
          <p className={cn("text-sm", textTertiary)}>
            블록 세트를 생성하여 시간 블록을 관리하세요.
          </p>
        </div>
      )}
    </div>
  );
}

type BlockSetCreateFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  existingCount: number;
};

function BlockSetCreateForm({
  onSuccess,
  onCancel,
  existingCount,
}: BlockSetCreateFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResponse<{ blockSetId: string; name: string }> | null, formData: FormData) => {
      const result = await createBlockSet(formData);
      
      if (isSuccessResponse(result)) {
        router.refresh();
        onSuccess();
      }
      
      return result;
    },
    null
  );

  if (existingCount >= MAX_SETS) {
    return (
      <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          블록 세트는 최대 {MAX_SETS}개까지 생성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg", bgSurface, borderDefault)}>
      <form action={formAction} className="flex flex-col gap-3">
        {state && isErrorResponse(state) && state.error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">{state.error}</p>
        )}

        <div className="flex flex-col gap-2">
          <label className={cn("text-sm font-medium", textSecondary)}>세트 이름</label>
          <input
            type="text"
            name="name"
            placeholder="예: 여름방학용"
            className={cn("px-3 py-2 rounded-lg text-sm", borderInput, bgSurface, textPrimary)}
            required
            maxLength={100}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={cn("text-sm font-medium", textSecondary)}>설명 (선택)</label>
          <textarea
            name="description"
            placeholder="세트에 대한 설명을 입력하세요"
            className={cn("px-3 py-2 rounded-lg text-sm", borderInput, bgSurface, textPrimary)}
            rows={2}
            maxLength={500}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            isLoading={isPending}
            fullWidth
          >
            생성
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            fullWidth
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}

type BlockSetEditFormProps = {
  set: BlockSet;
  onSuccess: () => void;
  onCancel: () => void;
};

function BlockSetEditForm({ set, onSuccess, onCancel }: BlockSetEditFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResponse | null, formData: FormData) => {
      formData.append("id", set.id);
      const result = await updateBlockSet(formData);
      
      if (isSuccessResponse(result)) {
        router.refresh();
        onSuccess();
      }
      
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state && isErrorResponse(state) && state.error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-1 rounded">{state.error}</p>
      )}
      <input
        type="text"
        name="name"
        defaultValue={set.name}
        className={cn("px-2 py-1 border rounded text-sm flex-1", borderInput, bgSurface, textPrimary)}
        required
        maxLength={100}
      />
      <Button
        type="submit"
        size="xs"
        isLoading={isPending}
      >
        저장
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={onCancel}
        disabled={isPending}
      >
        취소
      </Button>
    </form>
  );
}

type BlockSetDuplicateFormProps = {
  sourceSet: BlockSet;
  onSuccess: () => void;
  onCancel: () => void;
  existingCount: number;
};

function BlockSetDuplicateForm({
  sourceSet,
  onSuccess,
  onCancel,
  existingCount,
}: BlockSetDuplicateFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResponse | null, formData: FormData) => {
      formData.append("source_id", sourceSet.id);
      const result = await duplicateBlockSet(formData);
      
      if (isSuccessResponse(result)) {
        router.refresh();
        onSuccess();
      }
      
      return result;
    },
    null
  );

  if (existingCount >= MAX_SETS) {
    return (
      <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          블록 세트는 최대 {MAX_SETS}개까지 생성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg border", bgSurface, "border-blue-200 dark:border-blue-800")}>
      <form action={formAction} className="flex flex-col gap-3">
        {state && isErrorResponse(state) && state.error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded">{state.error}</p>
        )}

        <div className="flex flex-col gap-2">
          <label className={cn("text-sm font-medium", textSecondary)}>새 세트 이름</label>
          <input
            type="text"
            name="name"
            placeholder={`${sourceSet.name} 복사본`}
            className={cn(inputFieldBase, "text-sm")}
            required
            maxLength={100}
          />
          <p className={cn("text-xs", textMuted)}>
            원본: {sourceSet.name}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            isLoading={isPending}
            fullWidth
            className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            복제
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            fullWidth
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}

