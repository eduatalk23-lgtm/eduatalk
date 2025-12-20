import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SubjectGroup = {
  id: string;
  curriculum_revision_id: string;
  name: string;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type SubjectType = {
  id: string;
  curriculum_revision_id: string;
  name: string; // 과목구분명 (예: 공통, 일반선택, 진로선택)
  display_order?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Subject = {
  id: string;
  subject_group_id: string;
  name: string;
  display_order?: number;
  subject_type_id?: string | null; // 과목구분 ID (FK → subject_types)
  subject_type?: string | null; // 과목구분명 (JOIN 결과, 하위 호환성)
  is_active?: boolean; // 활성화 여부
  created_at?: string;
  updated_at?: string;
};

/**
 * 교과 그룹 목록 조회 (전역 관리)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항, 없으면 모든 개정교육과정의 교과 그룹 조회)
 */
export async function getSubjectGroups(
  curriculumRevisionId?: string
): Promise<SubjectGroup[]> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  let query = supabase
    .from("subject_groups")
    .select("*");

  if (curriculumRevisionId) {
    query = query.eq("curriculum_revision_id", curriculumRevisionId);
  }

  const { data, error } = await query
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/subjects] 교과 그룹 조회 실패", error);
    return [];
  }

  return (data as SubjectGroup[] | null) ?? [];
}

/**
 * 과목구분 목록 조회 (개정교육과정별)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항, 없으면 모든 개정교육과정의 과목구분 조회)
 */
export async function getSubjectTypes(
  curriculumRevisionId?: string
): Promise<SubjectType[]> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  let query = supabase
    .from("subject_types")
    .select("*")
    .eq("is_active", true);

  if (curriculumRevisionId) {
    query = query.eq("curriculum_revision_id", curriculumRevisionId);
  }

  const { data, error } = await query
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/subjects] 과목구분 조회 실패", error);
    return [];
  }

  return (data as SubjectType[] | null) ?? [];
}

/**
 * 특정 교과 그룹에 속한 과목 목록 조회 (전역 관리)
 * 과목구분 정보도 함께 조회
 */
export async function getSubjectsByGroup(
  subjectGroupId: string
): Promise<Subject[]> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(`
      *,
      subject_types:subject_type_id (
        id,
        name
      )
    `)
    .eq("subject_group_id", subjectGroupId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/subjects] 과목 조회 실패", error);
    return [];
  }

  // JOIN 결과를 평탄화
  type SubjectWithJoin = Subject & {
    subject_types?: { name: string } | null;
  };
  return ((data as SubjectWithJoin[]) ?? []).map((subject) => ({
    ...subject,
    subject_type: subject.subject_types?.name || null,
  })) as Subject[];
}

/**
 * 교과 그룹 이름으로 과목 목록 조회 (전역 관리)
 * @param subjectGroupName 교과 그룹 이름
 * @param curriculumRevisionId 개정교육과정 ID (선택사항, 없으면 첫 번째로 찾은 교과 그룹 사용)
 */
export async function getSubjectsByGroupName(
  subjectGroupName: string,
  curriculumRevisionId?: string
): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();

  // 먼저 교과 그룹 ID 조회
  let query = supabase
    .from("subject_groups")
    .select("id")
    .eq("name", subjectGroupName);

  if (curriculumRevisionId) {
    query = query.eq("curriculum_revision_id", curriculumRevisionId);
  }

  const { data: groupData, error: groupError } = await query
    .maybeSingle();

  if (groupError || !groupData) {
    console.error("[data/subjects] 교과 그룹 조회 실패", groupError);
    return [];
  }

  return getSubjectsByGroup(groupData.id);
}

/**
 * 모든 교과와 과목을 함께 조회 (계층 구조, 전역 관리)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
export async function getSubjectGroupsWithSubjects(
  curriculumRevisionId?: string
): Promise<(SubjectGroup & { subjects: Subject[] })[]> {
  const groups = await getSubjectGroups(curriculumRevisionId);

  const groupsWithSubjects = await Promise.all(
    groups.map(async (group) => {
      const subjects = await getSubjectsByGroup(group.id);
      return { ...group, subjects };
    })
  );

  return groupsWithSubjects;
}

/**
 * 개정교육과정별 전체 계층 구조 조회
 * 개정교육과정 → 교과 → 과목 → 과목구분
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
export async function getFullSubjectHierarchy(
  curriculumRevisionId?: string
): Promise<{
  curriculumRevision: { id: string; name: string; year?: number | null };
  subjectGroups: (SubjectGroup & {
    subjects: (Subject & { subjectType?: SubjectType | null })[];
  })[];
  subjectTypes: SubjectType[];
}> {
  const supabase = await createSupabaseServerClient();

  // 개정교육과정 조회
  let revisionQuery = supabase.from("curriculum_revisions").select("*");
  if (curriculumRevisionId) {
    revisionQuery = revisionQuery.eq("id", curriculumRevisionId);
  } else {
    revisionQuery = revisionQuery.eq("is_active", true).order("name", { ascending: true }).limit(1);
  }

  const { data: revisionData, error: revisionError } = await revisionQuery.maybeSingle();

  if (revisionError || !revisionData) {
    console.error("[data/subjects] 개정교육과정 조회 실패", revisionError);
    throw new Error("개정교육과정을 찾을 수 없습니다.");
  }

  const revisionId = revisionData.id;

  // 교과 그룹 조회
  const groups = await getSubjectGroups(revisionId);

  // 과목구분 조회
  const subjectTypes = await getSubjectTypes(revisionId);

  // 과목 조회 (과목구분 정보 포함)
  const groupsWithSubjects = await Promise.all(
    groups.map(async (group) => {
      const subjects = await getSubjectsByGroup(group.id);
      const subjectsWithType = subjects.map((subject) => ({
        ...subject,
        subjectType: subject.subject_type_id
          ? subjectTypes.find((st) => st.id === subject.subject_type_id) || null
          : null,
      }));
      return { ...group, subjects: subjectsWithType };
    })
  );

  return {
    curriculumRevision: {
      id: revisionData.id,
      name: revisionData.name,
      year: revisionData.year,
    },
    subjectGroups: groupsWithSubjects,
    subjectTypes,
  };
}

/**
 * 개정교육과정별 전체 구조를 단일 쿼리로 조회 (최적화 버전)
 * Supabase JOIN을 사용하여 한 번의 쿼리로 모든 데이터 조회
 * @param curriculumRevisionId 개정교육과정 ID (필수)
 */
