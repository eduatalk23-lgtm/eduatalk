"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportToExcel } from "@/lib/utils/excel";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import {
  getSubjectGroups,
  getSubjectsByGroup,
  getSubjectTypes,
  type Subject,
} from "@/lib/data/subjects";

/**
 * 교과/과목 관리 데이터를 Excel 파일로 다운로드
 * 4개 시트로 구성: curriculum_revisions, subject_groups, subjects, subject_types
 */
export async function exportSubjectsToExcel(): Promise<Buffer> {
  // 권한 확인 (admin만 허용)
  const { role } = await requireAdminOrConsultant();
  if (role !== "admin" && role !== "superadmin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // 1. 개정교육과정 조회
  const curriculumRevisions = await getCurriculumRevisions();

  // 2. 교과 그룹 조회 (모든 개정교육과정)
  const allSubjectGroups = await getSubjectGroups();

  // 3. 과목 조회 (모든 교과 그룹)
  const allSubjects: Subject[] = [];
  for (const group of allSubjectGroups) {
    const subjects = await getSubjectsByGroup(group.id);
    allSubjects.push(...subjects);
  }

  // 4. 과목구분 조회 (모든 개정교육과정)
  const allSubjectTypes = await getSubjectTypes();

  // Excel 시트 데이터 준비
  const sheets = {
    curriculum_revisions: curriculumRevisions.map((rev) => ({
      id: rev.id,
      name: rev.name,
      year: rev.year ?? "",
      is_active: rev.is_active ?? true,
      created_at: rev.created_at ?? "",
      updated_at: rev.updated_at ?? "",
    })),
    subject_groups: allSubjectGroups.map((group) => ({
      id: group.id,
      curriculum_revision_id: group.curriculum_revision_id,
      curriculum_revision_name: curriculumRevisions.find(
        (r) => r.id === group.curriculum_revision_id
      )?.name ?? "",
      name: group.name,
      created_at: group.created_at ?? "",
      updated_at: group.updated_at ?? "",
    })),
    subjects: allSubjects.map((subject) => ({
      id: subject.id,
      subject_group_id: subject.subject_group_id,
      subject_group_name: allSubjectGroups.find(
        (g) => g.id === subject.subject_group_id
      )?.name ?? "",
      name: subject.name,
      subject_type_id: subject.subject_type_id ?? "",
      subject_type_name: allSubjectTypes.find(
        (t) => t.id === subject.subject_type_id
      )?.name ?? "",
      is_active: subject.is_active ?? true,
      created_at: subject.created_at ?? "",
      updated_at: subject.updated_at ?? "",
    })),
    subject_types: allSubjectTypes.map((type) => ({
      id: type.id,
      curriculum_revision_id: type.curriculum_revision_id,
      curriculum_revision_name: curriculumRevisions.find(
        (r) => r.id === type.curriculum_revision_id
      )?.name ?? "",
      name: type.name,
      is_active: type.is_active ?? true,
      created_at: type.created_at ?? "",
      updated_at: type.updated_at ?? "",
    })),
  };

  return await exportToExcel(sheets);
}

/**
 * 교과/과목 관리 양식 파일 다운로드
 */
export async function downloadSubjectsTemplate(): Promise<Buffer> {
  // 권한 확인 (admin만 허용)
  const { role } = await requireAdminOrConsultant();
  if (role !== "admin" && role !== "superadmin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const sheets = {
    curriculum_revisions: [
      "id",
      "name",
      "year",
      "is_active",
      "created_at",
      "updated_at",
    ],
    subject_groups: [
      "id",
      "curriculum_revision_id",
      "curriculum_revision_name",
      "name",
      "created_at",
      "updated_at",
    ],
    subjects: [
      "id",
      "subject_group_id",
      "subject_group_name",
      "name",
      "subject_type_id",
      "subject_type_name",
      "is_active",
      "created_at",
      "updated_at",
    ],
    subject_types: [
      "id",
      "curriculum_revision_id",
      "curriculum_revision_name",
      "name",
      "is_active",
      "created_at",
      "updated_at",
    ],
  };

  const { generateTemplateExcel } = await import("@/lib/utils/excel");
  return await generateTemplateExcel(sheets);
}

