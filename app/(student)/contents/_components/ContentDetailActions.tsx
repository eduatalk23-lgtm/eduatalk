// 공통 콘텐츠 상세 액션 버튼 컴포넌트

type ContentDetailActionsProps = {
  backHref: string;
  backLabel?: string;
  deleteAction?: () => void;
  deleteLabel?: string;
  additionalActions?: React.ReactNode;
};

export function ContentDetailActions({
  backHref,
  backLabel = "목록으로",
  deleteAction,
  deleteLabel = "삭제하기",
  additionalActions,
}: ContentDetailActionsProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
      <a
        href={backHref}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        ← {backLabel}
      </a>
      <div className="flex gap-2">
        {additionalActions}
        {deleteAction && (
          <form action={deleteAction}>
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm("정말 삭제하시겠습니까?")) {
                  e.preventDefault();
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {deleteLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

