"use client";

type BaseSubjectTypeFormProps = {
  name: string;
  isActive: boolean;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  variant?: "inline" | "modal";
};

export default function BaseSubjectTypeForm({
  name,
  isActive,
  isPending,
  onNameChange,
  onIsActiveChange,
  onSubmit,
  onCancel,
  variant = "modal",
}: BaseSubjectTypeFormProps) {
  const isInline = variant === "inline";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className={isInline ? "flex flex-col gap-4 md:flex-row md:items-end" : "flex flex-col gap-4"}>
        <div className={isInline ? "flex-1" : ""}>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="예: 공통"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isPending}
            autoFocus={!isInline}
          />
        </div>
        <div className={isInline ? "flex items-center gap-2" : "flex items-center gap-2"}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => onIsActiveChange(e.target.checked)}
              className="rounded border-gray-300"
              disabled={isPending}
            />
            <span className="text-sm text-gray-700">활성</span>
          </label>
        </div>
        {isInline && (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        )}
      </div>
      {!isInline && (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </form>
  );
}

