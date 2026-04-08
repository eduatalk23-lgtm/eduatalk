"use server";

// ============================================
// 학교 개설 과목 자동 수집 + 관리 Server Actions
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResponse } from "@/lib/types/actionResponse";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "schoolProfile" };

// ============================================
// 타입 정의
// ============================================

export interface SchoolProfileListItem {
  id: string;
  school_name: string;
  school_category: string | null;
  updated_at: string;
  subject_count: number;
  student_count: number;
}

export interface OfferedSubjectWithMeta {
  id: string;
  school_profile_id: string;
  subject_id: string;
  grades: number[];
  semesters: number[];
  is_elective: boolean | null;
  notes: string | null;
  subject_name: string | null;
  subject_group_name: string | null;
}

export interface SchoolProfileDetail {
  profile: {
    id: string;
    school_name: string;
    school_category: string | null;
    updated_at: string;
  };
  offeredSubjects: OfferedSubjectWithMeta[];
  studentCount: number;
}

export interface AutoCollectResult {
  schoolCount: number;
  subjectCount: number;
  newProfiles: string[];
  updatedProfiles: string[];
}

export interface UpsertOfferedSubjectInput {
  schoolProfileId: string;
  subjectId: string;
  grades: number[];
  semesters: number[];
  isElective: boolean;
  notes?: string;
}

// ============================================
// 내부 쿼리 결과 타입 (nested join용)
// ============================================

interface OfferedSubjectRow {
  id: string;
  school_profile_id: string;
  subject_id: string;
  grades: number[] | null;
  semesters: number[] | null;
  is_elective: boolean | null;
  notes: string | null;
  subject: { name: string; subject_group: { name: string } | null } | null;
}

interface SubjectWithGroupRow {
  id: string;
  name: string;
  subject_group: { name: string } | null;
}

// ============================================
// 전체 테넌트 학교별 자동 수집
// ============================================

export async function autoCollectSchoolSubjects(): Promise<ActionResponse<AutoCollectResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    if (!tenantId) return createErrorResponse("기관 정보를 찾을 수 없습니다.");
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");
    }

    // 1. 해당 테넌트의 학생 목록 (school_name IS NOT NULL)
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select("id, school_name")
      .eq("tenant_id", tenantId)
      .not("school_name", "is", null);

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return createSuccessResponse({ schoolCount: 0, subjectCount: 0, newProfiles: [], updatedProfiles: [] });
    }

    const studentIds = students.map((s) => s.id);
    const studentToSchool = new Map<string, string>(
      students.map((s) => [s.id, s.school_name as string]),
    );

    // 2. 성적 데이터에서 subject_id, grade, semester 수집
    const { data: scoreRows } = await supabaseAdmin
      .from("student_internal_scores")
      .select("student_id, subject_id, grade, semester")
      .in("student_id", studentIds);

    // 3. 세특 데이터에서 subject_id, grade, semester 수집
    const { data: setekRows } = await supabaseAdmin
      .from("student_record_seteks")
      .select("student_id, subject_id, grade, semester")
      .in("student_id", studentIds)
      .is("deleted_at", null);

    // 4. school별 subject_id 집계: Map<schoolName, Map<subjectId, {grades: Set, semesters: Set}>>
    const schoolMap = new Map<string, Map<string, { grades: Set<number>; semesters: Set<number> }>>();

    const processRow = (row: { student_id: string; subject_id: string; grade: number; semester: number }) => {
      const schoolName = studentToSchool.get(row.student_id);
      if (!schoolName || !row.subject_id) return;

      if (!schoolMap.has(schoolName)) {
        schoolMap.set(schoolName, new Map());
      }
      const subjectMap = schoolMap.get(schoolName)!;

      if (!subjectMap.has(row.subject_id)) {
        subjectMap.set(row.subject_id, { grades: new Set(), semesters: new Set() });
      }
      const entry = subjectMap.get(row.subject_id)!;
      if (row.grade) entry.grades.add(row.grade);
      if (row.semester) entry.semesters.add(row.semester);
    };

    for (const row of scoreRows ?? []) {
      processRow(row as { student_id: string; subject_id: string; grade: number; semester: number });
    }
    for (const row of setekRows ?? []) {
      processRow(row as { student_id: string; subject_id: string; grade: number; semester: number });
    }

    // 5. school_profiles upsert + school_offered_subjects upsert
    const newProfiles: string[] = [];
    const updatedProfiles: string[] = [];
    let totalSubjectCount = 0;

    for (const [schoolName, subjectMap] of schoolMap.entries()) {
      // school_profiles: school_name 기반 조회 (school_info_id 없는 자동 수집용)
      const { data: existing } = await supabaseAdmin
        .from("school_profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("school_name", schoolName)
        .maybeSingle();

      let profileId: string;
      if (existing) {
        profileId = existing.id;
        updatedProfiles.push(schoolName);
        // updated_at 갱신
        await supabaseAdmin
          .from("school_profiles")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", profileId);
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("school_profiles")
          .insert({ tenant_id: tenantId, school_name: schoolName })
          .select("id")
          .single();
        if (insertError) throw insertError;
        profileId = inserted.id;
        newProfiles.push(schoolName);
      }

      // school_offered_subjects upsert
      for (const [subjectId, { grades, semesters }] of subjectMap.entries()) {
        await supabaseAdmin
          .from("school_offered_subjects")
          .upsert(
            {
              school_profile_id: profileId,
              subject_id: subjectId,
              grades: Array.from(grades).sort(),
              semesters: Array.from(semesters).sort(),
              is_elective: true,
            },
            { onConflict: "school_profile_id,subject_id" },
          );
        totalSubjectCount++;
      }
    }

    return createSuccessResponse({
      schoolCount: schoolMap.size,
      subjectCount: totalSubjectCount,
      newProfiles,
      updatedProfiles,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "autoCollectSchoolSubjects" }, error, { tenantId });
    return createErrorResponse("학교 개설 과목 자동 수집 중 오류가 발생했습니다.");
  }
}

