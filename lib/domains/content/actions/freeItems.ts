'use server';

/**
 * 자유 학습 아이템 CRUD 액션
 * flexible_contents 테이블을 사용하여 자유로운 학습 아이템 관리
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import {
  FreeLearningItem,
  FreeLearningItemInput,
  FreeLearningItemUpdate,
  FreeLearningItemFilters,
  FreeLearningItemDbRow,
  toFreeLearningItem,
  toFreeLearningItemDbRow,
} from '../types';

// ============================================================
// 타입 정의
// ============================================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 조회 액션
// ============================================================

/**
 * 자유 학습 아이템 목록 조회
 */
export async function getFreeLearningItems(
  filters: FreeLearningItemFilters = {}
): Promise<ActionResult<FreeLearningItem[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    let query = supabase
      .from('flexible_contents')
      .select('*')
      .eq('content_type', 'free');

    // 학생 필터
    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    // 테넌트 필터
    if (filters.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }

    // 아이템 타입 필터
    if (filters.itemType) {
      query = query.eq('item_type', filters.itemType);
    }

    // 과목 필터
    if (filters.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    // 템플릿 필터
    if (filters.isTemplate !== undefined) {
      query = query.eq('is_template', filters.isTemplate);
    }

    // 아카이브 필터 (기본: 아카이브되지 않은 것만)
    if (filters.isArchived !== undefined) {
      query = query.eq('is_archived', filters.isArchived);
    } else {
      query = query.eq('is_archived', false);
    }

    // 태그 필터 (배열 겹침 검사)
    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // 검색어 필터
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    // 정렬
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[getFreeLearningItems] Query error:', error);
      return { success: false, error: '목록을 불러오는데 실패했습니다.' };
    }

    const items = (data as FreeLearningItemDbRow[]).map(toFreeLearningItem);

    return { success: true, data: items };
  } catch (error) {
    console.error('[getFreeLearningItems] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 자유 학습 아이템 단건 조회
 */
export async function getFreeLearningItem(
  id: string
): Promise<ActionResult<FreeLearningItem>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    const { data, error } = await supabase
      .from('flexible_contents')
      .select('*')
      .eq('id', id)
      .eq('content_type', 'free')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: '아이템을 찾을 수 없습니다.' };
      }
      console.error('[getFreeLearningItem] Query error:', error);
      return { success: false, error: '조회에 실패했습니다.' };
    }

    return { success: true, data: toFreeLearningItem(data as FreeLearningItemDbRow) };
  } catch (error) {
    console.error('[getFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 최근 사용한 자유 학습 아이템 조회
 */
export async function getRecentFreeLearningItems(
  studentId: string,
  limit: number = 5
): Promise<ActionResult<FreeLearningItem[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    const { data, error } = await supabase
      .from('flexible_contents')
      .select('*')
      .eq('student_id', studentId)
      .eq('content_type', 'free')
      .eq('is_archived', false)
      .eq('is_template', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[getRecentFreeLearningItems] Query error:', error);
      return { success: false, error: '최근 항목을 불러오는데 실패했습니다.' };
    }

    const items = (data as FreeLearningItemDbRow[]).map(toFreeLearningItem);

    return { success: true, data: items };
  } catch (error) {
    console.error('[getRecentFreeLearningItems] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 템플릿 목록 조회
 */
export async function getFreeLearningTemplates(
  tenantId: string,
  studentId?: string
): Promise<ActionResult<FreeLearningItem[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    let query = supabase
      .from('flexible_contents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('content_type', 'free')
      .eq('is_template', true)
      .eq('is_archived', false);

    // 학생 ID가 있으면 본인 템플릿 + 전역 템플릿
    if (studentId) {
      query = query.or(`student_id.eq.${studentId},student_id.is.null`);
    }

    query = query.order('title', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[getFreeLearningTemplates] Query error:', error);
      return { success: false, error: '템플릿 목록을 불러오는데 실패했습니다.' };
    }

    const items = (data as FreeLearningItemDbRow[]).map(toFreeLearningItem);

    return { success: true, data: items };
  } catch (error) {
    console.error('[getFreeLearningTemplates] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ============================================================
// 생성 액션
// ============================================================

/**
 * 자유 학습 아이템 생성
 */
export async function createFreeLearningItem(
  input: FreeLearningItemInput
): Promise<ActionResult<FreeLearningItem>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    // 입력 검증
    if (!input.title.trim()) {
      return { success: false, error: '제목을 입력해주세요.' };
    }

    const dbRow = toFreeLearningItemDbRow(input);

    // created_by 설정
    dbRow.created_by = user.userId;

    const { data, error } = await supabase
      .from('flexible_contents')
      .insert(dbRow)
      .select()
      .single();

    if (error) {
      console.error('[createFreeLearningItem] Insert error:', error);
      return { success: false, error: '생성에 실패했습니다.' };
    }

    revalidatePath('/plan/calendar');
    revalidatePath('/today');

    return { success: true, data: toFreeLearningItem(data as FreeLearningItemDbRow) };
  } catch (error) {
    console.error('[createFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 빠른 자유 학습 아이템 생성 (제목만으로)
 */
export async function createQuickFreeLearningItem(
  tenantId: string,
  studentId: string,
  title: string,
  itemType: FreeLearningItemInput['itemType'] = 'free'
): Promise<ActionResult<FreeLearningItem>> {
  return createFreeLearningItem({
    tenantId,
    studentId,
    title,
    itemType,
  });
}

/**
 * 템플릿에서 자유 학습 아이템 생성
 */
export async function createFromTemplate(
  templateId: string,
  tenantId: string,
  studentId: string,
  overrides?: Partial<FreeLearningItemInput>
): Promise<ActionResult<FreeLearningItem>> {
  try {
    // 템플릿 조회
    const templateResult = await getFreeLearningItem(templateId);

    if (!templateResult.success || !templateResult.data) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    const template = templateResult.data;

    // 새 아이템 생성 (템플릿 속성 복사)
    const input: FreeLearningItemInput = {
      tenantId,
      studentId,
      title: overrides?.title ?? template.title,
      description: overrides?.description ?? template.description,
      itemType: overrides?.itemType ?? template.itemType,
      subjectId: overrides?.subjectId ?? template.subjectId,
      subject: overrides?.subject ?? template.subject,
      subjectArea: overrides?.subjectArea ?? template.subjectArea,
      rangeType: overrides?.rangeType ?? template.rangeType,
      rangeStart: overrides?.rangeStart ?? template.rangeStart,
      rangeEnd: overrides?.rangeEnd ?? template.rangeEnd,
      rangeUnit: overrides?.rangeUnit ?? template.rangeUnit,
      totalVolume: overrides?.totalVolume ?? template.totalVolume,
      icon: overrides?.icon ?? template.icon,
      color: overrides?.color ?? template.color,
      tags: overrides?.tags ?? template.tags,
      estimatedMinutes: overrides?.estimatedMinutes ?? template.estimatedMinutes,
      isTemplate: false, // 템플릿에서 생성된 아이템은 템플릿이 아님
    };

    return createFreeLearningItem(input);
  } catch (error) {
    console.error('[createFromTemplate] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ============================================================
// 수정 액션
// ============================================================

/**
 * 자유 학습 아이템 수정
 */
export async function updateFreeLearningItem(
  id: string,
  update: FreeLearningItemUpdate
): Promise<ActionResult<FreeLearningItem>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    // snake_case로 변환
    const dbUpdate: Record<string, unknown> = {};

    if (update.title !== undefined) dbUpdate.title = update.title;
    if (update.description !== undefined) dbUpdate.description = update.description;
    if (update.itemType !== undefined) dbUpdate.item_type = update.itemType;
    if (update.subjectId !== undefined) dbUpdate.subject_id = update.subjectId;
    if (update.subject !== undefined) dbUpdate.subject = update.subject;
    if (update.subjectArea !== undefined) dbUpdate.subject_area = update.subjectArea;
    if (update.rangeType !== undefined) dbUpdate.range_type = update.rangeType;
    if (update.rangeStart !== undefined) dbUpdate.range_start = update.rangeStart;
    if (update.rangeEnd !== undefined) dbUpdate.range_end = update.rangeEnd;
    if (update.rangeUnit !== undefined) dbUpdate.range_unit = update.rangeUnit;
    if (update.totalVolume !== undefined) dbUpdate.total_volume = update.totalVolume;
    if (update.icon !== undefined) dbUpdate.icon = update.icon;
    if (update.color !== undefined) dbUpdate.color = update.color;
    if (update.tags !== undefined) dbUpdate.tags = update.tags;
    if (update.estimatedMinutes !== undefined)
      dbUpdate.estimated_minutes = update.estimatedMinutes;
    if (update.isTemplate !== undefined) dbUpdate.is_template = update.isTemplate;

    dbUpdate.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('flexible_contents')
      .update(dbUpdate)
      .eq('id', id)
      .eq('content_type', 'free')
      .select()
      .single();

    if (error) {
      console.error('[updateFreeLearningItem] Update error:', error);
      return { success: false, error: '수정에 실패했습니다.' };
    }

    revalidatePath('/plan/calendar');
    revalidatePath('/today');

    return { success: true, data: toFreeLearningItem(data as FreeLearningItemDbRow) };
  } catch (error) {
    console.error('[updateFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 템플릿으로 저장
 */
export async function saveAsTemplate(
  id: string,
  templateName?: string
): Promise<ActionResult<FreeLearningItem>> {
  try {
    // 기존 아이템 조회
    const itemResult = await getFreeLearningItem(id);

    if (!itemResult.success || !itemResult.data) {
      return { success: false, error: '아이템을 찾을 수 없습니다.' };
    }

    const item = itemResult.data;

    // 템플릿으로 저장 (새 아이템 생성)
    const input: FreeLearningItemInput = {
      tenantId: item.tenantId,
      studentId: item.studentId,
      title: templateName ?? `${item.title} (템플릿)`,
      description: item.description,
      itemType: item.itemType,
      subjectId: item.subjectId,
      subject: item.subject,
      subjectArea: item.subjectArea,
      rangeType: item.rangeType,
      rangeStart: item.rangeStart,
      rangeEnd: item.rangeEnd,
      rangeUnit: item.rangeUnit,
      totalVolume: item.totalVolume,
      icon: item.icon,
      color: item.color,
      tags: item.tags,
      estimatedMinutes: item.estimatedMinutes,
      isTemplate: true,
    };

    return createFreeLearningItem(input);
  } catch (error) {
    console.error('[saveAsTemplate] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

// ============================================================
// 삭제/아카이브 액션
// ============================================================

/**
 * 자유 학습 아이템 아카이브 (소프트 삭제)
 */
export async function archiveFreeLearningItem(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    const { error } = await supabase
      .from('flexible_contents')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('content_type', 'free');

    if (error) {
      console.error('[archiveFreeLearningItem] Archive error:', error);
      return { success: false, error: '아카이브에 실패했습니다.' };
    }

    revalidatePath('/plan/calendar');
    revalidatePath('/today');

    return { success: true };
  } catch (error) {
    console.error('[archiveFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 자유 학습 아이템 복원
 */
export async function restoreFreeLearningItem(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    const { error } = await supabase
      .from('flexible_contents')
      .update({
        is_archived: false,
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('content_type', 'free');

    if (error) {
      console.error('[restoreFreeLearningItem] Restore error:', error);
      return { success: false, error: '복원에 실패했습니다.' };
    }

    revalidatePath('/plan/calendar');
    revalidatePath('/today');

    return { success: true };
  } catch (error) {
    console.error('[restoreFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 자유 학습 아이템 영구 삭제
 */
export async function deleteFreeLearningItem(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증이 필요합니다.' };
    }

    const { error } = await supabase
      .from('flexible_contents')
      .delete()
      .eq('id', id)
      .eq('content_type', 'free');

    if (error) {
      console.error('[deleteFreeLearningItem] Delete error:', error);
      return { success: false, error: '삭제에 실패했습니다.' };
    }

    revalidatePath('/plan/calendar');
    revalidatePath('/today');

    return { success: true };
  } catch (error) {
    console.error('[deleteFreeLearningItem] Error:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

