// 공통 콘텐츠 액션 버튼 컴포넌트

import Link from "next/link";

type ContentActionButtonsProps = {
  editHref: string;
  deleteAction: () => void;
  listHref?: string; // 목록으로 돌아가기 링크 (선택사항)
};

export function ContentActionButtons({
  editHref,
  deleteAction,
  listHref,
}: ContentActionButtonsProps) {
  return (
    <div className="mt-10 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {listHref && (
          <Link
            href={listHref}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            목록으로
          </Link>
        )}
        <Link
          href={editHref}
          className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:border-gray-900"
        >
          수정하기
        </Link>
        <form action={deleteAction} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            삭제하기
          </button>
        </form>
      </div>
    </div>
  );
}

