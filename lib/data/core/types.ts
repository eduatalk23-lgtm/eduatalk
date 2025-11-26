/**
 * 공통 타입 정의
 */

import type { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 서버 클라이언트 타입
 */
export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 기본 엔티티 타입
 */
export interface BaseEntity {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Soft Delete를 지원하는 엔티티 타입
 */
export interface SoftDeletableEntity extends BaseEntity {
  deleted_at?: string | null;
}

/**
 * Tenant를 가진 엔티티 타입
 */
export interface TenantEntity extends BaseEntity {
  tenant_id?: string | null;
}

/**
 * 쿼리 필터 기본 타입
 */
export interface BaseFilters {
  tenantId?: string | null;
  includeDeleted?: boolean;
}

/**
 * 페이지네이션 옵션
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

/**
 * 정렬 옵션
 */
export interface SortOptions {
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * 쿼리 결과 타입
 */
export interface QueryResult<T> {
  data: T | null;
  error: unknown;
}

/**
 * 목록 조회 결과 타입
 */
export interface ListResult<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

