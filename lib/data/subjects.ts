import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubjectGroup = {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  default_subject_type?: string | null; // 기본 과목 유형 (공통, 일반선택, 진로선택)
  created_at?: string;
  updated_at?: string;
};

export type Subject = {
  id: string;
  tenant_id: string;
  subject_group_id: string;
  name: string;
  display_order: number;
  subject_type?: string | null; // 과목별 과목 유형 (null이면 교과 그룹의 default_subject_type 사용)
  created_at?: string;
  updated_at?: string;
};

/**
 * 교과 그룹 목록 조회
 */
export async function getSubjectGroups(
  tenantId: string
): Promise<SubjectGroup[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subject_groups")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/subjects] 교과 그룹 조회 실패", error);
    return [];
  }

  return (data as SubjectGroup[] | null) ?? [];
}

/**
 * 특정 교과 그룹에 속한 과목 목록 조회
 */
export async function getSubjectsByGroup(
  tenantId: string,
  subjectGroupId: string
): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("subject_group_id", subjectGroupId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/subjects] 과목 조회 실패", error);
    return [];
  }

  return (data as Subject[] | null) ?? [];
}

/**
 * 교과 그룹 이름으로 과목 목록 조회
 */
export async function getSubjectsByGroupName(
  tenantId: string,
  subjectGroupName: string
): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();

  // 먼저 교과 그룹 ID 조회
  const { data: groupData, error: groupError } = await supabase
    .from("subject_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", subjectGroupName)
    .single();

  if (groupError || !groupData) {
    console.error("[data/subjects] 교과 그룹 조회 실패", groupError);
    return [];
  }

  return getSubjectsByGroup(tenantId, groupData.id);
}

/**
 * 모든 교과와 과목을 함께 조회 (계층 구조)
 */
export async function getSubjectGroupsWithSubjects(
  tenantId: string
): Promise<(SubjectGroup & { subjects: Subject[] })[]> {
  const groups = await getSubjectGroups(tenantId);

  const groupsWithSubjects = await Promise.all(
    groups.map(async (group) => {
      const subjects = await getSubjectsByGroup(tenantId, group.id);
      return { ...group, subjects };
    })
  );

  return groupsWithSubjects;
}

