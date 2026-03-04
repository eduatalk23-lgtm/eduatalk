import { ErrorState } from "@/components/ui/ErrorState";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ErrorState
        icon="🔍"
        title="페이지를 찾을 수 없습니다"
        message="요청하신 페이지가 존재하지 않거나 이동되었습니다."
        actionHref="/"
        actionLabel="홈으로 이동"
      />
    </div>
  );
}
