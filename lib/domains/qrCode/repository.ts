/**
 * QR Code 도메인 Repository
 *
 * 이 파일은 순수한 데이터 접근만을 담당합니다.
 * - Supabase 쿼리만 수행
 * - 비즈니스 로직 없음
 * - 에러는 상위 레이어에서 처리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QRCodeRecord } from "@/lib/services/qrCodeService";

/**
 * QR 코드 생성
 */
export async function createQRCode(
  tenantId: string,
  qrData: string,
  qrCodeUrl: string | null,
  expiresAt: Date,
  createdBy: string
): Promise<QRCodeRecord> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_qr_codes")
    .insert({
      tenant_id: tenantId,
      qr_data: qrData,
      qr_code_url: qrCodeUrl,
      is_active: true,
      expires_at: expiresAt.toISOString(),
      created_by: createdBy,
      usage_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as QRCodeRecord;
}

/**
 * 활성 QR 코드 조회
 */
export async function getActiveQRCode(
  tenantId: string
): Promise<QRCodeRecord | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_qr_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as QRCodeRecord | null;
}

/**
 * QR 코드 ID로 조회
 */
export async function getQRCodeById(
  qrCodeId: string,
  tenantId: string
): Promise<QRCodeRecord | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_qr_codes")
    .select("*")
    .eq("id", qrCodeId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data as QRCodeRecord | null;
}

/**
 * 테넌트의 모든 활성 QR 코드 비활성화
 */
export async function deactivateAllActiveQRCodes(
  tenantId: string,
  deactivatedBy: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("attendance_qr_codes")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: deactivatedBy,
    })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) throw error;
}

/**
 * 특정 QR 코드 비활성화
 */
export async function deactivateQRCode(
  qrCodeId: string,
  tenantId: string,
  deactivatedBy: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("attendance_qr_codes")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: deactivatedBy,
    })
    .eq("id", qrCodeId)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

/**
 * QR 코드 사용 통계 업데이트
 */
export async function incrementQRCodeUsage(
  qrCodeId: string,
  tenantId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 먼저 현재 값을 조회
  const { data: current, error: fetchError } = await supabase
    .from("attendance_qr_codes")
    .select("usage_count")
    .eq("id", qrCodeId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError) throw fetchError;
  if (!current) throw new Error("QR 코드를 찾을 수 없습니다.");

  // 사용 횟수 증가 및 마지막 사용 시간 업데이트
  const { error: updateError } = await supabase
    .from("attendance_qr_codes")
    .update({
      usage_count: (current.usage_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", qrCodeId)
    .eq("tenant_id", tenantId);

  if (updateError) throw updateError;
}

/**
 * QR 코드 이력 조회
 */
export async function getQRCodeHistory(
  tenantId: string,
  limit: number = 50
): Promise<QRCodeRecord[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_qr_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as QRCodeRecord[]) ?? [];
}