// ============================================
// 단일 학교 자동 수집 (import 후 fire-and-forget)
// ============================================

export async function autoCollectForSchool(
  tenantId: string,
  schoolName: string,
): Promise<void> {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) return;

    // 해당 학교 학생 목록
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("school_name", schoolName);

    if (!students || students.length === 0) return;
    const studentIds = students.map((s) => s.id);

    const subjectMap = new Map<string, { grades: Set<number>; semesters: Set<number> }>();

    const processRow = (row: { subject_id: string; grade: number; semester: number }) => {
      if (!row.subject_id) return;
      if (!subjectMap.has(row.subject_id)) {
        subjectMap.set(row.subject_id, { grades: new Set(), semesters: new Set() });
      }
      const entry = subjectMap.get(row.subject_id)!;
      if (row.grade) entry.grades.add(row.grade);
      if (row.semester) entry.semesters.add(row.semester);
    };

    const [{ data: scoreRows }, { data: setekRows }] = await Promise.all([
      supabaseAdmin
        .from("student_internal_scores")
        .select("subject_id, grade, semester")
        .in("student_id", studentIds),
      supabaseAdmin
        .from("student_record_seteks")
        .select("subject_id, grade, semester")
        .in("student_id", studentIds)
        .is("deleted_at", null),
    ]);

    for (const row of scoreRows ?? []) {
      processRow(row as { subject_id: string; grade: number; semester: number });
    }
    for (const row of setekRows ?? []) {
      processRow(row as { subject_id: string; grade: number; semester: number });
    }

    if (subjectMap.size === 0) return;

    // school_profiles upsert
    const { data: existing } = await supabaseAdmin
      .from("school_profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("school_name", schoolName)
      .maybeSingle();

    let profileId: string;
    if (existing) {
      profileId = existing.id;
      await supabaseAdmin
        .from("school_profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", profileId);
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("school_profiles")
        .insert({ tenant_id: tenantId, school_name: schoolName })
        .select("id")
        .single();
      if (insertError) throw insertError;
      profileId = inserted.id;
    }

    for (const [subjectId, { grades, semesters }] of subjectMap.entries()) {
      await supabaseAdmin
        .from("school_offered_subjects")
        .upsert(
          {
            school_profile_id: profileId,
            subject_id: subjectId,
            grades: Array.from(grades).sort(),
            semesters: Array.from(semesters).sort(),
            is_elective: true,
          },
          { onConflict: "school_profile_id,subject_id" },
        );
    }
  } catch (err) {
    logActionError({ ...LOG_CTX, action: "autoCollectForSchool" }, err, { tenantId, schoolName });
  }
}

// ============================================
// 학교 프로파일 목록 (통계 포함)
// ============================================

