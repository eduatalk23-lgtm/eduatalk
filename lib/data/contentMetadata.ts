// 콘텐츠 메타데이터 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// ============================================
// 개정교육과정
// ============================================

export type CurriculumRevision = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getCurriculumRevisions(): Promise<CurriculumRevision[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_revisions")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/contentMetadata] 개정교육과정 조회 실패", error);
    return [];
  }

  return (data as CurriculumRevision[]) ?? [];
}

export async function createCurriculumRevision(
  name: string,
  display_order: number
): Promise<CurriculumRevision> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_revisions")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 개정교육과정 생성 실패", error);
    throw new Error(error.message || "개정교육과정 생성에 실패했습니다.");
  }

  return data as CurriculumRevision;
}

export async function updateCurriculumRevision(
  id: string,
  updates: Partial<Pick<CurriculumRevision, "name" | "display_order" | "is_active">>
): Promise<CurriculumRevision> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_revisions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 개정교육과정 수정 실패", error);
    throw new Error(error.message || "개정교육과정 수정에 실패했습니다.");
  }

  return data as CurriculumRevision;
}

export async function deleteCurriculumRevision(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("curriculum_revisions").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 개정교육과정 삭제 실패", error);
    throw new Error(error.message || "개정교육과정 삭제에 실패했습니다.");
  }
}

// ============================================
// 학년
// ============================================

export type Grade = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getGrades(): Promise<Grade[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grades")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/contentMetadata] 학년 조회 실패", error);
    return [];
  }

  return (data as Grade[]) ?? [];
}

export async function createGrade(name: string, display_order: number): Promise<Grade> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grades")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 학년 생성 실패", error);
    throw new Error(error.message || "학년 생성에 실패했습니다.");
  }

  return data as Grade;
}

export async function updateGrade(
  id: string,
  updates: Partial<Pick<Grade, "name" | "display_order" | "is_active">>
): Promise<Grade> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 학년 수정 실패", error);
    throw new Error(error.message || "학년 수정에 실패했습니다.");
  }

  return data as Grade;
}

export async function deleteGrade(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("grades").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 학년 삭제 실패", error);
    throw new Error(error.message || "학년 삭제에 실패했습니다.");
  }
}

// ============================================
// 학기
// ============================================

export type Semester = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getSemesters(): Promise<Semester[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("semesters")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/contentMetadata] 학기 조회 실패", error);
    return [];
  }

  return (data as Semester[]) ?? [];
}

export async function createSemester(name: string, display_order: number): Promise<Semester> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("semesters")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 학기 생성 실패", error);
    throw new Error(error.message || "학기 생성에 실패했습니다.");
  }

  return data as Semester;
}

export async function updateSemester(
  id: string,
  updates: Partial<Pick<Semester, "name" | "display_order" | "is_active">>
): Promise<Semester> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("semesters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 학기 수정 실패", error);
    throw new Error(error.message || "학기 수정에 실패했습니다.");
  }

  return data as Semester;
}

export async function deleteSemester(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("semesters").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 학기 삭제 실패", error);
    throw new Error(error.message || "학기 삭제에 실패했습니다.");
  }
}

// ============================================
// 교과
// ============================================

export type SubjectCategory = {
  id: string;
  revision_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  revision?: CurriculumRevision;
};

export async function getSubjectCategories(
  revisionId?: string
): Promise<SubjectCategory[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("subject_categories")
    .select("*, revision:curriculum_revisions(*)")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (revisionId) {
    query = query.eq("revision_id", revisionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[data/contentMetadata] 교과 조회 실패", error);
    return [];
  }

  return (data as SubjectCategory[]) ?? [];
}

export async function createSubjectCategory(
  revision_id: string,
  name: string,
  display_order: number
): Promise<SubjectCategory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subject_categories")
    .insert({ revision_id, name, display_order })
    .select("*, revision:curriculum_revisions(*)")
    .single();

  if (error) {
    console.error("[data/contentMetadata] 교과 생성 실패", error);
    throw new Error(error.message || "교과 생성에 실패했습니다.");
  }

  return data as SubjectCategory;
}

