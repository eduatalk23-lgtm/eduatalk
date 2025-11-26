import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type CareerField = 
  | "인문계열"
  | "사회계열"
  | "자연계열"
  | "공학계열"
  | "의약계열"
  | "예체능계열"
  | "교육계열"
  | "농업계열"
  | "해양계열"
  | "기타";

export type StudentCareerFieldPreference = {
  id: string;
  student_id: string;
  career_field: CareerField;
  priority: number;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 학생 ID로 진로 계열 선호도 목록 조회 (우선순위 순)
 */
export async function getStudentCareerFieldPreferences(
  studentId: string
): Promise<StudentCareerFieldPreference[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_career_field_preferences")
    .select("*")
    .eq("student_id", studentId)
    .order("priority", { ascending: true });

  if (error) {
    console.error("[data/studentCareerFieldPreferences] 진로 계열 선호도 조회 실패", error);
    return [];
  }

  return (data as StudentCareerFieldPreference[]) ?? [];
}

/**
 * 학생의 진로 계열 선호도 전체 교체
 */
export async function replaceStudentCareerFieldPreferences(
  studentId: string,
  preferences: { career_field: CareerField; priority: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 트랜잭션: 기존 데이터 삭제 후 새로 삽입
  const { error: deleteError } = await supabase
    .from("student_career_field_preferences")
    .delete()
    .eq("student_id", studentId);

  if (deleteError) {
    console.error("[data/studentCareerFieldPreferences] 기존 선호도 삭제 실패", deleteError);
    return { success: false, error: deleteError.message };
  }

  if (preferences.length === 0) {
    return { success: true };
  }

  const payload = preferences.map((pref) => ({
    student_id: studentId,
    career_field: pref.career_field,
    priority: pref.priority,
  }));

  const { error: insertError } = await supabase
    .from("student_career_field_preferences")
    .insert(payload);

  if (insertError) {
    console.error("[data/studentCareerFieldPreferences] 선호도 저장 실패", insertError);
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

/**
 * 학생의 진로 계열 선호도 추가
 */
export async function addStudentCareerFieldPreference(
  studentId: string,
  careerField: CareerField
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 현재 최대 우선순위 확인
  const { data: existing } = await supabase
    .from("student_career_field_preferences")
    .select("priority")
    .eq("student_id", studentId)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPriority = existing ? existing.priority + 1 : 1;

  const { error } = await supabase
    .from("student_career_field_preferences")
    .insert({
      student_id: studentId,
      career_field: careerField,
      priority: nextPriority,
    });

  if (error) {
    console.error("[data/studentCareerFieldPreferences] 선호도 추가 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학생의 진로 계열 선호도 삭제
 */
export async function removeStudentCareerFieldPreference(
  studentId: string,
  careerField: CareerField
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_career_field_preferences")
    .delete()
    .eq("student_id", studentId)
    .eq("career_field", careerField);

  if (error) {
    console.error("[data/studentCareerFieldPreferences] 선호도 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}









