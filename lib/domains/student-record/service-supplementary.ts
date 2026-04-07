// ============================================
// 생기부 도메인 Service — 보조 기록 (지원현황 / 수상 / 봉사 / 징계)
// service.ts에서 분리. 외부 참조는 service.ts re-export를 통해 접근.
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import * as repository from "./repository";
import type {
  RecordApplicationInsert,
  RecordApplicationUpdate,
  RecordAwardInsert,
  RecordVolunteerInsert,
  RecordDisciplinaryInsert,
  StudentRecordActionResult,
} from "./types";
import { checkInterviewConflicts } from "./interview-conflict-checker";

const DOMAIN = "student-record";

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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
    return { success: true, data: { id } };
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
