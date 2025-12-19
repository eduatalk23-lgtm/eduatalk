import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateStudentTerm } from "@/lib/data/studentTerms";
import type { InternalScoreInputForm, InternalScoreInsert } from "@/lib/types/scoreInput";
import {
  apiSuccess,
  apiCreated,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      tenantId,
      curriculumRevisionId,
      schoolYear,
      scores,
    }: {
      studentId: string;
      tenantId: string;
      curriculumRevisionId: string;
      schoolYear: number;
      scores: InternalScoreInputForm[];
    } = body;

    // 유효성 검증
    if (!studentId || !tenantId || !curriculumRevisionId || !schoolYear) {
      return apiBadRequest("필수 파라미터가 누락되었습니다.");
    }

    if (!scores || scores.length === 0) {
      return apiBadRequest("성적 데이터가 없습니다.");
    }

    const supabase = await createSupabaseServerClient();

    // 각 성적별로 student_term_id 조회/생성 및 저장
    const insertedScores: InternalScoreInsert[] = [];

    for (const score of scores) {
      // student_term_id 조회/생성
      const studentTermId = await getOrCreateStudentTerm({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        grade: score.grade,
        semester: score.semester,
        curriculum_revision_id: curriculumRevisionId,
      });

      // 성적 데이터 준비
      const scoreData: InternalScoreInsert = {
        tenant_id: tenantId,
        student_id: studentId,
        student_term_id: studentTermId,
        curriculum_revision_id: curriculumRevisionId,
        subject_group_id: score.subject_group_id,
        subject_type_id: score.subject_type_id,
        subject_id: score.subject_id,
        grade: score.grade,
        semester: score.semester,
        credit_hours: score.credit_hours,
        rank_grade: score.rank_grade,
        raw_score: score.raw_score ?? null,
        avg_score: score.avg_score ?? null,
        std_dev: score.std_dev ?? null,
        total_students: score.total_students ?? null,
      };

      insertedScores.push(scoreData);
    }

    // 일괄 삽입
    const { data, error } = await supabase
      .from("student_internal_scores")
      .insert(insertedScores)
      .select();

    if (error) {
      return handleApiError(error, "[api/scores/internal] 내신 성적 저장 실패");
    }

    return apiCreated({
      internal_scores: data,
    });
  } catch (error) {
    return handleApiError(error, "[api/scores/internal]");
  }
}

