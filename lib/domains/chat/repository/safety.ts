/**
 * 차단/신고 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ChatBlock,
  ChatBlockInsert,
  ChatReport,
  ChatReportInsert,
  ChatReportUpdate,
  ChatUserType,
} from "../types";

// ============================================
// 차단 Repository
// ============================================

/**
 * 차단 목록 조회
 */
export async function findBlocksByUser(
  userId: string,
  userType: ChatUserType
): Promise<ChatBlock[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .select("*")
    .eq("blocker_id", userId)
    .eq("blocker_type", userType);

  if (error) throw error;

  return (data as ChatBlock[]) ?? [];
}

/**
 * 차단 여부 확인
 */
export async function isBlocked(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocker_type", blockerType)
    .eq("blocked_id", blockedId)
    .eq("blocked_type", blockedType)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return !!data;
}

/**
 * 차단 추가
 */
export async function insertBlock(
  input: ChatBlockInsert
): Promise<ChatBlock> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatBlock;
}

/**
 * 차단 해제
 */
export async function deleteBlock(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocker_type", blockerType)
    .eq("blocked_id", blockedId)
    .eq("blocked_type", blockedType);

  if (error) throw error;
}

// ============================================
// 신고 Repository
// ============================================

/**
 * 신고 생성
 */
export async function insertReport(
  input: ChatReportInsert
): Promise<ChatReport> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatReport;
}

/**
 * 대기 중인 신고 목록 조회 (관리자용)
 */
export async function findPendingReports(
  limit = 50
): Promise<ChatReport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data as ChatReport[]) ?? [];
}

/**
 * 신고 상태 업데이트 (관리자용)
 */
export async function updateReport(
  reportId: string,
  input: ChatReportUpdate
): Promise<ChatReport> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .update(input)
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatReport;
}

/**
 * 모든 신고 목록 조회 (관리자용, 필터 지원)
 */
export async function findAllReports(
  filters?: { status?: string; reason?: string },
  limit = 100
): Promise<ChatReport[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("chat_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  // 상태 필터
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // 사유 필터
  if (filters?.reason && filters.reason !== "all") {
    query = query.eq("reason", filters.reason);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data as ChatReport[]) ?? [];
}

/**
 * 신고 ID로 조회
 */
export async function findReportById(
  reportId: string
): Promise<ChatReport | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatReport | null;
}
