import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateInternalScore, updateMockScore } from "@/app/actions/scores-internal";
import { detectScoreType, getScoreById } from "@/lib/utils/scoreTypeDetector";
import { getSubjectById } from "@/lib/data/subjects";
import { ScoreForm } from "../../_components/ScoreForm";
import { getContainerClass } from "@/lib/constants/layout";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

type ScoreRow = {
  id: string;
  subject_type: string | null;
  semester: string | null;
  course: string | null;
  course_detail: string | null;
  raw_score: number | null;
  grade: number | null;
  score_type_detail: string | null;
  test_date: string | null;
};

type EditScorePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * 내신 성적을 레거시 ScoreRow 형태로 변환
 */
function convertInternalScoreToLegacy(
  score: any,
  subject: { name: string; subjectGroup: { name: string } } | null
): ScoreRow {
  return {
    id: score.id,
    subject_type: score.subject_type_id ? "일반선택" : null, // TODO: subject_type_id로 실제 타입 조회 필요
    semester: score.semester ? `${score.grade}-${score.semester}` : null,
    course: subject?.subjectGroup.name ?? null,
    course_detail: subject?.name ?? null,
    raw_score: score.raw_score,
    grade: score.rank_grade ?? null,
    score_type_detail: "내신",
    test_date: null, // 내신은 test_date 없음
  };
}

/**
 * 모의고사 성적을 레거시 ScoreRow 형태로 변환
 */
function convertMockScoreToLegacy(
  score: any,
  subject: { name: string; subjectGroup: { name: string } } | null
): ScoreRow {
  return {
    id: score.id,
    subject_type: null,
    semester: null,
    course: subject?.subjectGroup.name ?? null,
    course_detail: subject?.name ?? null,
    raw_score: score.raw_score,
    grade: score.grade_score ?? null,
    score_type_detail: "모의고사",
    test_date: score.exam_date ?? null,
  };
}

/**
 * 레거시 FormData를 내신 성적 업데이트 형태로 변환
 */
async function handleUpdateInternalScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) {
    throw new Error("로그인이 필요합니다.");
  }

  // FormData에 tenant_id 추가
  formData.append("tenant_id", user.tenantId);

  await updateInternalScore(scoreId, formData);
}

/**
 * 레거시 FormData를 모의고사 성적 업데이트 형태로 변환
 */
async function handleUpdateMockScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) {
    throw new Error("로그인이 필요합니다.");
  }

  // FormData에 tenant_id 추가
  formData.append("tenant_id", user.tenantId);
  // exam_date는 test_date에서 가져옴
  const testDate = formData.get("test_date") as string;
  if (testDate) {
    formData.append("exam_date", testDate);
  }
  // exam_title은 기본값 설정 (필요시 수정)
  if (!formData.get("exam_title")) {
    formData.append("exam_title", "모의고사");
  }

  await updateMockScore(scoreId, formData);
}

export default async function EditScorePage({ params }: EditScorePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // 성적 타입 확인 및 데이터 조회
  const scoreResult = await getScoreById(id, user.userId);

  if (!scoreResult) {
    notFound();
  }

  const { type, data: scoreData } = scoreResult;

  // 과목 정보 조회 (표시용)
  let subject = null;
  if (scoreData.subject_id) {
    subject = await getSubjectById(scoreData.subject_id);
  }

  // 레거시 형태로 변환
  const legacyScore: ScoreRow =
    type === "internal"
      ? convertInternalScoreToLegacy(scoreData, subject)
      : convertMockScoreToLegacy(scoreData, subject);

  // 업데이트 액션 선택
  const updateAction =
    type === "internal"
      ? (formData: FormData) => handleUpdateInternalScore(id, formData)
      : (formData: FormData) => handleUpdateMockScore(id, formData);

  return (
    <section className={getContainerClass("FORM", "lg")}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-gray-900">성적 수정</h1>
        <p className="text-sm text-gray-500">
          성적 정보를 수정하세요. ({type === "internal" ? "내신" : "모의고사"})
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <ScoreForm
          action={updateAction}
          initialData={{
            subject_type: legacyScore.subject_type ?? "",
            semester: legacyScore.semester ?? "",
            course: legacyScore.course ?? "",
            course_detail: legacyScore.course_detail ?? "",
            raw_score: legacyScore.raw_score?.toString() ?? "",
            grade: legacyScore.grade?.toString() ?? "",
            score_type_detail: legacyScore.score_type_detail ?? "",
            test_date: legacyScore.test_date
              ? new Date(legacyScore.test_date).toISOString().split("T")[0]
              : "",
          }}
        />
      </div>
    </section>
  );
}

