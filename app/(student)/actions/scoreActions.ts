"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createSchoolScore,
  updateSchoolScore,
  deleteSchoolScore,
  createMockScore,
  updateMockScore,
  deleteMockScore,
} from "@/lib/data/studentScores";
import { recordHistory } from "@/lib/history/record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 내신 성적 등록
export async function addSchoolScore(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const grade = Number(formData.get("grade"));
  const semester = Number(formData.get("semester"));
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const creditHoursInput = String(formData.get("credit_hours") ?? "").trim();
  const rawScoreInput = String(formData.get("raw_score") ?? "").trim();
  const subjectAverageInput = String(formData.get("subject_average") ?? "").trim();
  const standardDeviationInput = String(formData.get("standard_deviation") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const totalStudentsInput = String(formData.get("total_students") ?? "").trim();
  const rankGradeInput = String(formData.get("rank_grade") ?? "").trim();

  // 필수 필드 검증
  if (!grade || !semester || !subjectGroup || !subjectType || !subjectName || !rawScoreInput || !gradeScoreInput) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }

  if (grade < 1 || grade > 3) {
    throw new Error("학년은 1~3 사이여야 합니다.");
  }

  if (semester !== 1 && semester !== 2) {
    throw new Error("학기는 1 또는 2여야 합니다.");
  }

  const rawScore = Number(rawScoreInput);
  if (!Number.isFinite(rawScore) || rawScore < 0) {
    throw new Error("원점수는 0 이상의 숫자여야 합니다.");
  }

  const gradeScore = Number(gradeScoreInput);
  if (!Number.isFinite(gradeScore) || gradeScore < 1 || gradeScore > 9) {
    throw new Error("등급은 1~9 사이의 숫자여야 합니다.");
  }

  // 선택 필드 검증
  const creditHours = creditHoursInput ? Number(creditHoursInput) : null;
  if (creditHours !== null && (!Number.isFinite(creditHours) || creditHours <= 0)) {
    throw new Error("학점수는 양수여야 합니다.");
  }

  const subjectAverage = subjectAverageInput ? Number(subjectAverageInput) : null;
  if (subjectAverage !== null && !Number.isFinite(subjectAverage)) {
    throw new Error("과목평균은 올바른 숫자여야 합니다.");
  }

  const standardDeviation = standardDeviationInput ? Number(standardDeviationInput) : null;
  if (standardDeviation !== null && !Number.isFinite(standardDeviation)) {
    throw new Error("표준편차는 올바른 숫자여야 합니다.");
  }

  const totalStudents = totalStudentsInput ? Number(totalStudentsInput) : null;
  if (totalStudents !== null && (!Number.isFinite(totalStudents) || totalStudents <= 0)) {
    throw new Error("수강자수는 양수여야 합니다.");
  }

  const rankGrade = rankGradeInput ? Number(rankGradeInput) : null;
  if (rankGrade !== null && (!Number.isFinite(rankGrade) || rankGrade < 1 || rankGrade > 9)) {
    throw new Error("석차등급은 1~9 사이의 숫자여야 합니다.");
  }

  const result = await createSchoolScore({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    grade,
    semester,
    subject_group: subjectGroup,
    subject_type: subjectType,
    subject_name: subjectName,
    credit_hours: creditHours,
    raw_score: rawScore,
    subject_average: subjectAverage,
    standard_deviation: standardDeviation,
    grade_score: gradeScore,
    total_students: totalStudents,
    rank_grade: rankGrade,
  });

  if (!result.success) {
    throw new Error(result.error || "내신 성적 등록에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(supabase, user.userId, "score_added", {
    score_type: "school",
    grade,
    semester,
    subject_group: subjectGroup,
    subject_name: subjectName,
    grade_score: gradeScore,
  });

  revalidatePath(`/scores/school/${grade}/${semester}`);
  redirect(`/scores/school/${grade}/${semester}?success=created`);
}

