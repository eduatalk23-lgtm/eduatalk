'use server';

/**
 * 커스텀 콘텐츠 CRUD 액션 (Phase 5: 커스텀 콘텐츠 고도화)
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  type CustomContent,
  type CustomContentInput,
  type CustomContentUpdate,
  type CustomContentFilters,
  type CustomContentTemplate,
  type TemplateInput,
  type CustomContentDbRow,
  type CustomContentTemplateDbRow,
  toCustomContent,
  toCustomContentDbRow,
  toCustomContentTemplate,
} from '../types';

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================================
// 커스텀 콘텐츠 CRUD
// ============================================================

/**
 * 커스텀 콘텐츠 생성
 */
export async function createCustomContent(
  input: CustomContentInput
): Promise<ActionResult<CustomContent>> {
  const supabase = await createSupabaseServerClient();

  const dbRow = toCustomContentDbRow(input);

  const { data, error } = await supabase
    .from('student_custom_contents')
    .insert(dbRow)
    .select()
    .single();

  if (error) {
    console.error('[content/custom] 커스텀 콘텐츠 생성 실패:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/contents');
  revalidatePath('/plan');

  return {
    success: true,
    data: toCustomContent(data as CustomContentDbRow),
  };
}

/**
 * 커스텀 콘텐츠 조회 (단일)
 */
export async function getCustomContent(
  contentId: string
): Promise<ActionResult<CustomContent>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('student_custom_contents')
    .select('*')
    .eq('id', contentId)
    .single();

  if (error) {
    console.error('[content/custom] 커스텀 콘텐츠 조회 실패:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: toCustomContent(data as CustomContentDbRow),
  };
}

/**
 * 커스텀 콘텐츠 목록 조회
 */
export async function listCustomContents(
  filters?: CustomContentFilters
): Promise<ActionResult<CustomContent[]>> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('student_custom_contents').select('*');

  // 필터 적용
  if (filters?.studentId) {
    query = query.eq('student_id', filters.studentId);
  }
  if (filters?.tenantId) {
    query = query.eq('tenant_id', filters.tenantId);
  }
  if (filters?.subject) {
    query = query.eq('subject', filters.subject);
  }
  if (filters?.subjectCategory) {
    query = query.eq('subject_category', filters.subjectCategory);
  }
  if (filters?.difficulty) {
    query = query.eq('difficulty_level', filters.difficulty);
  }
  if (filters?.rangeType) {
    query = query.eq('range_type', filters.rangeType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.isTemplate !== undefined) {
    query = query.eq('is_template', filters.isTemplate);
  }
  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }
  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('[content/custom] 커스텀 콘텐츠 목록 조회 실패:', error);
    return { success: false, error: error.message };
  }

  const contents = (data as CustomContentDbRow[]).map(toCustomContent);

  return { success: true, data: contents };
}

/**
 * 커스텀 콘텐츠 업데이트
 */
export async function updateCustomContent(
  contentId: string,
  updates: CustomContentUpdate
): Promise<ActionResult<CustomContent>> {
  const supabase = await createSupabaseServerClient();

  // snake_case로 변환
  const dbUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.rangeType !== undefined) dbUpdates.range_type = updates.rangeType;
  if (updates.rangeStart !== undefined) dbUpdates.range_start = updates.rangeStart;
  if (updates.rangeEnd !== undefined) dbUpdates.range_end = updates.rangeEnd;
  if (updates.rangeUnit !== undefined) dbUpdates.range_unit = updates.rangeUnit;
  if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
  if (updates.subjectCategory !== undefined) dbUpdates.subject_category = updates.subjectCategory;
  if (updates.difficulty !== undefined) dbUpdates.difficulty_level = updates.difficulty;
  if (updates.estimatedMinutes !== undefined) dbUpdates.estimated_minutes = updates.estimatedMinutes;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('student_custom_contents')
    .update(dbUpdates)
    .eq('id', contentId)
    .select()
    .single();

  if (error) {
    console.error('[content/custom] 커스텀 콘텐츠 업데이트 실패:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/contents');
  revalidatePath('/plan');

  return {
    success: true,
    data: toCustomContent(data as CustomContentDbRow),
  };
}

