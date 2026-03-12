export function GuestPaymentAlreadyPaid() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-5">
      <div className="w-full rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-8 w-8 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            이미 결제가 완료된 건입니다
          </h1>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            해당 수강료는 이미 결제되었습니다.
            <br />
            궁금한 점이 있으시면 학원에 문의해 주세요.
          </p>
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
            이 페이지를 닫으셔도 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
