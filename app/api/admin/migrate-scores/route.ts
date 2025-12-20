"use server";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getOrCreateStudentTerm } from "@/lib/data/studentTerms";
import { getActiveCurriculumRevision } from "@/lib/data/subjects";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

/**
 * 성적 데이터 마이그레이션 API
 * 
 * student_school_scores (레거시) → student_internal_scores (신규)
 * 
 * 보안: admin 권한만 실행 가능
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 권한 확인
    const userRole = await getCurrentUserRole();
    if (userRole.role !== "admin" && userRole.role !== "superadmin") {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    // 2. 헤더 키 확인 (추가 보안)
    const authKey = request.headers.get("x-migration-key");
    const expectedKey = process.env.MIGRATION_API_KEY;
    if (expectedKey && authKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: "인증 키가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { success: false, error: "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요." },
        { status: 500 }
      );
    }

    // 3. 활성화된 개정교육과정 조회 (기본값)
    const activeRevision = await getActiveCurriculumRevision();
    if (!activeRevision) {
      return NextResponse.json(
        { success: false, error: "활성화된 개정교육과정을 찾을 수 없습니다." },
        { status: 500 }
      );
    }

    // 4. 레거시 데이터 조회
    const { data: legacyScores, error: selectError } = await adminClient
      .from("student_school_scores")
      .select("*")
      .order("created_at", { ascending: true });

    if (selectError) {
      console.error("[migrate-scores] 레거시 데이터 조회 실패", selectError);
      return NextResponse.json(
        { success: false, error: "레거시 데이터 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    if (!legacyScores || legacyScores.length === 0) {
      return NextResponse.json({
        success: true,
        message: "마이그레이션할 데이터가 없습니다.",
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          errors: [],
        },
      });
    }

    // 5. 교과 그룹 및 과목 매핑 캐시 생성
    const { data: subjectGroups } = await adminClient
      .from("subject_groups")
      .select("id, name, curriculum_revision_id");

    const { data: subjects } = await adminClient
      .from("subjects")
      .select("id, name, subject_group_id");

    const { data: subjectTypes } = await adminClient
      .from("subject_types")
      .select("id, name, curriculum_revision_id");

    // 매핑 맵 생성
    const subjectGroupMap = new Map<string, string>(); // name -> id
    const subjectMap = new Map<string, Map<string, string>>(); // groupName -> (subjectName -> id)
    const subjectTypeMap = new Map<string, string>(); // name -> id

    subjectGroups?.forEach((group) => {
      if (group.curriculum_revision_id === activeRevision.id) {
        subjectGroupMap.set(group.name, group.id);
      }
    });

    subjects?.forEach((subject) => {
      const group = subjectGroups?.find((g) => g.id === subject.subject_group_id);
      if (group) {
        if (!subjectMap.has(group.name)) {
          subjectMap.set(group.name, new Map());
        }
        subjectMap.get(group.name)?.set(subject.name, subject.id);
      }
    });

    subjectTypes?.forEach((type) => {
      if (type.curriculum_revision_id === activeRevision.id) {
        subjectTypeMap.set(type.name, type.id);
      }
    });

    // 6. 배치 처리로 마이그레이션
    const BATCH_SIZE = 100;
    const stats = {
      total: legacyScores.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (let i = 0; i < legacyScores.length; i += BATCH_SIZE) {
      const batch = legacyScores.slice(i, i + BATCH_SIZE);
      const migratedBatch: Array<{
        tenant_id: string;
        student_id: string;
        student_term_id: string;
        curriculum_revision_id: string;
        subject_group_id: string;
        subject_type_id: string;
        subject_id: string;
        grade: number;
        semester: number;
        credit_hours: number;
        raw_score: number | null;
        avg_score: number | null;
        std_dev: number | null;
        rank_grade: number | null;
        total_students: number | null;
      }> = [];

      for (const legacy of batch) {
        try {
          // 필수 필드 검증
          if (!legacy.tenant_id || !legacy.student_id || !legacy.grade || !legacy.semester) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: "필수 필드가 누락되었습니다.",
            });
            continue;
          }

          // subject_group (텍스트) → subject_group_id (FK)
          const subjectGroupName = legacy.subject_group;
          if (!subjectGroupName) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: "교과 그룹 이름이 없습니다.",
            });
            continue;
          }

          const subjectGroupId = subjectGroupMap.get(subjectGroupName);
          if (!subjectGroupId) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: `교과 그룹 '${subjectGroupName}'을 찾을 수 없습니다.`,
            });
            continue;
          }

          // subject_name → subject_id (FK)
          const subjectName = legacy.subject_name;
          if (!subjectName) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: "과목 이름이 없습니다.",
            });
            continue;
          }

          const subjectIdMap = subjectMap.get(subjectGroupName);
          const subjectId = subjectIdMap?.get(subjectName);
          if (!subjectId) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: `과목 '${subjectName}' (교과: ${subjectGroupName})을 찾을 수 없습니다.`,
            });
            continue;
          }

          // subject_type (텍스트) → subject_type_id (FK)
          const subjectTypeName = legacy.subject_type || "공통";
          const subjectTypeId = subjectTypeMap.get(subjectTypeName);
          if (!subjectTypeId) {
            stats.failed++;
            stats.errors.push({
              id: legacy.id,
              error: `과목구분 '${subjectTypeName}'을 찾을 수 없습니다.`,
            });
            continue;
          }

          // 학년도 계산
          const schoolYear = legacy.created_at
            ? calculateSchoolYear(new Date(legacy.created_at))
            : calculateSchoolYear();

          // student_term_id 조회/생성
          const studentTermId = await getOrCreateStudentTerm({
            tenant_id: legacy.tenant_id,
            student_id: legacy.student_id,
            school_year: schoolYear,
            grade: legacy.grade,
            semester: legacy.semester,
            curriculum_revision_id: activeRevision.id,
          });

          // 필드 매핑
          migratedBatch.push({
            tenant_id: legacy.tenant_id,
            student_id: legacy.student_id,
            student_term_id: studentTermId,
            curriculum_revision_id: activeRevision.id,
            subject_group_id: subjectGroupId,
            subject_type_id: subjectTypeId,
            subject_id: subjectId,
            grade: legacy.grade,
            semester: legacy.semester,
            credit_hours: legacy.credit_hours || 4, // 기본값 4
            raw_score: legacy.raw_score ?? null,
            avg_score: legacy.subject_average ?? null, // subject_average → avg_score
            std_dev: legacy.standard_deviation ?? null, // standard_deviation → std_dev
            rank_grade: legacy.grade_score ?? legacy.rank_grade ?? null, // grade_score → rank_grade
            total_students: legacy.total_students ?? null,
          });
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            id: legacy.id,
            error: error instanceof Error ? error.message : "알 수 없는 오류",
          });
        }
      }

      // 배치 삽입
      if (migratedBatch.length > 0) {
        const { error: insertError } = await adminClient
          .from("student_internal_scores")
          .insert(migratedBatch);

        if (insertError) {
          console.error("[migrate-scores] 배치 삽입 실패", insertError);
          // 개별 에러로 기록
          migratedBatch.forEach((item) => {
            stats.failed++;
            stats.errors.push({
              id: item.student_id, // 임시 ID
              error: insertError.message,
            });
          });
        } else {
          stats.success += migratedBatch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "마이그레이션이 완료되었습니다.",
      stats,
    });
  } catch (error) {
    console.error("[migrate-scores] 마이그레이션 실패", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

