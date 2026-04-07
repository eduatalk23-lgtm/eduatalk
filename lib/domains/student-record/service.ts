// ============================================
// 생기부 도메인 Service
// 비즈니스 로직을 담당
// - 데이터 변환 및 가공
// - 비즈니스 규칙 적용 (글자수 검증, 공통과목 쌍 등)
// - Repository 호출 및 에러 처리
//
// 분리된 모듈:
//   service-supplementary.ts — 지원현황/수상/봉사/징계
//   service-strategy.ts     — 전략탭/수능최저 목표+시뮬레이션
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
  RecordTabData,
  StorylineTabData,
  StudentRecordActionResult,
} from "./types";
// Note: RecordApplication*, RecordAward*, RecordVolunteer*, RecordDisciplinary*, MinScore*, StrategyTabData
// are used in service-supplementary.ts and service-strategy.ts respectively.

// ============================================
// 분리된 모듈 re-export (외부 호환 유지)
// ============================================

export type { SupplementaryTabData } from "./service-supplementary";
export {
  getSupplementaryTabData,
  addApplication,
  updateApplication,
  removeApplication,
  addAward,
  removeAward,
  addVolunteer,
  removeVolunteer,
  addDisciplinary,
  removeDisciplinary,
} from "./service-supplementary";

export {
  getStrategyTabData,
  addMinScoreTarget,
  updateMinScoreTarget,
  removeMinScoreTarget,
  runMinScoreSimulation,
  removeMinScoreSimulation,
} from "./service-strategy";

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
// NEIS 공통 검증 헬퍼
// ============================================

function validateAndNormalize(
  rawContent: string | undefined | null,
  charLimit: number,
): { ok: true; content: string } | { ok: false; error: string } {
  const content = normalizeLineBreaks(rawContent ?? "");
  const v = validateNeisContent(content, charLimit);
  if (v.isOver) {
    return { ok: false, error: `NEIS 바이트 초과: ${v.bytes.toLocaleString()}/${v.byteLimit.toLocaleString()}B (${v.chars}자 입력)` };
  }
  if (v.invalidChars.length > 0) {
    return { ok: false, error: `NEIS 입력 불가 문자 포함 (위치: ${v.invalidChars.map(c => c.position).join(", ")})` };
  }
  return { ok: true, content };
}

// ============================================
// 세특 저장 (글자수 검증 + 줄바꿈 정규화 + 공통과목 쌍 체크)
// ============================================

export async function saveSetek(
  input: RecordSetekInsert,
  options?: { expectedUpdatedAt?: string; curriculumRevisionId?: string },
): Promise<StudentRecordActionResult> {
  try {
    const validated = validateAndNormalize(input.content, input.char_limit ?? 500);
    if (!validated.ok) return { success: false, error: validated.error };
    const content = validated.content;

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
    return { success: true, data: { id } };
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
    const validated = validateAndNormalize(input.content, input.char_limit ?? 500);
    if (!validated.ok) return { success: false, error: validated.error };
    const content = validated.content;

    const id = await repository.insertPersonalSetek({ ...input, content });
    return { success: true, data: { id } };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "savePersonalSetek" }, error);
    return { success: false, error: "개인 세특 저장 중 오류가 발생했습니다." };
  }
}

export async function removeSetek(id: string): Promise<StudentRecordActionResult> {
  try {
    await repository.deleteSetekById(id);
    return { success: true };
  } catch (error) {
    logActionError({ domain: DOMAIN, action: "removeSetek" }, error);
    return { success: false, error: "세특 삭제 중 오류가 발생했습니다." };
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
  options?: { expectedUpdatedAt?: string },
): Promise<StudentRecordActionResult> {
  try {
    const charLimit = getCharLimit(
      input.activity_type === "career" ? "career" : input.activity_type as "autonomy" | "club",
      schoolYear,
    );
    const validated = validateAndNormalize(input.content, charLimit);
    if (!validated.ok) return { success: false, error: validated.error };
    const content = validated.content;

    if (options?.expectedUpdatedAt && input.id) {
      await repository.updateChangcheById(
        input.id,
        { ...input, content, char_limit: charLimit },
        options.expectedUpdatedAt,
      );
      return { success: true, data: { id: input.id } };
    }

    const id = await repository.upsertChangche({ ...input, content, char_limit: charLimit });
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CONFLICT")) {
      return { success: false, error: error.message };
    }
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
  options?: { expectedUpdatedAt?: string },
): Promise<StudentRecordActionResult> {
  try {
    const charLimit = getCharLimit("haengteuk", schoolYear);
    const validated = validateAndNormalize(input.content, charLimit);
    if (!validated.ok) return { success: false, error: validated.error };
    const content = validated.content;

    if (options?.expectedUpdatedAt && input.id) {
      await repository.updateHaengteukById(
        input.id,
        { ...input, content, char_limit: charLimit },
        options.expectedUpdatedAt,
      );
      return { success: true, data: { id: input.id } };
    }

    const id = await repository.upsertHaengteuk({ ...input, content, char_limit: charLimit });
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CONFLICT")) {
      return { success: false, error: error.message };
    }
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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

