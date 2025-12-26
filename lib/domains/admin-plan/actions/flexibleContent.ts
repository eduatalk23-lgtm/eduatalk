'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import type {
  FlexibleContent,
  FlexibleContentInsert,
  FlexibleContentUpdate,
  FlexibleContentFilters,
  AdminPlanResponse,
  PaginatedResponse,
  SortOption,
} from '../types';

/**
 * 유연한 콘텐츠 목록 조회
 */
export async function getFlexibleContents(
  filters?: FlexibleContentFilters,
  sort?: SortOption,
  page = 1,
  pageSize = 20
): Promise<AdminPlanResponse<PaginatedResponse<FlexibleContent>>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('flexible_contents')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId); // tenant 격리

    // 필터 적용
    if (filters?.content_type) {
      query = query.eq('content_type', filters.content_type);
    }
    if (filters?.subject_area) {
      query = query.eq('subject_area', filters.subject_area);
    }
    if (filters?.subject) {
      query = query.eq('subject', filters.subject);
    }
    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }
    if (filters?.has_master_content !== undefined) {
      if (filters.has_master_content) {
        query = query.or(
          'master_book_id.not.is.null,master_lecture_id.not.is.null,master_custom_content_id.not.is.null'
        );
      } else {
        query = query
          .is('master_book_id', null)
          .is('master_lecture_id', null)
          .is('master_custom_content_id', null);
      }
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    // 정렬 적용
    const sortField = sort?.field ?? 'created_at';
    const sortDirection = sort?.direction === 'asc';
    query = query.order(sortField, { ascending: sortDirection });

    // 페이지네이션 적용
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        data: data as FlexibleContent[],
        total: count ?? 0,
        page,
        page_size: pageSize,
        has_more: count ? from + pageSize < count : false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 유연한 콘텐츠 단일 조회
 */
export async function getFlexibleContent(
  id: string
): Promise<AdminPlanResponse<FlexibleContent>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('flexible_contents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId) // tenant 격리
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as FlexibleContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 유연한 콘텐츠 생성
 */
export async function createFlexibleContent(
  input: FlexibleContentInsert
): Promise<AdminPlanResponse<FlexibleContent>> {
  try {
    // 인증 검증 (tenant_id는 input에서 제공)
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('flexible_contents')
      .insert(input)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');

    return { success: true, data: data as FlexibleContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 유연한 콘텐츠 수정
 */
export async function updateFlexibleContent(
  id: string,
  input: FlexibleContentUpdate
): Promise<AdminPlanResponse<FlexibleContent>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('flexible_contents')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId) // tenant 격리
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');

    return { success: true, data: data as FlexibleContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 유연한 콘텐츠 삭제
 */
export async function deleteFlexibleContent(
  id: string
): Promise<AdminPlanResponse<void>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('flexible_contents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId); // tenant 격리

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 마스터 콘텐츠 연결
 */
export async function linkMasterContent(
  flexibleContentId: string,
  masterContentType: 'book' | 'lecture' | 'custom',
  masterContentId: string
): Promise<AdminPlanResponse<FlexibleContent>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const updateData: FlexibleContentUpdate = {
      master_book_id: null,
      master_lecture_id: null,
      master_custom_content_id: null,
    };

    switch (masterContentType) {
      case 'book':
        updateData.master_book_id = masterContentId;
        break;
      case 'lecture':
        updateData.master_lecture_id = masterContentId;
        break;
      case 'custom':
        updateData.master_custom_content_id = masterContentId;
        break;
    }

    const { data, error } = await supabase
      .from('flexible_contents')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', flexibleContentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');

    return { success: true, data: data as FlexibleContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 마스터 콘텐츠 연결 해제
 */
export async function unlinkMasterContent(
  flexibleContentId: string
): Promise<AdminPlanResponse<FlexibleContent>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('flexible_contents')
      .update({
        master_book_id: null,
        master_lecture_id: null,
        master_custom_content_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', flexibleContentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');

    return { success: true, data: data as FlexibleContent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
