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
      .select("id, grade, class, school_name, target_major, user_profiles(name)")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const studentGrade = student.grade ?? 3;
    const studentName =
      (student.user_profiles as unknown as { name: string } | null)?.name ?? null;

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

    // 병렬 데이터 수집 (부분 실패 허용 — 성적 데이터 실패가 생기부 분석을 중단시키지 않도록)
    const EMPTY_INTERNAL: InternalAnalysis = { totalGpa: null, adjustedGpa: null, zIndex: null, subjectStrength: {} };
    const EMPTY_MOCK: MockAnalysis = { recentExam: null, avgPercentile: null, totalStdScore: null, best3GradeSum: null };

    const settled = await Promise.allSettled([
      getInternalAnalysis(tenantId, studentId),
      getInternalScoresByTerm(studentId, tenantId),
      getMockAnalysis(tenantId, studentId),
      ...yearGradePairs.map((p) =>
        service.getRecordTabData(studentId, p.schoolYear, tenantId),
      ),
    ]);

    const internalAnalysis = settled[0].status === "fulfilled" ? settled[0].value : EMPTY_INTERNAL;
    const internalScores = settled[1].status === "fulfilled" ? settled[1].value : ([] as InternalScoreWithRelations[]);
    const mockAnalysis = settled[2].status === "fulfilled" ? settled[2].value : EMPTY_MOCK;
    const recordResults = settled.slice(3).map((r) =>
      r.status === "fulfilled" ? r.value : { seteks: [], personalSeteks: [], changche: [], haengteuk: null, readings: [], schoolAttendance: null },
    );

    // 실패 로그 (디버깅용)
    for (const [i, s] of settled.entries()) {
      if (s.status === "rejected") {
        logActionError({ ...LOG_CTX, action: `fetchReportData.parallel[${i}]` }, s.reason, { studentId });
      }
    }

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

    // 소분류 이름은 diagnosisData에서, 중분류 이름은 별도 조회
    const targetSubClassificationName = diagnosisData.targetSubClassificationName ?? null;
    let targetMidName: string | null = null;
    if (diagnosisData.targetSubClassificationId) {
      const { data: dc } = await supabase
        .from("department_classifications")
        .select("mid_name")
        .eq("id", diagnosisData.targetSubClassificationId)
        .single();
      targetMidName = dc?.mid_name ?? null;
    }

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