export async function getSubjectHierarchyOptimized(
  curriculumRevisionId: string
): Promise<{
  curriculumRevision: { id: string; name: string; year?: number | null };
  subjectGroups: (SubjectGroup & {
    subjects: (Subject & { subjectType: SubjectType | null })[];
  })[];
  subjectTypes: SubjectType[];
}> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  // 1. 개정교육과정 조회
  const { data: revisionData, error: revisionError } = await supabase
    .from("curriculum_revisions")
    .select("*")
    .eq("id", curriculumRevisionId)
    .single();

  if (revisionError || !revisionData) {
    console.error("[data/subjects] 개정교육과정 조회 실패", revisionError);
    throw new Error("개정교육과정을 찾을 수 없습니다.");
  }

  // 2. 교과 + 과목 + 과목구분 한 번에 조회 (JOIN)
  const { data: groupsData, error: groupsError } = await supabase
    .from("subject_groups")
    .select(`
      *,
      subjects:subjects (
        *,
        subject_types:subject_type_id (
          id,
          name,
          is_active
        )
      )
    `)
    .eq("curriculum_revision_id", curriculumRevisionId)
    .order("name", { ascending: true });

  if (groupsError) {
    console.error("[data/subjects] 교과 그룹 조회 실패", groupsError);
    throw new Error("교과 그룹 조회에 실패했습니다.");
  }

  // 3. 과목구분 목록 조회
  const { data: subjectTypesData, error: typesError } = await supabase
    .from("subject_types")
    .select("*")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (typesError) {
    console.error("[data/subjects] 과목구분 조회 실패", typesError);
    throw new Error("과목구분 조회에 실패했습니다.");
  }

  // 데이터 변환
  type GroupWithJoin = SubjectGroup & {
    subjects?: Array<Subject & { subject_types?: { name: string } | null }>;
  };
  const groupsWithSubjects = ((groupsData || []) as GroupWithJoin[]).map((group) => ({
    ...group,
    subjects: ((group.subjects || [])).map((subject) => ({
      ...subject,
      subject_type: subject.subject_types?.name || null,
      subjectType: subject.subject_types || null,
    })),
  }));

  return {
    curriculumRevision: {
      id: revisionData.id,
      name: revisionData.name,
      year: revisionData.year,
    },
    subjectGroups: groupsWithSubjects as (SubjectGroup & {
      subjects: (Subject & { subjectType: SubjectType | null })[];
    })[],
    subjectTypes: (subjectTypesData || []) as SubjectType[],
  };
}

/**
 * 활성화된 개정교육과정 조회 (기본값으로 사용)
 * @returns 활성화된 첫 번째 개정교육과정
 */
export async function getActiveCurriculumRevision(): Promise<{
  id: string;
  name: string;
  year?: number | null;
} | null> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("curriculum_revisions")
    .select("id, name, year")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[data/subjects] 활성 개정교육과정 조회 실패", error);
    return null;
  }

  return data;
}

/**
 * 특정 과목 ID로 과목 정보 조회 (과목구분 포함)
 * @param subjectId 과목 ID
 */
export async function getSubjectById(subjectId: string): Promise<
  | (Subject & {
      subjectGroup: SubjectGroup;
      subjectType?: SubjectType | null;
    })
  | null
> {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(`
      *,
      subject_groups:subject_group_id (
        id,
        curriculum_revision_id,
        name
      ),
      subject_types:subject_type_id (
        id,
        curriculum_revision_id,
        name,
        is_active
      )
    `)
    .eq("id", subjectId)
    .maybeSingle();

  if (error) {
    console.error("[data/subjects] 과목 조회 실패", error);
    return null;
  }

  if (!data) {
    return null;
  }

  type SubjectWithJoins = Subject & {
    subject_groups?: SubjectGroup;
    subject_types?: { name: string } | null;
  };
  const dataWithJoins = data as SubjectWithJoins;
  return {
    ...dataWithJoins,
    subjectGroup: dataWithJoins.subject_groups,
    subjectType: dataWithJoins.subject_types || null,
    subject_type: dataWithJoins.subject_types?.name || null,
  } as Subject & {
    subjectGroup: SubjectGroup;
    subjectType?: SubjectType | null;
  };
}

/**
 * 특정 교과 그룹 ID로 교과 그룹 정보 조회
 * @param subjectGroupId 교과 그룹 ID
 */
export async function getSubjectGroupById(
  subjectGroupId: string
): Promise<SubjectGroup | null> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subject_groups")
    .select("*")
    .eq("id", subjectGroupId)
    .maybeSingle();

  if (error) {
    console.error("[data/subjects] 교과 그룹 조회 실패", error);
    return null;
  }

  return (data as SubjectGroup | null) ?? null;
}

