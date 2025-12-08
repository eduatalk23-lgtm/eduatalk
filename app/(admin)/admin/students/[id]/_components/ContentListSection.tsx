import {
  getBooks,
  getLectures,
  getCustomContents,
} from "@/lib/data/studentContents";

export async function ContentListSection({ studentId }: { studentId: string }) {
  try {
    const [booksResult, lecturesResult, customResult] =
      await Promise.allSettled([
        getBooks(studentId, null),
        getLectures(studentId, null),
        getCustomContents(studentId, null),
      ]);

    const books = booksResult.status === "fulfilled" ? booksResult.value : [];
    const lectures =
      lecturesResult.status === "fulfilled" ? lecturesResult.value : [];
    const customContents =
      customResult.status === "fulfilled" ? customResult.value : [];

    const totalCount = books.length + lectures.length + customContents.length;
    const hasErrors =
      booksResult.status === "rejected" ||
      lecturesResult.status === "rejected" ||
      customResult.status === "rejected";

    return (
      <div className="space-y-6">
        {hasErrors && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-700">
              일부 콘텐츠 정보를 불러오는 중 오류가 발생했습니다.
            </p>
            {booksResult.status === "rejected" && (
              <p className="mt-1 text-xs text-yellow-600">
                책 정보:{" "}
                {booksResult.reason instanceof Error
                  ? booksResult.reason.message
                  : "조회 실패"}
              </p>
            )}
            {lecturesResult.status === "rejected" && (
              <p className="mt-1 text-xs text-yellow-600">
                강의 정보:{" "}
                {lecturesResult.reason instanceof Error
                  ? lecturesResult.reason.message
                  : "조회 실패"}
              </p>
            )}
            {customResult.status === "rejected" && (
              <p className="mt-1 text-xs text-yellow-600">
                커스텀 콘텐츠 정보:{" "}
                {customResult.reason instanceof Error
                  ? customResult.reason.message
                  : "조회 실패"}
              </p>
            )}
          </div>
        )}

        {totalCount === 0 && !hasErrors ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              등록된 콘텐츠가 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              학생이 콘텐츠를 등록하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            {/* 책 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                📚 책 ({books.length}개)
              </h3>
              {books.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 책이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {books.slice(0, 10).map((book) => (
                    <div
                      key={book.id}
                      className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {book.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {book.subject && <span>과목: {book.subject}</span>}
                        {book.total_pages && (
                          <>
                            <span>·</span>
                            <span>총 {book.total_pages}페이지</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 강의 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                🎧 강의 ({lectures.length}개)
              </h3>
              {lectures.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 강의가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {lectures.slice(0, 10).map((lecture) => (
                    <div
                      key={lecture.id}
                      className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {lecture.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {lecture.subject && (
                          <span>과목: {lecture.subject}</span>
                        )}
                        {lecture.duration && (
                          <>
                            <span>·</span>
                            <span>
                              총 {Math.round(lecture.duration / 60)}분
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 커스텀 콘텐츠 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                📝 커스텀 콘텐츠 ({customContents.length}개)
              </h3>
              {customContents.length === 0 ? (
                <p className="text-sm text-gray-500">
                  등록된 커스텀 콘텐츠가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {customContents.slice(0, 10).map((content) => (
                    <div
                      key={content.id}
                      className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {content.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {content.subject && (
                          <span>과목: {content.subject}</span>
                        )}
                        {content.total_page_or_time && (
                          <>
                            <span>·</span>
                            <span>총 {content.total_page_or_time}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error("[ContentListSection] 콘텐츠 조회 실패", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          콘텐츠 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}
