export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200"></div>
        <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-gray-200"></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 h-6 w-32 animate-pulse rounded-lg bg-gray-200"></div>
            <div className="mb-2 h-8 w-24 animate-pulse rounded-lg bg-gray-200"></div>
            <div className="h-4 w-full animate-pulse rounded-lg bg-gray-200"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

