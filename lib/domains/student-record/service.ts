// ============================================
// 생기부 도메인 Service
// 비즈니스 로직을 담당
// - 데이터 변환 및 가공
// - 비즈니스 규칙 적용 (글자수 검증, 공통과목 쌍 등)
// - Repository 호출 및 에러 처리
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import * as repository from "./repository";
import { validateNeisContent, normalizeLineBreaks, countNeisBytes } from "./validation";
import { getCharLimit } from "./constants";
import type {
  RecordSetekInsert,
  RecordPersonalSetekInsert,
  RecordChangcheInsert,
  RecordHaengteukInsert,
  RecordReadingInsert,
  RecordAttendanceInsert,
  StorylineInsert,
  StorylineUpdate,
  StorylineLinkInsert,
  RoadmapItemInsert,
  RoadmapItemUpdate,
  RecordApplicationInsert,
  RecordApplicationUpdate,
  RecordAwardInsert,
  RecordVolunteerInsert,
  RecordDisciplinaryInsert,
  MinScoreTargetInsert,
  MinScoreTargetUpdate,
  MinScoreSimulationInsert,
  MinScoreCriteria,
  RecordTabData,
  StorylineTabData,
  StrategyTabData,
  StudentRecordActionResult,
} from "./types";
import { checkInterviewConflicts } from "./interview-conflict-checker";
import { simulateMinScore } from "./min-score-simulator";

const DOMAIN = "student-record";

// ============================================
// 기록 탭 데이터 조회 (탭별 lazy loading)
// ============================================

export async function getRecordTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordTabData> {
  try {
    const [seteks, personalSeteks, changche, haengteuk, readings, attendance] =
      await Promise.all([
        repository.findSeteksByStudentYear(studentId, schoolYear, tenantId),
        repository.findPersonalSeteksByStudentYear(studentId, schoolYear, tenantId),
        repository.findChangcheByStudentYear(studentId, schoolYear, tenantId),
        repository.findHaengteukByStudentYear(studentId, schoolYear, tenantId),
        repository.findReadingsByStudentYear(studentId, schoolYear, tenantId),
        repository.findAttendanceByStudentYear(studentId, schoolYear, tenantId),
      ]);

    return {
      seteks,
      personalSeteks,
      changche,
      haengteuk,
      readings,
      schoolAttendance: attendance,
    };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "getRecordTabData" }, error, { studentId, schoolYear });
    return {
      seteks: [],
      personalSeteks: [],
      changche: [],
      haengteuk: null,
      readings: [],
      schoolAttendance: null,
    };
  }
}

// ============================================
// 세특 저장 (글자수 검증 + 줄바꿈 정규화 + 공통과목 쌍 체크)
// ============================================

export async function saveSetek(
  input: RecordSetekInsert,
  options?: { expectedUpdatedAt?: string; curriculumRevisionId?: string },
): Promise<StudentRecordActionResult> {
  try {
    // 줄바꿈 정규화
    const content = normalizeLineBreaks(input.content ?? "");

    // NEIS 바이트 검증 (NEIS "500자" = 1,500B 기준)
    const validation = validateNeisContent(content, input.char_limit ?? 500);
    if (validation.isOver) {
      return {
        success: false,
        error: `NEIS 바이트 초과: ${validation.bytes.toLocaleString()}/${validation.byteLimit.toLocaleString()}B (${validation.chars}자 입력)`,
      };
    }
    if (validation.invalidChars.length > 0) {
      return {
        success: false,
        error: `NEIS 입력 불가 문자 포함 (위치: ${validation.invalidChars.map(c => c.position).join(", ")})`,
      };
    }

    // 공통과목 쌍 합산 검증 (2022 개정) — 바이트 기준
    if (options?.curriculumRevisionId && input.subject_id) {
      const pair = await repository.findSubjectPair(
        input.subject_id,
        options.curriculumRevisionId,
      );
      if (pair) {
        const pairedSubjectId =
          pair.subject_id_1 === input.subject_id ? pair.subject_id_2 : pair.subject_id_1;
        const pairedSeteks = await repository.findSeteksByStudentYear(
          input.student_id,
          input.school_year,
          input.tenant_id,
        );
        const pairedSetek = pairedSeteks.find(s => s.subject_id === pairedSubjectId);
        const totalBytes = countNeisBytes(content) + countNeisBytes(pairedSetek?.content ?? "");
        const sharedByteLimit = pair.shared_char_limit * 3;
        if (totalBytes > sharedByteLimit) {
          return {
            success: false,
            error: `공통과목 쌍 합산 바이트 초과: ${totalBytes.toLocaleString()}/${sharedByteLimit.toLocaleString()}B`,
          };
        }
      }
    }

    const id = await repository.upsertSetek({ ...input, content });
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveSetek" }, error, { studentId: input.student_id });
    return { success: false, error: "세특 저장 중 오류가 발생했습니다." };
  }
}

