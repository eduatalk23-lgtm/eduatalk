"use server";

// ============================================
// 컨설턴트 가이드 CRUD Server Actions
// setek/changche/haengteuk 3개 가이드 테이블에 대한
// source='manual' 수동 작성/수정/삭제.
//
// AI 파이프라인이 source='ai'로 자동 생성하는 것과 별개로
// 컨설턴트가 직접 작성한 보완방향(retrospective)/설계방향(prospective)을
// 같은 테이블의 source='manual' 행으로 저장한다.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import * as guideRepo from "../repository/guide-repository";

const LOG_CTX = { domain: "student-record", action: "guide-consultant" };

// ============================================
// 공통 입력 타입
// ============================================

type GuideMode = "retrospective" | "prospective";

interface SetekConsultantGuideInput {
  id?: string | null;
  tenantId: string;
  studentId: string;
  schoolYear: number;
  subjectId: string;
  guideMode: GuideMode;
  direction: string;
  keywords?: string[];
  competencyFocus?: string[];
  cautions?: string | null;
  teacherPoints?: string[];
}

interface ChangcheConsultantGuideInput {
  id?: string | null;
  tenantId: string;
  studentId: string;
  schoolYear: number;
  activityType: "autonomy" | "club" | "career";
  guideMode: GuideMode;
  direction: string;
  keywords?: string[];
  competencyFocus?: string[];
  cautions?: string | null;
  teacherPoints?: string[];
}

interface HaengteukConsultantGuideInput {
  id?: string | null;
  tenantId: string;
  studentId: string;
  schoolYear: number;
  guideMode: GuideMode;
  direction: string;
  keywords?: string[];
  competencyFocus?: string[];
  cautions?: string | null;
  teacherPoints?: string[];
}

// ============================================
// 세특 (setek)
// ============================================

export async function saveConsultantSetekGuideAction(
  input: SetekConsultantGuideInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();

    const updates = {
      direction: input.direction,
      keywords: input.keywords ?? [],
      competency_focus: input.competencyFocus ?? [],
      cautions: input.cautions ?? null,
      teacher_points: input.teacherPoints ?? [],
    };

    if (input.id) {
      await guideRepo.updateSetekGuide(input.id, updates);
      return { success: true, data: { id: input.id } };
    }

    const rows = await guideRepo.insertSetekGuides([
      {
        tenant_id: input.tenantId,
        student_id: input.studentId,
        school_year: input.schoolYear,
        subject_id: input.subjectId,
        source: "manual",
        status: "draft",
        guide_mode: input.guideMode,
        prompt_version: "manual",
        ...updates,
      },
    ]);
    const id = rows[0]?.id;
    if (!id) {
      return { success: false, error: "가이드 저장 결과가 비어있습니다." };
    }
    return { success: true, data: { id } };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveConsultantSetekGuide" }, error);
    return { success: false, error: "세특 보완방향 저장 실패" };
  }
}

export async function deleteConsultantSetekGuideAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await guideRepo.deleteSetekGuide(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteConsultantSetekGuide" }, error);
    return { success: false, error: "세특 보완방향 삭제 실패" };
  }
}

// ============================================
// 창체 (changche)
// ============================================

export async function saveConsultantChangcheGuideAction(
  input: ChangcheConsultantGuideInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();

    const updates = {
      direction: input.direction,
      keywords: input.keywords ?? [],
      competency_focus: input.competencyFocus ?? [],
      cautions: input.cautions ?? null,
      teacher_points: input.teacherPoints ?? [],
    };

    if (input.id) {
      await guideRepo.updateChangcheGuide(input.id, updates);
      return { success: true, data: { id: input.id } };
    }

    const rows = await guideRepo.insertChangcheGuides([
      {
        tenant_id: input.tenantId,
        student_id: input.studentId,
        school_year: input.schoolYear,
        activity_type: input.activityType,
        source: "manual",
        status: "draft",
        guide_mode: input.guideMode,
        prompt_version: "manual",
        ...updates,
      },
    ]);
    const id = rows[0]?.id;
    if (!id) {
      return { success: false, error: "가이드 저장 결과가 비어있습니다." };
    }
    return { success: true, data: { id } };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveConsultantChangcheGuide" }, error);
    return { success: false, error: "창체 보완방향 저장 실패" };
  }
}

export async function deleteConsultantChangcheGuideAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await guideRepo.deleteChangcheGuide(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteConsultantChangcheGuide" }, error);
    return { success: false, error: "창체 보완방향 삭제 실패" };
  }
}

// ============================================
// 행특 (haengteuk)
// ============================================

export async function saveConsultantHaengteukGuideAction(
  input: HaengteukConsultantGuideInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();

    const updates = {
      direction: input.direction,
      keywords: input.keywords ?? [],
      competency_focus: input.competencyFocus ?? [],
      cautions: input.cautions ?? null,
      teacher_points: input.teacherPoints ?? [],
    };

    if (input.id) {
      await guideRepo.updateHaengteukGuide(input.id, updates);
      return { success: true, data: { id: input.id } };
    }

    const row = await guideRepo.insertHaengteukGuide({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      school_year: input.schoolYear,
      source: "manual",
      status: "draft",
      guide_mode: input.guideMode,
      prompt_version: "manual",
      ...updates,
    });
    if (!row?.id) {
      return { success: false, error: "가이드 저장 결과가 비어있습니다." };
    }
    return { success: true, data: { id: row.id } };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveConsultantHaengteukGuide" }, error);
    return { success: false, error: "행특 보완방향 저장 실패" };
  }
}

export async function deleteConsultantHaengteukGuideAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await guideRepo.deleteHaengteukGuide(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteConsultantHaengteukGuide" }, error);
    return { success: false, error: "행특 보완방향 삭제 실패" };
  }
}
