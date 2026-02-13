import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";

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
  is_achievement_only: boolean; // 성취평가제 전용 과목구분 여부
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
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  return await createTypedQuery<SubjectGroup[]>(
    async () => {
      let query = supabase
        .from("subject_groups")
        .select("*");

      if (curriculumRevisionId) {
        query = query.eq("curriculum_revision_id", curriculumRevisionId);
      }

      const queryResult = await query.order("name", { ascending: true });
      return {
        data: queryResult.data as SubjectGroup[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectGroups",
      defaultValue: [],
    }
  ) ?? [];
}

/**
 * 과목구분 목록 조회 (개정교육과정별)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항, 없으면 모든 개정교육과정의 과목구분 조회)
 */
export async function getSubjectTypes(
  curriculumRevisionId?: string
): Promise<SubjectType[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  return await createTypedQuery<SubjectType[]>(
    async () => {
      let query = supabase
        .from("subject_types")
        .select("*")
        .eq("is_active", true);

      if (curriculumRevisionId) {
        query = query.eq("curriculum_revision_id", curriculumRevisionId);
      }

      const queryResult = await query.order("name", { ascending: true });
      return {
        data: queryResult.data as SubjectType[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectTypes",
      defaultValue: [],
    }
  ) ?? [];
}

/**
 * 특정 교과 그룹에 속한 과목 목록 조회 (전역 관리)
 * 과목구분 정보도 함께 조회
 */
export async function getSubjectsByGroup(
  subjectGroupId: string
): Promise<Subject[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  type SubjectWithJoin = Subject & {
    subject_types?: { name: string } | null;
  };

  const result = await createTypedQuery<SubjectWithJoin[]>(
    async () => {
      const queryResult = await supabase
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

      return {
        data: queryResult.data as SubjectWithJoin[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectsByGroup",
      defaultValue: [],
    }
  );

  // JOIN 결과를 평탄화
  return (result ?? []).map((subject) => ({
    ...subject,
    subject_type: subject.subject_types?.name || null,
  })) as Subject[];
}

/**
 * 개정교육과정 ID로 모든 과목을 한 번에 조회 (성능 최적화)
 * @param curriculumRevisionId 개정교육과정 ID (필수)
 * @returns 과목 목록 (subject_group_id 포함)
 */
export async function getSubjectsByRevision(
  curriculumRevisionId: string
): Promise<Subject[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  // 1. 먼저 해당 개정교육과정의 교과 그룹 ID 목록 조회
  const groups = await createTypedQuery<{ id: string }[]>(
    async () => {
      const queryResult = await supabase
        .from("subject_groups")
        .select("id")
        .eq("curriculum_revision_id", curriculumRevisionId);
      return {
        data: queryResult.data as { id: string }[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectsByRevision (교과 그룹 조회)",
      defaultValue: [],
    }
  );

  if (!groups || groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);

  // 2. 해당 교과 그룹에 속한 모든 과목 조회 (JOIN 사용)
  type SubjectWithJoin = Subject & {
    subject_types?: { name: string } | null;
  };

  const result = await createTypedQuery<SubjectWithJoin[]>(
    async () => {
      const queryResult = await supabase
        .from("subjects")
        .select(`
          *,
          subject_types:subject_type_id (
            id,
            name
          )
        `)
        .in("subject_group_id", groupIds)
        .order("name", { ascending: true });

      return {
        data: queryResult.data as SubjectWithJoin[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectsByRevision (과목 조회)",
      defaultValue: [],
    }
  );

  // JOIN 결과를 평탄화
  return (result ?? []).map((subject) => ({
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

  const groupData = await createTypedSingleQuery<{ id: string }>(
    async () => {
      const queryResult = await query;
      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectsByGroupName",
      defaultValue: null,
    }
  );

  if (!groupData) {
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

  const revisionData = await createTypedSingleQuery<{
    id: string;
    name: string;
    year?: number | null;
  }>(
    async () => {
      const queryResult = await revisionQuery;
      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getFullSubjectHierarchy",
      defaultValue: null,
    }
  );

  if (!revisionData) {
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
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  // 1. 개정교육과정 조회
  const revisionData = await createTypedSingleQuery<{
    id: string;
    name: string;
    year?: number | null;
  }>(
    async () => {
      const queryResult = await supabase
        .from("curriculum_revisions")
        .select("*")
        .eq("id", curriculumRevisionId)
        .single();
      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectHierarchyOptimized",
      defaultValue: null,
    }
  );

  if (!revisionData) {
    throw new Error("개정교육과정을 찾을 수 없습니다.");
  }

  // 2. 교과 + 과목 + 과목구분 한 번에 조회 (JOIN)
  type GroupWithJoin = SubjectGroup & {
    subjects?: Array<Subject & { subject_types?: { name: string } | null }>;
  };

  const groupsData = await createTypedQuery<GroupWithJoin[]>(
    async () => {
      const queryResult = await supabase
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

      return {
        data: queryResult.data as GroupWithJoin[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectHierarchyOptimized (교과 그룹 조회)",
      defaultValue: [],
    }
  );

  if (!groupsData) {
    throw new Error("교과 그룹 조회에 실패했습니다.");
  }

  // 3. 과목구분 목록 조회
  const subjectTypesData = await createTypedQuery<SubjectType[]>(
    async () => {
      const queryResult = await supabase
        .from("subject_types")
        .select("*")
        .eq("curriculum_revision_id", curriculumRevisionId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      return {
        data: queryResult.data as SubjectType[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectHierarchyOptimized (과목구분 조회)",
      defaultValue: [],
    }
  );

  if (!subjectTypesData) {
    throw new Error("과목구분 조회에 실패했습니다.");
  }

  // 데이터 변환
  const groupsWithSubjects = (groupsData ?? []).map((group) => ({
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
    subjectTypes: subjectTypesData ?? [],
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
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  return await createTypedSingleQuery<{
    id: string;
    name: string;
    year?: number | null;
  }>(
    async () => {
      const queryResult = await supabase
        .from("curriculum_revisions")
        .select("id, name, year")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(1);

      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getActiveCurriculumRevision",
      defaultValue: null,
    }
  );
}

export type CurriculumRevisionInfo = {
  id: string;
  name: string;
  year: number | null;
};

/**
 * 모든 활성화된 개정교육과정 조회 (최신순)
 */
export async function getAllActiveCurriculumRevisions(): Promise<CurriculumRevisionInfo[]> {
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("curriculum_revisions")
    .select("id, name, year")
    .eq("is_active", true)
    .order("year", { ascending: false, nullsFirst: false });

  if (error) {
    handleQueryError(error, { context: "[data/subjects] getAllActiveCurriculumRevisions" });
    return [];
  }

  return (data ?? []) as CurriculumRevisionInfo[];
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
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  type SubjectWithJoins = Subject & {
    subject_groups?: SubjectGroup;
    subject_types?: { name: string } | null;
  };

  const data = await createTypedSingleQuery<SubjectWithJoins>(
    async () => {
      const queryResult = await supabase
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
        .eq("id", subjectId);

      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectById",
      defaultValue: null,
    }
  );

  if (!data) {
    return null;
  }

  return {
    ...data,
    subjectGroup: data.subject_groups,
    subjectType: data.subject_types || null,
    subject_type: data.subject_types?.name || null,
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
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  return await createTypedSingleQuery<SubjectGroup>(
    async () => {
      const queryResult = await supabase
        .from("subject_groups")
        .select("*")
        .eq("id", subjectGroupId);

      return {
        data: queryResult.data ? (Array.isArray(queryResult.data) ? queryResult.data : [queryResult.data]) : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/subjects] getSubjectGroupById",
      defaultValue: null,
    }
  );
}