/**
 * 커스텀 콘텐츠 삭제
 */
export async function deleteCustomContent(
  contentId: string
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('student_custom_contents')
    .delete()
    .eq('id', contentId);

  if (error) {
    console.error('[content/custom] 커스텀 콘텐츠 삭제 실패:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/contents');
  revalidatePath('/plan');

  return { success: true };
}

/**
 * 커스텀 콘텐츠 보관 (소프트 삭제)
 */
export async function archiveCustomContent(
  contentId: string
): Promise<ActionResult<CustomContent>> {
  return updateCustomContent(contentId, { status: 'archived' });
}

/**
 * 커스텀 콘텐츠 복원
 */
export async function restoreCustomContent(
  contentId: string
): Promise<ActionResult<CustomContent>> {
  return updateCustomContent(contentId, { status: 'active' });
}

// ============================================================
// 템플릿 기능
// ============================================================

/**
 * 커스텀 콘텐츠를 템플릿으로 저장
 */
export async function saveAsTemplate(
  contentId: string,
  templateName: string
): Promise<ActionResult<CustomContentTemplate>> {
  const supabase = await createSupabaseServerClient();

  // 기존 콘텐츠 조회
  const { data: content, error: fetchError } = await supabase
    .from('student_custom_contents')
    .select('*')
    .eq('id', contentId)
    .single();

  if (fetchError || !content) {
    console.error('[content/custom] 템플릿 저장 - 콘텐츠 조회 실패:', fetchError);
    return { success: false, error: fetchError?.message || '콘텐츠를 찾을 수 없습니다.' };
  }

  const row = content as CustomContentDbRow;

  // 템플릿 생성
  const templateData = {
    tenant_id: row.tenant_id,
    student_id: row.student_id,
    name: templateName,
    description: row.description,
    default_range_type: row.range_type,
    default_range_unit: row.range_unit,
    default_subject: row.subject,
    default_subject_category: row.subject_category,
    default_difficulty: row.difficulty,
    default_estimated_minutes: row.estimated_minutes,
    default_color: row.color,
  };

  const { data: template, error: insertError } = await supabase
    .from('custom_content_templates')
    .insert(templateData)
    .select()
    .single();

  if (insertError) {
    console.error('[content/custom] 템플릿 생성 실패:', insertError);
    return { success: false, error: insertError.message };
  }

  // 원본 콘텐츠에 템플릿 참조 저장
  await supabase
    .from('student_custom_contents')
    .update({
      is_template: true,
      template_name: templateName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  revalidatePath('/contents');

  return {
    success: true,
    data: toCustomContentTemplate(template as CustomContentTemplateDbRow),
  };
}

/**
 * 템플릿에서 새 커스텀 콘텐츠 생성
 */
export async function createFromTemplate(
  templateId: string,
  studentId: string,
  overrides?: Partial<CustomContentInput>
): Promise<ActionResult<CustomContent>> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 조회
  const { data: template, error: fetchError } = await supabase
    .from('custom_content_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (fetchError || !template) {
    console.error('[content/custom] 템플릿 조회 실패:', fetchError);
    return { success: false, error: fetchError?.message || '템플릿을 찾을 수 없습니다.' };
  }

  const tpl = template as CustomContentTemplateDbRow;

  // 템플릿 기반으로 새 콘텐츠 생성
  const input: CustomContentInput = {
    tenantId: tpl.tenant_id,
    studentId,
    title: overrides?.title || `${tpl.name} (복사본)`,
    description: overrides?.description ?? tpl.description,
    rangeType: overrides?.rangeType ?? (tpl.default_range_type as CustomContentInput['rangeType']),
    rangeUnit: overrides?.rangeUnit ?? tpl.default_range_unit,
    rangeStart: overrides?.rangeStart,
    rangeEnd: overrides?.rangeEnd,
    subject: overrides?.subject ?? tpl.default_subject,
    subjectCategory: overrides?.subjectCategory ?? tpl.default_subject_category,
    difficulty: overrides?.difficulty ?? (tpl.default_difficulty as CustomContentInput['difficulty']),
    estimatedMinutes: overrides?.estimatedMinutes ?? tpl.default_estimated_minutes,
    color: overrides?.color ?? tpl.default_color,
    tags: overrides?.tags,
    status: 'active',
  };

  return createCustomContent(input);
}

/**
 * 템플릿 목록 조회
 */
export async function listTemplates(
  studentId?: string,
  tenantId?: string | null
): Promise<ActionResult<CustomContentTemplate[]>> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('custom_content_templates').select('*');

  // 학생 자신의 템플릿 + 전역 템플릿 조회
  if (studentId) {
    query = query.or(`student_id.eq.${studentId},student_id.is.null`);
  }

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('[content/custom] 템플릿 목록 조회 실패:', error);
    return { success: false, error: error.message };
  }

  const templates = (data as CustomContentTemplateDbRow[]).map(toCustomContentTemplate);

  return { success: true, data: templates };
}

