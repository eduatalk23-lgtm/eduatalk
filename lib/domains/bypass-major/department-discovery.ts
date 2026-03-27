// ============================================
// Phase C-1: 진단 기반 학과 발견
// AI 진단의 recommended_majors → university_departments 매칭
// target_department 없이도 우회학과 분석 시작 가능
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── 타입 ──────────────────────────────────

export interface DiscoveredDepartment {
  departmentId: string;
  departmentName: string;
  universityName: string;
  midClassification: string | null;
  matchSource: "exact_name" | "sub_classification" | "mid_classification" | "student_target";
  matchConfidence: number; // 0-100
}

export interface DiagnosisContext {
  recordDirection: string | null;
  directionStrength: string | null;
  strengths: string[];
  weaknesses: string[];
  improvements: Array<{ priority: string; area: string; action: string }>;
  overallGrade: string | null;
}

export interface DiscoveryResult {
  targetDepartments: DiscoveredDepartment[];
  source: "diagnosis_recommended" | "student_target" | "none";
  recommendedMajors: string[];
  diagnosisContext: DiagnosisContext | null;
}

// ─── 계열 키 → mid_classification 매핑 ──────

/**
 * AI 진단 recommended_majors 계열 키 → university_departments.mid_classification 매핑.
 * 1:N 가능 (하나의 계열이 여러 mid_classification에 대응).
 */
const MAJOR_TO_MID_CLASSIFICATION: Record<string, string[]> = {
  "법·행정": ["법학", "사회과학"],
  "경영·경제": ["경영·경제"],
  "심리": ["사회과학"],
  "사회복지": ["사회과학"],
  "교육": ["교육"],
  "국어": ["언어·문학"],
  "외국어": ["언어·문학"],
  "사학·철학": ["인문학"],
  "언론·홍보": ["사회과학"],
  "정치·외교": ["사회과학"],
  "수리·통계": ["수학·물리·천문·지구"],
  "물리·천문": ["수학·물리·천문·지구"],
  "생명·바이오": ["화학·생명과학·환경"],
  "의학·약학": ["의료", "의료예과", "약학"],
  "컴퓨터·정보": ["전기·전자·컴퓨터"],
  "기계·자동차·로봇": ["기계", "교통·수송"],
  "화학·신소재·에너지": ["화공·고분자·에너지", "재료"],
  "건축·사회시스템": ["건설"],
  "사회": ["사회과학"],
  "전기·전자": ["전기·전자·컴퓨터"],
  "보건": ["보건", "간호"],
  "생활과학": ["생활과학"],
  "농림": ["농림·수산"],
};

// ─── 메인 함수 ─────────────────────────────

/**
 * AI 진단 또는 학생 프로필에서 우회학과 분석 대상 학과를 자동 발견.
 *
 * 우선순위:
 * 1. AI 진단 recommended_majors → mid_classification 매핑 → 대표 학과 선택
 * 2. 폴백: students.target_sub_classification_id → 기존 방식
 */