// 내신 성적 수정
export async function updateSchoolScoreAction(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const grade = Number(formData.get("grade"));
  const semester = Number(formData.get("semester"));
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const creditHoursInput = String(formData.get("credit_hours") ?? "").trim();
  const rawScoreInput = String(formData.get("raw_score") ?? "").trim();
  const subjectAverageInput = String(formData.get("subject_average") ?? "").trim();
  const standardDeviationInput = String(formData.get("standard_deviation") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const totalStudentsInput = String(formData.get("total_students") ?? "").trim();
  const rankGradeInput = String(formData.get("rank_grade") ?? "").trim();

  // 필수 필드 검증
  if (!grade || !semester || !subjectGroup || !subjectType || !subjectName || !rawScoreInput || !gradeScoreInput) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }

  const rawScore = Number(rawScoreInput);
  if (!Number.isFinite(rawScore) || rawScore < 0) {
    throw new Error("원점수는 0 이상의 숫자여야 합니다.");
  }

  const gradeScore = Number(gradeScoreInput);
  if (!Number.isFinite(gradeScore) || gradeScore < 1 || gradeScore > 9) {
    throw new Error("등급은 1~9 사이의 숫자여야 합니다.");
  }

  const creditHours = creditHoursInput ? Number(creditHoursInput) : null;
  const subjectAverage = subjectAverageInput ? Number(subjectAverageInput) : null;
  const standardDeviation = standardDeviationInput ? Number(standardDeviationInput) : null;
  const totalStudents = totalStudentsInput ? Number(totalStudentsInput) : null;
  const rankGrade = rankGradeInput ? Number(rankGradeInput) : null;

  const result = await updateSchoolScore(id, user.userId, {
    grade,
    semester,
    subject_group: subjectGroup,
    subject_type: subjectType,
    subject_name: subjectName,
    credit_hours: creditHours,
    raw_score: rawScore,
    subject_average: subjectAverage,
    standard_deviation: standardDeviation,
    grade_score: gradeScore,
    total_students: totalStudents,
    rank_grade: rankGrade,
  });

  if (!result.success) {
    throw new Error(result.error || "내신 성적 수정에 실패했습니다.");
  }

  revalidatePath(`/scores/school/${grade}/${semester}`);
  redirect(`/scores/school/${grade}/${semester}?success=updated`);
}

// 내신 성적 삭제
export async function deleteSchoolScoreAction(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const result = await deleteSchoolScore(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "내신 성적 삭제에 실패했습니다.");
  }

  revalidatePath("/scores");
  redirect("/scores");
}