/**
 * 템플릿 생성
 */
export async function createTemplate(
  input: TemplateInput
): Promise<ActionResult<CustomContentTemplate>> {
  const supabase = await createSupabaseServerClient();

  const templateData = {
    tenant_id: input.tenantId ?? null,
    student_id: input.studentId ?? null,
    name: input.name,
    description: input.description ?? null,
    default_range_type: input.defaultRangeType ?? 'page',
    default_range_unit: input.defaultRangeUnit ?? null,
    default_subject: input.defaultSubject ?? null,
    default_subject_category: input.defaultSubjectCategory ?? null,
    default_difficulty: input.defaultDifficulty ?? null,
    default_estimated_minutes: input.defaultEstimatedMinutes ?? null,
    default_color: input.defaultColor ?? null,
  };

  const { data, error } = await supabase
    .from('custom_content_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    console.error('[content/custom] 템플릿 생성 실패:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: toCustomContentTemplate(data as CustomContentTemplateDbRow),
  };
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplate(
  templateId: string
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('custom_content_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[content/custom] 템플릿 삭제 실패:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 콘텐츠 복제
 */
export async function duplicateCustomContent(
  contentId: string,
  newTitle?: string
): Promise<ActionResult<CustomContent>> {
  const result = await getCustomContent(contentId);

  if (!result.success || !result.data) {
    return { success: false, error: result.error || '콘텐츠를 찾을 수 없습니다.' };
  }

  const original = result.data;

  const input: CustomContentInput = {
    tenantId: original.tenantId,
    studentId: original.studentId,
    title: newTitle || `${original.title} (복사본)`,
    description: original.description,
    rangeType: original.rangeType,
    rangeStart: original.rangeStart,
    rangeEnd: original.rangeEnd,
    rangeUnit: original.rangeUnit,
    subject: original.subject,
    subjectCategory: original.subjectCategory,
    difficulty: original.difficulty,
    estimatedMinutes: original.estimatedMinutes,
    tags: original.tags,
    color: original.color,
    status: 'active',
  };

  return createCustomContent(input);
}

/**
 * 일괄 상태 변경
 */
export async function bulkUpdateStatus(
  contentIds: string[],
  status: 'active' | 'archived' | 'draft'
): Promise<ActionResult<number>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('student_custom_contents')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .in('id', contentIds)
    .select('id');

  if (error) {
    console.error('[content/custom] 일괄 상태 변경 실패:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/contents');

  return { success: true, data: data?.length || 0 };
}

/**
 * 태그로 콘텐츠 검색
 */
export async function searchByTags(
  studentId: string,
  tags: string[]
): Promise<ActionResult<CustomContent[]>> {
  return listCustomContents({
    studentId,
    tags,
    status: 'active',
  });
}