export async function discoverDepartmentsFromDiagnosis(
  studentId: string,
  tenantId: string,
  schoolYear: number,
): Promise<DiscoveryResult> {
  const supabase = await createSupabaseServerClient();

  // 1. AI 진단의 recommended_majors + 근거 조회
  const { data: diagnosis } = await supabase
    .from("student_record_diagnosis")
    .select("recommended_majors, record_direction, direction_strength, strengths, weaknesses, improvements, overall_grade")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recommendedMajors = Array.isArray(diagnosis?.recommended_majors)
    ? (diagnosis.recommended_majors as string[])
    : [];

  const diagnosisContext: DiagnosisContext | null = diagnosis
    ? {
        recordDirection: (diagnosis.record_direction as string) ?? null,
        directionStrength: (diagnosis.direction_strength as string) ?? null,
        strengths: Array.isArray(diagnosis.strengths) ? (diagnosis.strengths as string[]) : [],
        weaknesses: Array.isArray(diagnosis.weaknesses) ? (diagnosis.weaknesses as string[]) : [],
        improvements: Array.isArray(diagnosis.improvements)
          ? (diagnosis.improvements as Array<{ priority: string; area: string; action: string }>)
          : [],
        overallGrade: (diagnosis.overall_grade as string) ?? null,
      }
    : null;

  // 2. recommended_majors → mid_classification → 대표 학과 검색
  if (recommendedMajors.length > 0) {
    const departments = await findDepartmentsFromMajorKeys(supabase, recommendedMajors);
    if (departments.length > 0) {
      return {
        targetDepartments: departments,
        source: "diagnosis_recommended",
        recommendedMajors,
        diagnosisContext,
      };
    }
  }

  // 3. 폴백: students.target_sub_classification_id → mid_classification 매칭
  const { data: student } = await supabase
    .from("students")
    .select("target_sub_classification_id")
    .eq("id", studentId)
    .single();

  const tgtClassId = student?.target_sub_classification_id as number | null;
  if (tgtClassId) {
    const departments = await findDepartmentsFromClassificationId(supabase, tgtClassId);
    if (departments.length > 0) {
      return {
        targetDepartments: departments,
        source: "student_target",
        recommendedMajors,
        diagnosisContext,
      };
    }
  }

  return { targetDepartments: [], source: "none", recommendedMajors, diagnosisContext };
}

// ─── 헬퍼 ──────────────────────────────────

/**
 * 계열 키 배열 → university_departments에서 중분류별 대표 학과 1개씩 선택.
 * 커리큘럼이 있는 학과를 우선, 없으면 아무 학과나 선택.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findDepartmentsFromMajorKeys(supabase: any, majorKeys: string[]): Promise<DiscoveredDepartment[]> {
  // 계열 키 → mid_classification 목록 수집
  const midClassifications = new Set<string>();
  for (const key of majorKeys) {
    const mids = MAJOR_TO_MID_CLASSIFICATION[key];
    if (mids) {
      for (const m of mids) midClassifications.add(m);
    }
  }

  if (midClassifications.size === 0) return [];

  // 단일 IN 쿼리로 전체 mid_classification 매칭 학과 조회
  const midArray = [...midClassifications];
  const { data: allDepts } = await supabase
    .from("university_departments")
    .select("id, university_name, department_name, mid_classification")
    .in("mid_classification", midArray);

  if (!allDepts || allDepts.length === 0) return [];

  // mid_classification별 대표 학과 1개씩 선택
  const seenMids = new Set<string>();
  const results: DiscoveredDepartment[] = [];

  for (const dept of allDepts as Array<{ id: string; university_name: string; department_name: string; mid_classification: string }>) {
    if (seenMids.has(dept.mid_classification)) continue;
    seenMids.add(dept.mid_classification);

    results.push({
      departmentId: dept.id,
      departmentName: dept.department_name,
      universityName: dept.university_name,
      midClassification: dept.mid_classification,
      matchSource: "mid_classification",
      matchConfidence: 70,
    });
  }

  // 최대 5개로 제한
  return results.slice(0, 5);
}

/**
 * department_classification.id → mid_name → university_departments 매칭.
 * 기존 파이프라인의 폴백 경로 (ㆍ vs · 정규화 포함).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findDepartmentsFromClassificationId(supabase: any, classificationId: number): Promise<DiscoveredDepartment[]> {
  const { data: dc } = await supabase
    .from("department_classification")
    .select("mid_name")
    .eq("id", classificationId)
    .single();

  if (!dc?.mid_name) return [];

  const normalizedMid = (dc.mid_name as string).replace(/ㆍ/g, "·");

  const { data: depts } = await supabase
    .from("university_departments")
    .select("id, university_name, department_name, mid_classification")
    .eq("mid_classification", normalizedMid)
    .limit(3);

  if (!depts?.length) return [];

  return depts.map((dept: { id: string; university_name: string; department_name: string; mid_classification: string }) => ({
    departmentId: dept.id,
    departmentName: dept.department_name,
    universityName: dept.university_name,
    midClassification: dept.mid_classification,
    matchSource: "mid_classification" as const,
    matchConfidence: 60,
  }));
}