// 모의고사 성적 등록
export async function addMockScore(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const grade = Number(formData.get("grade"));
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const standardScoreInput = String(formData.get("standard_score") ?? "").trim();
  const percentileInput = String(formData.get("percentile") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const examRound = String(formData.get("exam_round") ?? "").trim(); // month
  const testDate = String(formData.get("test_date") ?? "").trim();

  // 영어/한국사 여부
  const isEnglishOrKoreanHistory = subjectGroup === "영어" || subjectGroup === "한국사";

  // 유효성 검증
  if (!grade || !subjectGroup || !examType || !subjectName || !gradeScoreInput || !testDate) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }

  if (grade < 1 || grade > 3) {
    throw new Error("학년은 1~3 사이여야 합니다.");
  }

  const gradeScore = Number(gradeScoreInput);
  if (!Number.isFinite(gradeScore) || gradeScore < 1 || gradeScore > 9) {
    throw new Error("등급은 1~9 사이의 숫자여야 합니다.");
  }

  // 영어/한국사가 아닌 경우 표준점수, 백분위 필수
  if (!isEnglishOrKoreanHistory) {
    if (!standardScoreInput || !percentileInput) {
      throw new Error("표준점수와 백분위를 모두 입력해주세요.");
    }
  }

  const standardScore = standardScoreInput ? Number(standardScoreInput) : null;
  if (standardScore !== null && !Number.isFinite(standardScore)) {
    throw new Error("표준점수는 올바른 숫자여야 합니다.");
  }

  const percentile = percentileInput ? Number(percentileInput) : null;
  if (percentile !== null && (!Number.isFinite(percentile) || percentile < 0 || percentile > 100)) {
    throw new Error("백분위는 0~100 사이의 숫자여야 합니다.");
  }

  // 날짜 유효성 검증
  const testDateObj = new Date(`${testDate}T00:00:00Z`);
  if (Number.isNaN(testDateObj.getTime())) {
    throw new Error("올바른 날짜 형식을 입력해주세요.");
  }

  const result = await createMockScore({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    grade,
    subject_group: subjectGroup,
    exam_type: examType,
    subject_name: subjectName,
    raw_score: null, // 원점수 제거
    standard_score: standardScore,
    percentile: percentile,
    grade_score: gradeScore,
    exam_round: examRound || null,
    test_date: testDate,
  });

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 등록에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(supabase, user.userId, "score_added", {
    score_type: "mock",
    grade,
    exam_type: examType,
    subject_group: subjectGroup,
    subject_name: subjectName,
    grade_score: gradeScore,
    test_date: testDate,
  });

  // exam_round를 month로 사용하여 새로운 경로 구조로 redirect (학년-월-시험유형)
  const month = examRound || "3"; // 기본값 3월
  revalidatePath(`/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`);
  redirect(`/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}?success=created`);
}

// 모의고사 성적 수정
export async function updateMockScoreAction(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const grade = Number(formData.get("grade"));
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const standardScoreInput = String(formData.get("standard_score") ?? "").trim();
  const percentileInput = String(formData.get("percentile") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const examRound = String(formData.get("exam_round") ?? "").trim();
  const testDate = String(formData.get("test_date") ?? "").trim();

  // 영어/한국사 여부
  const isEnglishOrKoreanHistory = subjectGroup === "영어" || subjectGroup === "한국사";

  // 유효성 검증
  if (!grade || !subjectGroup || !examType || !subjectName || !gradeScoreInput || !testDate) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }

  const gradeScore = Number(gradeScoreInput);
  if (!Number.isFinite(gradeScore) || gradeScore < 1 || gradeScore > 9) {
    throw new Error("등급은 1~9 사이의 숫자여야 합니다.");
  }

  // 영어/한국사가 아닌 경우 표준점수, 백분위 필수
  if (!isEnglishOrKoreanHistory) {
    if (!standardScoreInput || !percentileInput) {
      throw new Error("표준점수와 백분위를 모두 입력해주세요.");
    }
  }

  const standardScore = standardScoreInput ? Number(standardScoreInput) : null;
  const percentile = percentileInput ? Number(percentileInput) : null;

  const result = await updateMockScore(id, user.userId, {
    grade,
    subject_group: subjectGroup,
    exam_type: examType,
    subject_name: subjectName,
    raw_score: null, // 원점수 제거
    standard_score: standardScore,
    percentile: percentile,
    grade_score: gradeScore,
    exam_round: examRound || null,
    test_date: testDate,
  });

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 수정에 실패했습니다.");
  }

  // exam_round를 month로 사용하여 새로운 경로 구조로 redirect (학년-월-시험유형)
  const month = examRound || "3"; // 기본값 3월
  revalidatePath(`/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`);
  redirect(`/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}?success=updated`);
}

// 모의고사 성적 삭제
export async function deleteMockScoreAction(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const result = await deleteMockScore(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 삭제에 실패했습니다.");
  }

  // 삭제 후 revalidate만 하고, redirect는 호출하는 컴포넌트에서 처리
  revalidatePath("/scores/mock");
  // redirect는 하지 않음 (컴포넌트에서 router.refresh()로 처리)
}

