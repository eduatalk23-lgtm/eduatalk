import { getSiblings, findSiblingCandidates } from "@/lib/domains/family";
import type { SiblingCandidate, FamilyStudent } from "@/lib/domains/family";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FamilySectionClient } from "./FamilySectionClient";

type Props = {
  studentId: string;
};

export async function FamilySection({ studentId }: Props) {
  const supabase = await createSupabaseServerClient();

  // 학생의 가족 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, family_id")
    .eq("id", studentId)
    .single();

  const familyId = student?.family_id ?? null;

  // 형제자매 조회
  let siblings: FamilyStudent[] = [];
  if (familyId) {
    const siblingsResult = await getSiblings(studentId);
    siblings = siblingsResult.success ? siblingsResult.data || [] : [];
  }

  // 형제자매 후보 감지 (가족이 없는 경우)
  let candidates: SiblingCandidate[] = [];
  if (!familyId) {
    const candidatesResult = await findSiblingCandidates(studentId);
    candidates = candidatesResult.success
      ? candidatesResult.data?.candidates || []
      : [];
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <svg
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          형제/자매
        </h3>
      </div>

      <FamilySectionClient
        studentId={studentId}
        familyId={familyId}
        candidates={candidates}
        siblings={siblings}
      />
    </div>
  );
}
