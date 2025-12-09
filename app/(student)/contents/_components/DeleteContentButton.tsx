"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type DeleteContentButtonProps = {
  id: string;
  contentType: "books" | "lectures" | "custom";
  onDelete: (id: string) => Promise<void>;
};

export function DeleteContentButton({
  id,
  contentType,
  onDelete,
}: DeleteContentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("정말로 이 콘텐츠를 삭제하시겠습니까?")) {
      return;
    }

    startTransition(async () => {
      try {
        await onDelete(id);
        router.refresh();
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "콘텐츠 삭제에 실패했습니다."
        );
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "삭제 중..." : "삭제"}
    </button>
  );
}

