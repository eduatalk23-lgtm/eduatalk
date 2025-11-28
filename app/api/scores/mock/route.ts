import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentTerm, calculateSchoolYear } from "@/lib/data/studentTerms";
import type { MockScoreInputForm, MockScoreInsert } from "@/lib/types/scoreInput";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      tenantId,
      scores,
    }: {
      studentId: string;
      tenantId: string;
      scores: MockScoreInputForm[];
    } = body;

    // 유효성 검증
    if (!studentId || !tenantId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    if (!scores || scores.length === 0) {
      return NextResponse.json(
        { error: "성적 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 각 성적별로 student_term_id 조회 및 저장
    const insertedScores: MockScoreInsert[] = [];

    for (const score of scores) {
      // 시험일로부터 학년도 계산
      const examDate = new Date(score.exam_date);
      const schoolYear = calculateSchoolYear(examDate);

      // student_term_id 조회 (모의고사는 학기 정보가 없을 수 있으므로 nullable)
      // 먼저 해당 학년도의 1학기 term을 찾아봄
      let studentTermId: string | null = null;
      
      const term = await getStudentTerm({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        grade: score.grade,
        semester: 1, // 기본값으로 1학기
      });

      if (term) {
        studentTermId = term.id;
      }

      // 성적 데이터 준비
      const scoreData: MockScoreInsert = {
        tenant_id: tenantId,
        student_id: studentId,
        student_term_id: studentTermId, // nullable
        exam_date: score.exam_date,
        exam_title: score.exam_title,
        grade: score.grade,
        subject_id: score.subject_id,
        subject_group_id: score.subject_group_id,
        grade_score: score.grade_score,
        standard_score: score.standard_score ?? null,
        percentile: score.percentile ?? null,
        raw_score: score.raw_score ?? null,
      };

      insertedScores.push(scoreData);
    }

    // 일괄 삽입
    const { data, error } = await supabase
      .from("student_mock_scores")
      .insert(insertedScores)
      .select();

    if (error) {
      console.error("[API] 모의고사 성적 저장 실패", error);
      return NextResponse.json(
        { error: "성적 저장에 실패했습니다.", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "모의고사 성적이 저장되었습니다.",
      data: { mock_scores: data },
    });
  } catch (error) {
    console.error("[API] 모의고사 성적 저장 중 오류", error);
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

