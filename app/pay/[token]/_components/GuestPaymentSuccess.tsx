type GuestPaymentSuccessProps = {
  academyName: string;
  programName: string;
  amount: number;
  receiptUrl: string | null;
};

export function GuestPaymentSuccess({
  academyName,
  programName,
  amount,
  receiptUrl,
}: GuestPaymentSuccessProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-5">
      <div className="w-full rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col items-center gap-4">
          {/* 체크 아이콘 */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">결제가 완료되었습니다</h1>

          <div className="w-full space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">학원</span>
              <span className="text-gray-900 dark:text-gray-100">{academyName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">프로그램</span>
              <span className="text-gray-900 dark:text-gray-100">{programName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">결제금액</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {amount.toLocaleString()}원
              </span>
            </div>
          </div>

          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700"
            >
              영수증 보기
            </a>
          )}

          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
            이 페이지를 닫으셔도 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
