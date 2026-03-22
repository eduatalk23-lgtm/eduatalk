"use server";

// ============================================
// Phase 9.1: 수시 Report 데이터 수집 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as service from "../service";
import { fetchDiagnosisTabData } from "./diagnosis";
import type {
  RecordTabData,
  DiagnosisTabData,
  StorylineTabData,
  StrategyTabData,
} from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "report" };

// ============================================
// Report 통합 데이터 타입
// ============================================

export interface ReportData {
  student: {
    name: string | null;
    schoolName: string | null;
    grade: number;
    className: string | null;
    targetMajor: string | null;
    targetSubClassificationName: string | null;
    targetMidName: string | null;
  };
  consultantName: string | null;
  generatedAt: string;
  internalAnalysis: InternalAnalysis;
  internalScores: InternalScoreWithRelations[];
  mockAnalysis: MockAnalysis;
  recordDataByGrade: Record<number, RecordTabData>;
  diagnosisData: DiagnosisTabData;
  storylineData: StorylineTabData;
  strategyData: StrategyTabData;
}

// ============================================
// Report 데이터 수집
// ============================================

export async function fetchReportData(
  studentId: string,
): Promise<ActionResponse<ReportData>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 학생 기본 정보 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, grade, class, school_name, target_major, target_sub_classification_id, user_profiles(name)")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const studentGrade = student.grade ?? 3;
    const studentName =
      (student.user_profiles as unknown as { name: string } | null)?.name ?? null;

    // 소분류 이름 조회
    let targetSubClassificationName: string | null = null;
    let targetMidName: string | null = null;
    if (student.target_sub_classification_id) {
      const { data: dc } = await supabase
        .from("department_classifications")
        .select("mid_name, sub_name")
        .eq("id", student.target_sub_classification_id)
        .single();
      if (dc) {
        targetSubClassificationName = dc.sub_name;
        targetMidName = dc.mid_name;
      }
    }

    // 컨설턴트 이름 조회
    const { data: consultant } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    // yearGradePairs 계산 (StudentRecordClient 로직 동일)
    const currentSchoolYear = calculateSchoolYear();
    const yearGradePairs: { grade: number; schoolYear: number }[] = [];
    for (let g = 1; g <= studentGrade; g++) {
      const sy = currentSchoolYear - (studentGrade - g);
      yearGradePairs.push({ grade: g, schoolYear: sy });
    }

    const initialSchoolYear = yearGradePairs[yearGradePairs.length - 1]?.schoolYear ?? currentSchoolYear;

    // 병렬 데이터 수집
    const [
      internalAnalysis,
      internalScores,
      mockAnalysis,
      ...recordResults
    ] = await Promise.all([
      getInternalAnalysis(tenantId, studentId),
      getInternalScoresByTerm(studentId, tenantId),
      getMockAnalysis(tenantId, studentId),
      ...yearGradePairs.map((p) =>
        service.getRecordTabData(studentId, p.schoolYear, tenantId),
      ),
    ]);

    // 2차 병렬: diagnosis, storyline, strategy
    const [diagnosisData, storylineData, strategyData] = await Promise.all([
      fetchDiagnosisTabData(studentId, initialSchoolYear, tenantId),
      service.getStorylineTabData(studentId, initialSchoolYear, tenantId),
      service.getStrategyTabData(studentId, initialSchoolYear, tenantId),
    ]);

    // recordDataByGrade 매핑
    const recordDataByGrade: Record<number, RecordTabData> = {};
    yearGradePairs.forEach((p, i) => {
      recordDataByGrade[p.grade] = recordResults[i] as RecordTabData;
    });

    const reportData: ReportData = {
      student: {
        name: studentName,
        schoolName: student.school_name ?? null,
        grade: studentGrade,
        className: student.class ?? null,
        targetMajor: student.target_major ?? null,
        targetSubClassificationName,
        targetMidName,
      },
      consultantName: consultant?.name ?? null,
      generatedAt: new Date().toISOString(),
      internalAnalysis,
      internalScores,
      mockAnalysis,
      recordDataByGrade,
      diagnosisData,
      storylineData,
      strategyData,
    };

    return { success: true, data: reportData };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Report 데이터 수집 실패",
    };
  }
}
