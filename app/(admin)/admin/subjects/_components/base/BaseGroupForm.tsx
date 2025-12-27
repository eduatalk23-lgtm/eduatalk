"use client";

import Button from "@/components/atoms/Button";

type BaseGroupFormProps = {
  name: string;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  variant?: "inline" | "modal";
};

export default function BaseGroupForm({
  name,
  isPending,
  onNameChange,
  onSubmit,
  onCancel,
  variant = "modal",
}: BaseGroupFormProps) {
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
            placeholder="예: 국어"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isPending}
            autoFocus={!isInline}
          />
        </div>
        {isInline && (
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending}
              isLoading={isPending}
            >
              {isPending ? "저장 중..." : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              취소
            </Button>
          </div>
        )}
      </div>
      {!isInline && (
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
            isLoading={isPending}
          >
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}
    </form>
  );
}