// ============================================
// 개인 세특 저장/삭제
// ============================================

export async function savePersonalSetek(
  input: RecordPersonalSetekInsert,
): Promise<StudentRecordActionResult> {
  try {
    const content = normalizeLineBreaks(input.content ?? "");
    const validation = validateNeisContent(content, input.char_limit ?? 500);
    if (validation.isOver) {
      return {
        success: false,
        error: `NEIS 바이트 초과: ${validation.bytes.toLocaleString()}/${validation.byteLimit.toLocaleString()}B (${validation.chars}자 입력)`,
      };
    }
    if (validation.invalidChars.length > 0) {
      return {
        success: false,
        error: `NEIS 입력 불가 문자 포함 (위치: ${validation.invalidChars.map(c => c.position).join(", ")})`,
      };
    }

    const id = await repository.insertPersonalSetek({ ...input, content });
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "savePersonalSetek" }, error);
    return { success: false, error: "개인 세특 저장 중 오류가 발생했습니다." };
  }
}

export async function removePersonalSetek(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deletePersonalSetekById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removePersonalSetek" }, error);
    return { success: false, error: "개인 세특 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 창체 저장
// ============================================

export async function saveChangche(
  input: RecordChangcheInsert,
  schoolYear: number,
): Promise<StudentRecordActionResult> {
  try {
    const content = normalizeLineBreaks(input.content ?? "");
    const charLimit = getCharLimit(
      input.activity_type === "career" ? "career" : input.activity_type as "autonomy" | "club",
      schoolYear,
    );
    const validation = validateNeisContent(content, charLimit);
    if (validation.isOver) {
      return {
        success: false,
        error: `NEIS 바이트 초과: ${validation.bytes.toLocaleString()}/${validation.byteLimit.toLocaleString()}B (${validation.chars}자 입력)`,
      };
    }

    const id = await repository.upsertChangche({ ...input, content, char_limit: charLimit });
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveChangche" }, error);
    return { success: false, error: "창체 저장 중 오류가 발생했습니다." };
  }
}

// ============================================
// 행특 저장
// ============================================

export async function saveHaengteuk(
  input: RecordHaengteukInsert,
  schoolYear: number,
): Promise<StudentRecordActionResult> {
  try {
    const content = normalizeLineBreaks(input.content ?? "");
    const charLimit = getCharLimit("haengteuk", schoolYear);
    const validation = validateNeisContent(content, charLimit);
    if (validation.isOver) {
      return {
        success: false,
        error: `NEIS 바이트 초과: ${validation.bytes.toLocaleString()}/${validation.byteLimit.toLocaleString()}B (${validation.chars}자 입력)`,
      };
    }

    const id = await repository.upsertHaengteuk({ ...input, content, char_limit: charLimit });
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveHaengteuk" }, error);
    return { success: false, error: "행특 저장 중 오류가 발생했습니다." };
  }
}

// ============================================
// 독서 추가/삭제
// ============================================

export async function addReading(
  input: RecordReadingInsert,
): Promise<StudentRecordActionResult> {
  try {
    const id = await repository.insertReading(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addReading" }, error);
    return { success: false, error: "독서 추가 중 오류가 발생했습니다." };
  }
}

export async function removeReading(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteReadingById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeReading" }, error);
    return { success: false, error: "독서 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 출결 저장
// ============================================

export async function saveAttendance(
  input: RecordAttendanceInsert,
): Promise<StudentRecordActionResult> {
  try {
    const id = await repository.upsertAttendance(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveAttendance" }, error);
    return { success: false, error: "출결 저장 중 오류가 발생했습니다." };
  }
}

// ============================================
// 스토리라인 탭 데이터 조회
// ============================================

export async function getStorylineTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<StorylineTabData> {
  try {
    const [storylines, roadmapItems] = await Promise.all([
      repository.findStorylinesByStudent(studentId, tenantId),
      repository.findAllRoadmapItemsByStudent(studentId, tenantId),
    ]);

    return { storylines, roadmapItems };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "getStorylineTabData" }, error, { studentId, schoolYear });
    return { storylines: [], roadmapItems: [] };
  }
}

// ============================================
// 스토리라인 CRUD
// ============================================

export async function saveStoryline(
  input: StorylineInsert,
): Promise<StudentRecordActionResult> {
  try {
    if (!input.title?.trim()) {
      return { success: false, error: "스토리라인 제목을 입력해주세요." };
    }
    const id = await repository.insertStoryline(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveStoryline" }, error);
    return { success: false, error: "스토리라인 저장 중 오류가 발생했습니다." };
  }
}

export async function updateStoryline(
  id: string,
  updates: StorylineUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await repository.updateStorylineById(id, updates);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "updateStoryline" }, error);
    return { success: false, error: "스토리라인 수정 중 오류가 발생했습니다." };
  }
}

export async function removeStoryline(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteStorylineById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeStoryline" }, error);
    return { success: false, error: "스토리라인 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 스토리라인 링크 CRUD
// ============================================

export async function addStorylineLink(
  input: StorylineLinkInsert,
): Promise<StudentRecordActionResult> {
  try {
    const id = await repository.insertStorylineLink(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addStorylineLink" }, error);
    return { success: false, error: "활동 연결 중 오류가 발생했습니다." };
  }
}

export async function removeStorylineLink(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteStorylineLinkById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeStorylineLink" }, error);
    return { success: false, error: "활동 연결 해제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 로드맵 CRUD
// ============================================

export async function saveRoadmapItem(
  input: RoadmapItemInsert,
): Promise<StudentRecordActionResult> {
  try {
    if (!input.plan_content?.trim()) {
      return { success: false, error: "계획 내용을 입력해주세요." };
    }
    const id = await repository.insertRoadmapItem(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "saveRoadmapItem" }, error);
    return { success: false, error: "로드맵 항목 저장 중 오류가 발생했습니다." };
  }
}

export async function updateRoadmapItem(
  id: string,
  updates: RoadmapItemUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await repository.updateRoadmapItemById(id, updates);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "updateRoadmapItem" }, error);
    return { success: false, error: "로드맵 항목 수정 중 오류가 발생했습니다." };
  }
}

export async function removeRoadmapItem(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteRoadmapItemById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeRoadmapItem" }, error);
    return { success: false, error: "로드맵 항목 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 지원현황 + 보조 기록 탭 데이터 조회
// ============================================

export interface SupplementaryTabData {
  applications: import("./types").RecordApplication[];
  interviewConflicts: import("./types").InterviewConflict[];
  awards: import("./types").RecordAward[];
  volunteer: import("./types").RecordVolunteer[];
  disciplinary: import("./types").RecordDisciplinary[];
}

export async function getSupplementaryTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<SupplementaryTabData> {
  try {
    const [applications, awards, volunteer, disciplinary] = await Promise.all([
      repository.findApplicationsByStudentYear(studentId, schoolYear, tenantId),
      repository.findAwardsByStudentYear(studentId, schoolYear, tenantId),
      repository.findVolunteerByStudentYear(studentId, schoolYear, tenantId),
      repository.findDisciplinaryByStudentYear(studentId, schoolYear, tenantId),
    ]);

    const interviewConflicts = checkInterviewConflicts(applications);

    return { applications, interviewConflicts, awards, volunteer, disciplinary };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "getSupplementaryTabData" }, error, { studentId, schoolYear });
    return { applications: [], interviewConflicts: [], awards: [], volunteer: [], disciplinary: [] };
  }
}

// ============================================
// 지원현황 CRUD (수시 6장 제한 포함)
// ============================================

const MAX_EARLY_APPLICATIONS = 6;

export async function addApplication(
  input: RecordApplicationInsert,
): Promise<StudentRecordActionResult> {
  try {
    // 수시 6장 제한 체크
    if (input.round?.startsWith("early_")) {
      const existing = await repository.findApplicationsByStudentYear(
        input.student_id,
        input.school_year,
        input.tenant_id,
      );
      const earlyCount = existing.filter((a) => a.round.startsWith("early_")).length;
      if (earlyCount >= MAX_EARLY_APPLICATIONS) {
        return { success: false, error: `수시 지원은 최대 ${MAX_EARLY_APPLICATIONS}장까지 가능합니다.` };
      }
    }

    const id = await repository.insertApplication(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addApplication" }, error);
    return { success: false, error: "지원 추가 중 오류가 발생했습니다." };
  }
}

export async function updateApplication(
  id: string,
  updates: RecordApplicationUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await repository.updateApplicationById(id, updates);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "updateApplication" }, error);
    return { success: false, error: "지원 수정 중 오류가 발생했습니다." };
  }
}

export async function removeApplication(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteApplicationById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeApplication" }, error);
    return { success: false, error: "지원 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 수상/봉사/징계 CRUD
// ============================================

export async function addAward(input: RecordAwardInsert): Promise<StudentRecordActionResult> {
  try {
    if (!input.award_name?.trim()) {
      return { success: false, error: "수상명을 입력해주세요." };
    }
    const id = await repository.insertAward(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addAward" }, error);
    return { success: false, error: "수상 추가 중 오류가 발생했습니다." };
  }
}

export async function removeAward(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteAwardById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeAward" }, error);
    return { success: false, error: "수상 삭제 중 오류가 발생했습니다." };
  }
}

export async function addVolunteer(input: RecordVolunteerInsert): Promise<StudentRecordActionResult> {
  try {
    if (!input.hours || input.hours <= 0) {
      return { success: false, error: "봉사 시간을 입력해주세요." };
    }
    const id = await repository.insertVolunteer(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addVolunteer" }, error);
    return { success: false, error: "봉사 추가 중 오류가 발생했습니다." };
  }
}

export async function removeVolunteer(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteVolunteerById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeVolunteer" }, error);
    return { success: false, error: "봉사 삭제 중 오류가 발생했습니다." };
  }
}

export async function addDisciplinary(input: RecordDisciplinaryInsert): Promise<StudentRecordActionResult> {
  try {
    if (!input.action_type?.trim()) {
      return { success: false, error: "조치 유형을 입력해주세요." };
    }
    const id = await repository.insertDisciplinary(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addDisciplinary" }, error);
    return { success: false, error: "징계 추가 중 오류가 발생했습니다." };
  }
}

export async function removeDisciplinary(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteDisciplinaryById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeDisciplinary" }, error);
    return { success: false, error: "징계 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 전략 탭 데이터 조회 (지원현황 + 최저 시뮬)
// ============================================

export async function getStrategyTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<StrategyTabData> {
  try {
    const [applications, minScoreTargets, minScoreSimulations] = await Promise.all([
      repository.findApplicationsByStudentYear(studentId, schoolYear, tenantId),
      repository.findMinScoreTargetsByStudent(studentId, tenantId),
      repository.findMinScoreSimulationsByStudent(studentId, tenantId),
    ]);

    const interviewConflicts = checkInterviewConflicts(applications);

    return { applications, minScoreTargets, minScoreSimulations, interviewConflicts };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "getStrategyTabData" }, error, { studentId, schoolYear });
    return { applications: [], minScoreTargets: [], minScoreSimulations: [], interviewConflicts: [] };
  }
}

// ============================================
// 수능최저 목표 CRUD
// ============================================

export async function addMinScoreTarget(
  input: MinScoreTargetInsert,
): Promise<StudentRecordActionResult> {
  try {
    if (!input.university_name?.trim()) {
      return { success: false, error: "대학명을 입력해주세요." };
    }
    if (!input.department?.trim()) {
      return { success: false, error: "학과를 입력해주세요." };
    }
    const id = await repository.insertMinScoreTarget(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "addMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 추가 중 오류가 발생했습니다." };
  }
}

export async function updateMinScoreTarget(
  id: string,
  updates: MinScoreTargetUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await repository.updateMinScoreTargetById(id, updates);
    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "updateMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 수정 중 오류가 발생했습니다." };
  }
}

export async function removeMinScoreTarget(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteMinScoreTargetById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeMinScoreTarget" }, error);
    return { success: false, error: "최저 목표 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 수능최저 시뮬레이션 실행
// ============================================

export async function runMinScoreSimulation(
  input: Omit<MinScoreSimulationInsert, "is_met" | "grade_sum" | "gap" | "bottleneck_subjects" | "what_if">,
  criteria: MinScoreCriteria,
): Promise<StudentRecordActionResult> {
  try {
    const grades = (input.actual_grades ?? {}) as Record<string, number>;
    const result = simulateMinScore(criteria, grades);

    const id = await repository.insertMinScoreSimulation({
      ...input,
      is_met: result.isMet,
      grade_sum: result.gradeSum,
      gap: result.gap,
      bottleneck_subjects: result.bottleneckSubjects,
      what_if: result.whatIf as unknown as import("@/lib/supabase/database.types").Json,
    });

    return { success: true, id };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "runMinScoreSimulation" }, error);
    return { success: false, error: "시뮬레이션 실행 중 오류가 발생했습니다." };
  }
}

export async function removeMinScoreSimulation(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteMinScoreSimulationById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeMinScoreSimulation" }, error);
    return { success: false, error: "시뮬레이션 삭제 중 오류가 발생했습니다." };
  }
}
