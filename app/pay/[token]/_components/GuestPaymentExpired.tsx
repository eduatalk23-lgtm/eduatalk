type GuestPaymentExpiredProps = {
  reason: "expired" | "cancelled" | "not_found";
};

const MESSAGES: Record<string, { title: string; description: string }> = {
  expired: {
    title: "결제 링크가 만료되었습니다",
    description: "유효기간이 지난 링크입니다. 학원에 문의하여 새 링크를 요청해 주세요.",
  },
  cancelled: {
    title: "취소된 결제 링크입니다",
    description: "이 결제 링크는 취소되었습니다. 학원에 문의해 주세요.",
  },
  not_found: {
    title: "유효하지 않은 링크입니다",
    description: "존재하지 않는 결제 링크입니다. 주소를 다시 확인해 주세요.",
  },
};

export function GuestPaymentExpired({ reason }: GuestPaymentExpiredProps) {
  const { title, description } = MESSAGES[reason] ?? MESSAGES.not_found;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-5">
      <div className="w-full rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">{description}</p>
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
            이 페이지를 닫으셔도 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
