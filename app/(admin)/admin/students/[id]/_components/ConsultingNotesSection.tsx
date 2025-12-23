import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { ConsultingNotesForm } from "./ConsultingNotesForm";
import { ConsultingNoteDeleteButton } from "./ConsultingNoteDeleteButton";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ConsultingNoteRow = {
  id: string;
  note?: string | null;
  created_at?: string | null;
  consultant_id?: string | null;
};

export async function ConsultingNotesSection({
  studentId,
  consultantId,
}: {
  studentId: string;
  consultantId: string;
}) {
  const supabase = await createSupabaseServerClient();

  try {
    const selectNotes = () =>
      supabase
        .from("student_consulting_notes")
        .select("id,note,created_at,consultant_id")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(10);

    let { data: notes, error } = await selectNotes();

    // 컬럼이 없으면 재시도 (하위 호환성)
    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      console.warn(
        "[ConsultingNotesSection] 컬럼 오류, 재시도:",
        error?.message
      );
      ({ data: notes, error } = await selectNotes());
    }

    if (error) {
      console.error("[ConsultingNotesSection] 상담노트 조회 실패", {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        studentId,
      });
    }

    const noteRows = (notes as ConsultingNoteRow[] | null) ?? [];

    // 디버깅 로그
    console.log("[ConsultingNotesSection] 상담노트 조회 결과", {
      studentId,
      notesCount: noteRows.length,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
    });

    return (
      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">상담노트</h2>

        {/* 상담노트 작성 폼 */}
        <div>
          <ConsultingNotesForm
            studentId={studentId}
            consultantId={consultantId}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              상담노트를 불러오는 중 오류가 발생했습니다.
            </p>
            <p className="text-xs text-red-600">
              {error.message || `에러 코드: ${error.code || "알 수 없음"}`}
            </p>
            {error.code === "42P01" && (
              <p className="text-xs text-red-600">
                테이블이 존재하지 않습니다. 데이터베이스 마이그레이션이 필요할
                수 있습니다.
              </p>
            )}
          </div>
        )}

        {/* 상담노트 목록 */}
        {!error && noteRows.length === 0 ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              상담노트가 없습니다.
            </p>
            <p className="text-xs text-gray-500">
              위 폼에서 상담 내용을 작성하면 여기에 표시됩니다.
            </p>
          </div>
        ) : !error ? (
          <div className="flex flex-col gap-3">
            {noteRows.map((note) => (
              <div
                key={note.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:bg-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {note.created_at
                      ? new Date(note.created_at).toLocaleString("ko-KR")
                      : "-"}
                  </span>
                  <ConsultingNoteDeleteButton
                    noteId={note.id}
                    studentId={studentId}
                  />
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-900">
                  {note.note ?? ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    console.error("[ConsultingNotesSection] 예상치 못한 오류", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="flex flex-col gap-6 rounded-lg border border-red-300 bg-red-50 p-6">
        <h2 className="text-xl font-semibold text-gray-900">상담노트</h2>
        <div>
          <ConsultingNotesForm
            studentId={studentId}
            consultantId={consultantId}
          />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            상담노트를 불러오는 중 예상치 못한 오류가 발생했습니다.
          </p>
          <p className="text-xs text-red-600">{errorMessage}</p>
        </div>
      </div>
    );
  }
}
