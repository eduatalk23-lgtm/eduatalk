"use client";

type SelectionToolbarProps = {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  isPending: boolean;
};

export function SelectionToolbar({
  count,
  onCancel,
  onDelete,
  isPending,
}: SelectionToolbarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-indigo-900">
          {count}개 선택됨
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "삭제 중..." : `선택한 항목 삭제 (${count}개)`}
        </button>
      </div>
    </div>
  );
}