export async function updateSubjectCategory(
  id: string,
  updates: Partial<Pick<SubjectCategory, "name" | "display_order" | "is_active">>
): Promise<SubjectCategory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subject_categories")
    .update(updates)
    .eq("id", id)
    .select("*, revision:curriculum_revisions(*)")
    .single();

  if (error) {
    console.error("[data/contentMetadata] 교과 수정 실패", error);
    throw new Error(error.message || "교과 수정에 실패했습니다.");
  }

  return data as SubjectCategory;
}

export async function deleteSubjectCategory(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("subject_categories").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 교과 삭제 실패", error);
    throw new Error(error.message || "교과 삭제에 실패했습니다.");
  }
}

// ============================================
// 과목
// ============================================

export type Subject = {
  id: string;
  subject_category_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  subject_category?: SubjectCategory;
};

export async function getSubjects(
  subjectCategoryId?: string
): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_subjects")
    .select("*, subject_category:subject_categories(*)")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (subjectCategoryId) {
    query = query.eq("subject_category_id", subjectCategoryId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[data/contentMetadata] 과목 조회 실패", error);
    return [];
  }

  return (data as Subject[]) ?? [];
}

export async function createSubject(
  subject_category_id: string,
  name: string,
  display_order: number
): Promise<Subject> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_subjects")
    .insert({ subject_category_id, name, display_order })
    .select("*, subject_category:subject_categories(*)")
    .single();

  if (error) {
    console.error("[data/contentMetadata] 과목 생성 실패", error);
    throw new Error(error.message || "과목 생성에 실패했습니다.");
  }

  return data as Subject;
}

export async function updateSubject(
  id: string,
  updates: Partial<Pick<Subject, "name" | "display_order" | "is_active">>
): Promise<Subject> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_subjects")
    .update(updates)
    .eq("id", id)
    .select("*, subject_category:subject_categories(*)")
    .single();

  if (error) {
    console.error("[data/contentMetadata] 과목 수정 실패", error);
    throw new Error(error.message || "과목 수정에 실패했습니다.");
  }

  return data as Subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_subjects").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 과목 삭제 실패", error);
    throw new Error(error.message || "과목 삭제에 실패했습니다.");
  }
}

// ============================================
// 플랫폼
// ============================================

export type Platform = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getPlatforms(): Promise<Platform[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platforms")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/contentMetadata] 플랫폼 조회 실패", error);
    return [];
  }

  return (data as Platform[]) ?? [];
}

export async function createPlatform(name: string, display_order: number): Promise<Platform> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platforms")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 플랫폼 생성 실패", error);
    throw new Error(error.message || "플랫폼 생성에 실패했습니다.");
  }

  return data as Platform;
}

export async function updatePlatform(
  id: string,
  updates: Partial<Pick<Platform, "name" | "display_order" | "is_active">>
): Promise<Platform> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platforms")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 플랫폼 수정 실패", error);
    throw new Error(error.message || "플랫폼 수정에 실패했습니다.");
  }

  return data as Platform;
}

export async function deletePlatform(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("platforms").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 플랫폼 삭제 실패", error);
    throw new Error(error.message || "플랫폼 삭제에 실패했습니다.");
  }
}

// ============================================
// 출판사
// ============================================

export type Publisher = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getPublishers(): Promise<Publisher[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/contentMetadata] 출판사 조회 실패", error);
    return [];
  }

  return (data as Publisher[]) ?? [];
}

export async function createPublisher(name: string, display_order: number): Promise<Publisher> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publishers")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 출판사 생성 실패", error);
    throw new Error(error.message || "출판사 생성에 실패했습니다.");
  }

  return data as Publisher;
}

export async function updatePublisher(
  id: string,
  updates: Partial<Pick<Publisher, "name" | "display_order" | "is_active">>
): Promise<Publisher> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publishers")
    .update(updates)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMetadata] 출판사 수정 실패", error);
    throw new Error(error.message || "출판사 수정에 실패했습니다.");
  }

  return data as Publisher;
}

export async function deletePublisher(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("publishers").delete().eq("id", id);

  if (error) {
    console.error("[data/contentMetadata] 출판사 삭제 실패", error);
    throw new Error(error.message || "출판사 삭제에 실패했습니다.");
  }
}

