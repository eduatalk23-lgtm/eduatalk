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
import { getSubjectById, getSubjectGroupById, getActiveCurriculumRevision } from "@/lib/data/subjects";
import type { MockScore } from "@/lib/domains/score/types";

/**
 * 내신 성적 등록 (레거시)
 * 
 * @deprecated Phase 4 이후 삭제 예정. createInternalScore를 사용하세요
 */
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
  // FK 필드 (우선 사용)
  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim();
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const creditHoursInput = String(formData.get("credit_hours") ?? "").trim();
  const rawScoreInput = String(formData.get("raw_score") ?? "").trim();
  const subjectAverageInput = String(
    formData.get("subject_average") ?? ""
  ).trim();
  const standardDeviationInput = String(
    formData.get("standard_deviation") ?? ""
  ).trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const totalStudentsInput = String(
    formData.get("total_students") ?? ""
  ).trim();
  const rankGradeInput = String(formData.get("rank_grade") ?? "").trim();

  // 필수 필드 검증
  if (
    !grade ||
    !semester ||
    !subjectGroup ||
    !subjectType ||
    !subjectName ||
    !rawScoreInput ||
    !gradeScoreInput
  ) {
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
  if (
    creditHours !== null &&
    (!Number.isFinite(creditHours) || creditHours <= 0)
  ) {
    throw new Error("학점수는 양수여야 합니다.");
  }

  const subjectAverage = subjectAverageInput
    ? Number(subjectAverageInput)
    : null;
  if (subjectAverage !== null && !Number.isFinite(subjectAverage)) {
    throw new Error("과목평균은 올바른 숫자여야 합니다.");
  }

  const standardDeviation = standardDeviationInput
    ? Number(standardDeviationInput)
    : null;
  if (standardDeviation !== null && !Number.isFinite(standardDeviation)) {
    throw new Error("표준편차는 올바른 숫자여야 합니다.");
  }

  const totalStudents = totalStudentsInput ? Number(totalStudentsInput) : null;
  if (
    totalStudents !== null &&
    (!Number.isFinite(totalStudents) || totalStudents <= 0)
  ) {
    throw new Error("수강자수는 양수여야 합니다.");
  }

  const rankGrade = rankGradeInput ? Number(rankGradeInput) : null;
  if (
    rankGrade !== null &&
    (!Number.isFinite(rankGrade) || rankGrade < 1 || rankGrade > 9)
  ) {
    throw new Error("석차등급은 1~9 사이의 숫자여야 합니다.");
  }

  const result = await createSchoolScore({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    grade,
    semester,
    // FK 필드 (우선 사용)
    subject_group_id: subjectGroupId || undefined,
    subject_id: subjectId || undefined,
    subject_type_id: subjectTypeId || undefined,
    // 하위 호환성을 위한 텍스트 필드 (deprecated)
    subject_group: subjectGroup || undefined,
    subject_type: subjectType || undefined,
    subject_name: subjectName || undefined,
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
  await recordHistory(
    supabase,
    user.userId,
    "score_added",
    {
      score_type: "school",
      grade,
      semester,
      subject_group: subjectGroup,
      subject_name: subjectName,
      grade_score: gradeScore,
    },
    tenantContext.tenantId
  );

  revalidatePath(`/scores/school/${grade}/${semester}`);

  // skipRedirect 옵션이 있으면 redirect하지 않음 (모달 사용 시)
  const skipRedirect = formData.get("skipRedirect") === "true";
  if (!skipRedirect) {
    redirect(`/scores/school/${grade}/${semester}?success=created`);
  }
}

/**
 * 내신 성적 수정 (레거시)
 * 
 * @deprecated Phase 4 이후 삭제 예정. updateInternalScore를 사용하세요
 */
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
  // FK 필드 (우선 사용)
  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim();
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const creditHoursInput = String(formData.get("credit_hours") ?? "").trim();
  const rawScoreInput = String(formData.get("raw_score") ?? "").trim();
  const subjectAverageInput = String(
    formData.get("subject_average") ?? ""
  ).trim();
  const standardDeviationInput = String(
    formData.get("standard_deviation") ?? ""
  ).trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const totalStudentsInput = String(
    formData.get("total_students") ?? ""
  ).trim();
  const rankGradeInput = String(formData.get("rank_grade") ?? "").trim();

  // 필수 필드 검증
  if (
    !grade ||
    !semester ||
    !subjectGroup ||
    !subjectType ||
    !subjectName ||
    !rawScoreInput ||
    !gradeScoreInput
  ) {
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
  const subjectAverage = subjectAverageInput
    ? Number(subjectAverageInput)
    : null;
  const standardDeviation = standardDeviationInput
    ? Number(standardDeviationInput)
    : null;
  const totalStudents = totalStudentsInput ? Number(totalStudentsInput) : null;
  const rankGrade = rankGradeInput ? Number(rankGradeInput) : null;

  const result = await updateSchoolScore(id, user.userId, {
    grade,
    semester,
    // FK 필드 (우선 사용)
    subject_group_id: subjectGroupId || undefined,
    subject_id: subjectId || undefined,
    subject_type_id: subjectTypeId || undefined,
    // 하위 호환성을 위한 텍스트 필드 (deprecated)
    subject_group: subjectGroup || undefined,
    subject_type: subjectType || undefined,
    subject_name: subjectName || undefined,
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

  // skipRedirect 옵션이 있으면 redirect하지 않음 (모달 사용 시)
  const skipRedirect = formData.get("skipRedirect") === "true";
  if (!skipRedirect) {
    redirect(`/scores/school/${grade}/${semester}?success=updated`);
  }
}

/**
 * 내신 성적 삭제 (레거시)
 * 
 * @deprecated Phase 4 이후 삭제 예정. deleteInternalScore를 사용하세요
 */
export async function deleteSchoolScoreAction(
  id: string,
  options?: { skipRedirect?: boolean; grade?: number; semester?: number }
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new Error("로그인이 필요합니다.");
  }

  const result = await deleteSchoolScore(id, user.userId);

  if (!result.success) {
    throw new Error(result.error || "내신 성적 삭제에 실패했습니다.");
  }

  // 모달에서 사용할 때는 특정 경로만 revalidate
  if (options?.skipRedirect && options.grade && options.semester) {
    revalidatePath(`/scores/school/${options.grade}/${options.semester}`);
    return;
  }

  // 기본 동작: 전체 경로 revalidate 및 redirect
  revalidatePath("/scores");
  if (!options?.skipRedirect) {
    redirect("/scores");
  }
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
  // FK 필드 (우선 사용)
  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim();
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const standardScoreInput = String(
    formData.get("standard_score") ?? ""
  ).trim();
  const percentileInput = String(formData.get("percentile") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const examRound = String(formData.get("exam_round") ?? "").trim(); // month

  // 영어/한국사 여부 확인 (FK 우선, 없으면 텍스트 필드 사용)
  let actualSubjectGroup = subjectGroup;
  if (subjectGroupId) {
    // subjectGroupId로 직접 교과 그룹 조회
    const group = await getSubjectGroupById(subjectGroupId);
    if (group) {
      actualSubjectGroup = group.name;
    }
  }
  const isEnglishOrKoreanHistory =
    actualSubjectGroup === "영어" || actualSubjectGroup === "한국사";

  // 과목 선택이 필요한 교과인지 확인 (사회, 과학만 과목 필수)
  const needsSubject =
    actualSubjectGroup === "사회" || actualSubjectGroup === "과학";

  // 유효성 검증
  if (!grade || !examType || !gradeScoreInput) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }
  if (!subjectGroupId && !subjectGroup) {
    throw new Error("교과를 선택해주세요.");
  }
  // 과목 필수 검증: 사회, 과학만 과목이 필수
  if (needsSubject && !subjectId && !subjectName) {
    throw new Error("과목을 선택해주세요.");
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
  if (
    percentile !== null &&
    (!Number.isFinite(percentile) || percentile < 0 || percentile > 100)
  ) {
    throw new Error("백분위는 0~100 사이의 숫자여야 합니다.");
  }

  // subjectGroupId와 subjectId가 빈 문자열이 아닐 때만 전달
  if (!subjectGroupId || !subjectId) {
    throw new Error("교과와 과목을 모두 선택해주세요.");
  }

  // exam_date와 exam_title 가져오기
  const examDate = String(formData.get("exam_date") ?? "").trim() || new Date().toISOString().split("T")[0];
  const examTitle = String(formData.get("exam_title") ?? "").trim() || examType;

  // curriculum_revision_id 가져오기
  const curriculumRevision = await getActiveCurriculumRevision();
  if (!curriculumRevision) {
    throw new Error("개정교육과정을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const result = await createMockScore({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    exam_date: examDate,
    exam_title: examTitle,
    grade,
    subject_group_id: subjectGroupId,
    subject_id: subjectId,
    curriculum_revision_id: curriculumRevision.id,
    raw_score: null, // 원점수 제거
    standard_score: standardScore,
    percentile: percentile,
    grade_score: gradeScore,
  });

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 등록에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(
    supabase,
    user.userId,
    "score_added",
    {
      score_type: "mock",
      grade,
      exam_type: examType,
      subject_group: subjectGroup,
      subject_name: subjectName,
      grade_score: gradeScore,
    },
    tenantContext.tenantId
  );

  // skipRedirect가 true이면 redirect하지 않음 (모달에서 사용할 때)
  const skipRedirect = formData.get("skipRedirect") === "true";
  if (skipRedirect) {
    const month = examRound || "3"; // 기본값 3월
    revalidatePath(
      `/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`
    );
    return;
  }

  // exam_round를 month로 사용하여 새로운 경로 구조로 redirect (학년-월-시험유형)
  const month = examRound || "3"; // 기본값 3월
  revalidatePath(
    `/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`
  );
  redirect(
    `/scores/mock/${grade}/${month}/${encodeURIComponent(
      examType
    )}?success=created`
  );
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
  // FK 필드 (우선 사용)
  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim();
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
  const subjectGroup = String(formData.get("subject_group") ?? "").trim();
  const subjectName = String(formData.get("subject_name") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const standardScoreInput = String(
    formData.get("standard_score") ?? ""
  ).trim();
  const percentileInput = String(formData.get("percentile") ?? "").trim();
  const gradeScoreInput = String(formData.get("grade_score") ?? "").trim();
  const examRound = String(formData.get("exam_round") ?? "").trim();

  // 영어/한국사 여부 확인 (FK 우선, 없으면 텍스트 필드 사용)
  let actualSubjectGroup = subjectGroup;
  if (subjectGroupId) {
    // subjectGroupId로 직접 교과 그룹 조회
    const group = await getSubjectGroupById(subjectGroupId);
    if (group) {
      actualSubjectGroup = group.name;
    }
  }
  const isEnglishOrKoreanHistory =
    actualSubjectGroup === "영어" || actualSubjectGroup === "한국사";

  // 과목 선택이 필요한 교과인지 확인 (사회, 과학만 과목 필수)
  const needsSubject =
    actualSubjectGroup === "사회" || actualSubjectGroup === "과학";

  // 유효성 검증
  if (!grade || !examType || !gradeScoreInput) {
    throw new Error("필수 필드를 모두 입력해주세요.");
  }
  if (!subjectGroupId && !subjectGroup) {
    throw new Error("교과를 선택해주세요.");
  }
  // 과목 필수 검증: 사회, 과학만 과목이 필수
  if (needsSubject && !subjectId && !subjectName) {
    throw new Error("과목을 선택해주세요.");
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

  // exam_date와 exam_title 가져오기
  const examDate = String(formData.get("exam_date") ?? "").trim();
  const examTitle = String(formData.get("exam_title") ?? "").trim() || examType;

  const updates: Partial<Omit<MockScore, "id" | "student_id" | "created_at">> = {
    grade,
  };

  if (examDate) {
    updates.exam_date = examDate;
  }
  if (examTitle) {
    updates.exam_title = examTitle;
  }

  // FK 필드 (우선 사용)
  if (subjectGroupId) {
    updates.subject_group_id = subjectGroupId;
  }
  if (subjectId) {
    updates.subject_id = subjectId;
  }

  updates.raw_score = null; // 원점수 제거
  if (standardScore !== null) {
    updates.standard_score = standardScore;
  }
  if (percentile !== null) {
    updates.percentile = percentile;
  }
  if (gradeScore !== null) {
    updates.grade_score = gradeScore;
  }

  const result = await updateMockScore(id, user.userId, updates);

  if (!result.success) {
    throw new Error(result.error || "모의고사 성적 수정에 실패했습니다.");
  }

  // skipRedirect가 true이면 redirect하지 않음 (모달에서 사용할 때)
  const skipRedirect = formData.get("skipRedirect") === "true";
  if (skipRedirect) {
    const month = examRound || "3"; // 기본값 3월
    revalidatePath(
      `/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`
    );
    return;
  }

  // exam_round를 month로 사용하여 새로운 경로 구조로 redirect (학년-월-시험유형)
  const month = examRound || "3"; // 기본값 3월
  revalidatePath(
    `/scores/mock/${grade}/${month}/${encodeURIComponent(examType)}`
  );
  redirect(
    `/scores/mock/${grade}/${month}/${encodeURIComponent(
      examType
    )}?success=updated`
  );
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
