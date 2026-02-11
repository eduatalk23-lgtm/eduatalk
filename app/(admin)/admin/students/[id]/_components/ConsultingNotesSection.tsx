import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { ConsultingNotesForm } from "./ConsultingNotesForm";
import { ConsultingNoteDeleteButton } from "./ConsultingNoteDeleteButton";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import {
  SESSION_TYPE_COLORS,
  type SessionType,
} from "@/lib/domains/consulting/types";

type ConsultingNoteRow = {
  id: string;
  note?: string | null;
  created_at?: string | null;
  consultant_id?: string | null;
  session_type?: string | null;
  session_duration?: number | null;
  session_date?: string | null;
  next_action?: string | null;
  follow_up_date?: string | null;
  enrollment_id?: string | null;
  is_visible_to_parent?: boolean | null;
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
    // 새 컬럼은 마이그레이션 적용 후 사용 가능. 실패 시 기본 컬럼으로 폴백
    const extendedSelect =
      "id,note,created_at,consultant_id,session_type,session_duration,session_date,next_action,follow_up_date,enrollment_id,is_visible_to_parent";
    const basicSelect = "id,note,created_at,consultant_id";

    let notes: ConsultingNoteRow[] | null = null;
    let error: { message?: string; code?: string } | null = null;

    const extendedResult = await supabase
      .from("student_consulting_notes")
      .select(extendedSelect)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50);

    notes = (extendedResult.data ?? []) as ConsultingNoteRow[];
    error = extendedResult.error;

    // 새 컬럼이 없으면 기본 쿼리로 폴백
    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
      console.warn(
        "[ConsultingNotesSection] 확장 컬럼 없음, 기본 쿼리로 폴백:",
        error?.message
      );
      const basicResult = await supabase
        .from("student_consulting_notes")
        .select(basicSelect)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50);

      notes = (basicResult.data ?? []) as ConsultingNoteRow[];
      error = basicResult.error;
    }

    if (error) {
      console.error("[ConsultingNotesSection] 상담노트 조회 실패", {
        error,
        studentId,
      });
    }

    const noteRows = (notes as ConsultingNoteRow[] | null) ?? [];

    // active 수강 목록 조회 (폼 드롭다운용)
    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("id, programs(name)")
      .eq("student_id", studentId)
      .eq("status", "active");

    const enrollments = (enrollmentData ?? []).map((e) => {
      const prog = e.programs as unknown;
      const name =
        prog && typeof prog === "object" && "name" in prog
          ? (prog as { name: string }).name
          : Array.isArray(prog) && prog.length > 0
            ? (prog[0] as { name: string }).name
            : "프로그램";
      return { id: e.id, program_name: name };
    });

    return (
      <div
        className={cn(
          "flex flex-col gap-6 rounded-lg border p-6 shadow-sm",
          borderDefault,
          bgSurface
        )}
      >
        <h2 className={cn("text-xl font-semibold", textPrimary)}>상담노트</h2>

        {/* 상담노트 작성 폼 */}
        <div>
          <ConsultingNotesForm
            studentId={studentId}
            consultantId={consultantId}
            enrollments={enrollments}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              상담노트를 불러오는 중 오류가 발생했습니다.
            </p>
            <p className="text-xs text-red-600 dark:text-red-500">
              {error.message || `에러 코드: ${error.code || "알 수 없음"}`}
            </p>
          </div>
        )}

        {/* 상담노트 목록 */}
        {!error && noteRows.length === 0 ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
            <p className={cn("text-sm font-medium", textPrimary)}>
              상담노트가 없습니다.
            </p>
            <p className={cn("text-xs", textSecondary)}>
              위 폼에서 상담 내용을 작성하면 여기에 표시됩니다.
            </p>
          </div>
        ) : !error ? (
          <div className="flex flex-col gap-3">
            {noteRows.map((note) => {
              const sessionType = (note.session_type ?? "기타") as SessionType;
              const colorClass =
                SESSION_TYPE_COLORS[sessionType] ??
                SESSION_TYPE_COLORS["기타"];

              return (
                <div
                  key={note.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-4 transition",
                    borderDefault,
                    "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800"
                  )}
                >
                  {/* 헤더: 유형 뱃지 + 날짜 + 시간 + 삭제 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium",
                          colorClass
                        )}
                      >
                        {sessionType}
                      </span>
                      <span className={cn("text-xs", textSecondary)}>
                        {note.session_date
                          ? new Date(
                              note.session_date + "T00:00:00"
                            ).toLocaleDateString("ko-KR")
                          : note.created_at
                            ? new Date(note.created_at).toLocaleDateString(
                                "ko-KR"
                              )
                            : "-"}
                      </span>
                      {note.session_duration && (
                        <span className={cn("text-xs", textSecondary)}>
                          · {note.session_duration}분
                        </span>
                      )}
                    </div>
                    <ConsultingNoteDeleteButton
                      noteId={note.id}
                      studentId={studentId}
                    />
                  </div>

                  {/* 본문 */}
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-sm",
                      textPrimary
                    )}
                  >
                    {note.note ?? ""}
                  </p>

                  {/* 후속 조치 */}
                  {(note.next_action || note.follow_up_date) && (
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-2 rounded border px-3 py-1.5 text-xs",
                        "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                      )}
                    >
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        후속 조치:
                      </span>
                      {note.next_action && (
                        <span className={textSecondary}>
                          {note.next_action}
                        </span>
                      )}
                      {note.follow_up_date && (
                        <span className="text-amber-600 dark:text-amber-400">
                          (
                          {new Date(
                            note.follow_up_date + "T00:00:00"
                          ).toLocaleDateString("ko-KR")}
                          )
                        </span>
                      )}
                    </div>
                  )}

                  {/* 학부모 공개 표시 */}
                  {note.is_visible_to_parent && (
                    <span
                      className={cn(
                        "self-start rounded px-2 py-0.5 text-xs",
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}
                    >
                      학부모 공개
                    </span>
                  )}
                </div>
              );
            })}
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
      <div
        className={cn(
          "flex flex-col gap-6 rounded-lg border p-6",
          "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
        )}
      >
        <h2 className={cn("text-xl font-semibold", textPrimary)}>상담노트</h2>
        <div>
          <ConsultingNotesForm
            studentId={studentId}
            consultantId={consultantId}
          />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            상담노트를 불러오는 중 예상치 못한 오류가 발생했습니다.
          </p>
          <p className="text-xs text-red-600 dark:text-red-500">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }
}
