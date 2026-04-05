// ============================================
// 스토리라인(storylines) + 스토리라인 링크(storyline_links) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Storyline, StorylineInsert, StorylineUpdate,
  StorylineLink, StorylineLinkInsert,
} from "../types";

// ============================================
// 8. 스토리라인 (storylines)
// ============================================

export async function findStorylinesByStudent(
  studentId: string,
  tenantId: string,
): Promise<Storyline[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("sort_order");
  if (error) throw error;
  return (data as Storyline[]) ?? [];
}

export async function insertStoryline(
  input: StorylineInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateStorylineById(
  id: string,
  updates: StorylineUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStorylineById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 9. 스토리라인 링크 (storyline_links)
// ============================================

export async function findStorylineLinksByStoryline(
  storylineId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .eq("storyline_id", storylineId)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function findAllStorylineLinksByStudent(
  studentId: string,
  tenantId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  // Join through storylines to get all links for a student
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);
  if (!storylines || storylines.length === 0) return [];

  const storylineIds = storylines.map(s => s.id);
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .in("storyline_id", storylineIds)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function insertStorylineLink(
  input: StorylineLinkInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteStorylineLinkById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storyline_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