export async function fetchSchoolProfilesWithStats(): Promise<
  ActionResponse<SchoolProfileListItem[]>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("school_profiles")
      .select("id, school_name, school_category, updated_at")
      .eq("tenant_id", tenantId!)
      .order("school_name");

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return createSuccessResponse([]);
    }

    // 과목 수 및 학생 수 병렬 조회
    const items = await Promise.all(
      profiles.map(async (profile) => {
        const [{ count: subjectCount }, { count: studentCount }] = await Promise.all([
          supabaseAdmin
            .from("school_offered_subjects")
            .select("id", { count: "exact", head: true })
            .eq("school_profile_id", profile.id),
          supabaseAdmin
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId!)
            .eq("school_name", profile.school_name),
        ]);

        return {
          id: profile.id,
          school_name: profile.school_name,
          school_category: profile.school_category ?? null,
          updated_at: profile.updated_at,
          subject_count: subjectCount ?? 0,
          student_count: studentCount ?? 0,
        };
      }),
    );

    return createSuccessResponse(items);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSchoolProfilesWithStats" }, error);
    return createErrorResponse("학교 프로파일 목록을 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 학교 프로파일 상세
// ============================================

export async function fetchSchoolProfileDetail(
  profileId: string,
): Promise<ActionResponse<SchoolProfileDetail>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");
    }

    // 프로파일 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("school_profiles")
      .select("id, school_name, school_category, updated_at")
      .eq("id", profileId)
      .single();

    if (profileError) throw profileError;
    if (!profile) return createErrorResponse("학교 프로파일을 찾을 수 없습니다.");

    // 개설 과목 (subject + subject_group 조인)
    const { data: rawSubjects, error: subjectsError } = await supabaseAdmin
      .from("school_offered_subjects")
      .select("id, school_profile_id, subject_id, grades, semesters, is_elective, notes, subject:subject_id(name, subject_group:subject_group_id(name))")
      .eq("school_profile_id", profileId)
      .returns<OfferedSubjectRow[]>();

    if (subjectsError) throw subjectsError;

    const offeredSubjects: OfferedSubjectWithMeta[] = (rawSubjects ?? []).map((row) => {
      return {
        id: row.id,
        school_profile_id: row.school_profile_id,
        subject_id: row.subject_id,
        grades: row.grades ?? [],
        semesters: row.semesters ?? [],
        is_elective: row.is_elective ?? null,
        notes: row.notes ?? null,
        subject_name: row.subject?.name ?? null,
        subject_group_name: row.subject?.subject_group?.name ?? null,
      };
    });

    // 학생 수
    const { count: studentCount } = await supabaseAdmin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId!)
      .eq("school_name", profile.school_name);

    return createSuccessResponse({
      profile: {
        id: profile.id,
        school_name: profile.school_name,
        school_category: profile.school_category ?? null,
        updated_at: profile.updated_at,
      },
      offeredSubjects,
      studentCount: studentCount ?? 0,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSchoolProfileDetail" }, error, { profileId });
    return createErrorResponse("학교 프로파일 상세를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 개설 과목 추가/수정
// ============================================

export async function upsertOfferedSubjectAction(
  input: UpsertOfferedSubjectInput,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");
    }

    const { data, error } = await supabaseAdmin
      .from("school_offered_subjects")
      .upsert(
        {
          school_profile_id: input.schoolProfileId,
          subject_id: input.subjectId,
          grades: input.grades,
          semesters: input.semesters,
          is_elective: input.isElective,
          notes: input.notes ?? null,
        },
        { onConflict: "school_profile_id,subject_id" },
      )
      .select("id")
      .single();

    if (error) throw error;
    return createSuccessResponse({ id: data.id });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "upsertOfferedSubjectAction" }, error, { input });
    return createErrorResponse("개설 과목 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 과목 목록 조회 (AddSubjectDialog용)
// ============================================

export interface SubjectOption {
  id: string;
  name: string;
  group_name: string | null;
}

export async function fetchSubjectOptionsAction(): Promise<ActionResponse<SubjectOption[]>> {
  try {
    await requireAdminOrConsultant();
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");

    const { data, error } = await supabaseAdmin
      .from("subjects")
      .select("id, name, subject_group:subject_group_id(name)")
      .eq("is_active", true)
      .order("name")
      .returns<SubjectWithGroupRow[]>();

    if (error) throw error;

    const options: SubjectOption[] = (data ?? []).map((row) => {
      return { id: row.id, name: row.name, group_name: row.subject_group?.name ?? null };
    });

    return createSuccessResponse(options);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSubjectOptionsAction" }, error);
    return createErrorResponse("과목 목록을 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 개설 과목 삭제
// ============================================

export async function removeOfferedSubjectAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return createErrorResponse("Admin 클라이언트를 초기화할 수 없습니다.");
    }

    const { error } = await supabaseAdmin
      .from("school_offered_subjects")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeOfferedSubjectAction" }, error, { id });
    return createErrorResponse("개설 과목 삭제 중 오류가 발생했습니다.");
  }
}
