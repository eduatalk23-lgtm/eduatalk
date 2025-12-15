"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createBlockSet,
  updateBlockSet,
  deleteBlockSet,
  setActiveBlockSet,
  duplicateBlockSet,
} from "@/app/actions/blockSets";
import { validateFormData, blockSetSchema } from "@/lib/validation/schemas";
import { inputFieldBase, inlineButtonPrimary, modalCancelButton, textPrimary, textSecondary, textTertiary, textMuted, bgSurface, borderDefault, borderInput, bgStyles } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

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
    try {
      const formData = new FormData();
      formData.append("id", setId);
      await setActiveBlockSet(formData);
      
      // onSetChange 콜백 호출하여 부모 컴포넌트 상태 업데이트 (완료 대기)
      if (onSetChange) {
        await onSetChange(setId);
      }
      
      // 클라이언트 상태로 관리하므로 refresh 불필요
      // router.refresh();
    } catch (error: any) {
      // 네트워크 에러 구분
      const isNetworkError = 
        error?.message?.includes("Failed to fetch") ||
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("network") ||
        error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT";
      
      const errorMessage = isNetworkError
        ? "네트워크 연결을 확인해주세요. 잠시 후 다시 시도해주세요."
        : error?.message || "활성 세트 전환에 실패했습니다.";
      
      alert(errorMessage);
    }
  };

  const handleDelete = async (setId: string, setName: string) => {
    if (!confirm(`"${setName}" 세트를 삭제하시겠습니까? 포함된 모든 블록도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append("id", setId);
      await deleteBlockSet(formData);
      
      router.refresh();
    } catch (error: any) {
      alert(error.message || "세트 삭제에 실패했습니다.");
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
    async (_prev: { error: string | null }, formData: FormData) => {
      try {
        const validation = validateFormData(formData, blockSetSchema);
        if (!validation.success) {
          const firstError = validation.errors.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다." };
        }

        await createBlockSet(formData);
        router.refresh();
        onSuccess();
        return { error: null };
      } catch (err: any) {
        return { error: err.message || "세트 생성에 실패했습니다." };
      }
    },
    { error: null }
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
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <form action={formAction} className="flex flex-col gap-3">
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
    async (_prev: { error: string | null }, formData: FormData) => {
      try {
        formData.append("id", set.id);
        const validation = validateFormData(formData, blockSetSchema);
        if (!validation.success) {
          const firstError = validation.errors.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다." };
        }

        await updateBlockSet(formData);
        router.refresh();
        onSuccess();
        return { error: null };
      } catch (err: any) {
        return { error: err.message || "세트 수정에 실패했습니다." };
      }
    },
    { error: null }
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state.error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-1 rounded">{state.error}</p>
      )}
      <input
        type="text"
        name="name"
        defaultValue={set.name}
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm flex-1"
        required
        maxLength={100}
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        저장
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        취소
      </button>
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
    async (_prev: { error: string | null }, formData: FormData) => {
      try {
        formData.append("source_id", sourceSet.id);
        const validation = validateFormData(formData, blockSetSchema);
        if (!validation.success) {
          const firstError = validation.errors.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다." };
        }

        await duplicateBlockSet(formData);
        router.refresh();
        onSuccess();
        return { error: null };
      } catch (err: any) {
        return { error: err.message || "세트 복제에 실패했습니다." };
      }
    },
    { error: null }
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
        {state.error && (
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
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              inlineButtonPrimary(),
              "flex-1 px-4 py-2 text-sm font-medium disabled:opacity-50",
              "bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white"
            )}
          >
            {isPending ? "복제 중..." : "복제"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={cn(modalCancelButton, "flex-1 disabled:opacity-50")}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

