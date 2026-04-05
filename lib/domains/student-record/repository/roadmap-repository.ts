// ============================================
// 로드맵 아이템(roadmap_items) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RoadmapItem, RoadmapItemInsert, RoadmapItemUpdate,
} from "../types";

// ============================================
// 10. 로드맵 (roadmap_items)
// ============================================

export async function findRoadmapItemsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RoadmapItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("grade")
    .order("semester", { nullsFirst: false })
    .order("sort_order");
  if (error) throw error;
  return (data as RoadmapItem[]) ?? [];
}

export async function findAllRoadmapItemsByStudent(
  studentId: string,
  tenantId: string,
): Promise<RoadmapItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year")
    .order("grade")
    .order("semester", { nullsFirst: false })
    .order("sort_order");
  if (error) throw error;
  return (data as RoadmapItem[]) ?? [];
}

export async function insertRoadmapItem(
  input: RoadmapItemInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_roadmap_items")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRoadmapItemById(
  id: string,
  updates: RoadmapItemUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_roadmap_items")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRoadmapItemById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_roadmap_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
