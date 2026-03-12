export default function PaymentLoading() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      {/* 헤더 스켈레톤 */}
      <header className="bg-white px-5 py-4 shadow-sm dark:bg-gray-800">
        <div className="mx-auto h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </header>

      <main className="flex flex-1 flex-col gap-4 p-5">
        {/* 결제 정보 카드 스켈레톤 */}
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div className="flex justify-between">
              <div className="h-4 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-6 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* 결제 위젯 스켈레톤 */}
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-400 dark:text-gray-500">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
