import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const selectNotes = () =>
    supabase
      .from("student_consulting_notes")
      .select("id,note,created_at,consultant_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10);

  let { data: notes, error } = await selectNotes();

  if (error && error.code === "42703") {
    ({ data: notes, error } = await selectNotes());
  }

  if (error) {
    console.error("[admin/students] 상담노트 조회 실패", error);
  }

  const noteRows = (notes as ConsultingNoteRow[] | null) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">상담노트</h2>

      {/* 상담노트 작성 폼 */}
      <div className="mb-6">
        <ConsultingNotesForm studentId={studentId} consultantId={consultantId} />
      </div>

      {/* 상담노트 목록 */}
      {noteRows.length === 0 ? (
        <p className="text-sm text-gray-500">상담노트가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {noteRows.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:bg-gray-100"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {note.created_at
                    ? new Date(note.created_at).toLocaleString("ko-KR")
                    : "-"}
                </span>
                <ConsultingNoteDeleteButton noteId={note.id} studentId={studentId} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-900">{note.note ?? ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

