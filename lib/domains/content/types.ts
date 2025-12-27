/**
 * 커스텀 콘텐츠 타입 정의 (Phase 5: 커스텀 콘텐츠 고도화)
 */

// 범위 유형 타입
export type RangeType = 'page' | 'time' | 'chapter' | 'unit' | 'custom';

// 난이도 타입
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// 콘텐츠 상태
export type ContentStatus = 'active' | 'archived' | 'draft';

/**
 * 확장된 커스텀 콘텐츠 인터페이스
 */
export interface CustomContent {
  id: string;
  tenantId?: string | null;
  studentId: string;
  title: string;
  description?: string | null;

  // 범위 유형 및 값
  rangeType: RangeType;
  rangeStart?: number | null;
  rangeEnd?: number | null;
  rangeUnit?: string | null; // '페이지', '분', '강', '단원' 등 사용자 정의

  // 메타데이터
  subject?: string | null;
  subjectCategory?: string | null;
  difficulty?: DifficultyLevel | null;
  estimatedMinutes?: number | null;

  // 태그/분류
  tags?: string[] | null;
  color?: string | null;

  // 상태 및 설정
  status: ContentStatus;
  isTemplate?: boolean;
  templateName?: string | null;

  // 타임스탬프
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * 커스텀 콘텐츠 생성 입력
 */
export interface CustomContentInput {
  tenantId?: string | null;
  studentId: string;
  title: string;
  description?: string | null;

  // 범위 설정
  rangeType?: RangeType;
  rangeStart?: number | null;
  rangeEnd?: number | null;
  rangeUnit?: string | null;

  // 메타데이터
  subject?: string | null;
  subjectCategory?: string | null;
  difficulty?: DifficultyLevel | null;
  estimatedMinutes?: number | null;

  // 태그/분류
  tags?: string[] | null;
  color?: string | null;

  // 상태 (기본값: active)
  status?: ContentStatus;
}

/**
 * 커스텀 콘텐츠 업데이트 입력
 */
export type CustomContentUpdate = Partial<Omit<CustomContentInput, 'studentId' | 'tenantId'>>;

/**
 * 커스텀 콘텐츠 필터
 */
export interface CustomContentFilters {
  studentId?: string;
  tenantId?: string | null;
  subject?: string;
  subjectCategory?: string;
  difficulty?: DifficultyLevel;
  rangeType?: RangeType;
  tags?: string[];
  status?: ContentStatus;
  isTemplate?: boolean;
  search?: string; // 제목/설명 검색
}

/**
 * 커스텀 콘텐츠 템플릿
 */
export interface CustomContentTemplate {
  id: string;
  tenantId?: string | null;
  studentId?: string | null; // null이면 전역 템플릿
  name: string;
  description?: string | null;

  // 템플릿 설정
  defaultRangeType: RangeType;
  defaultRangeUnit?: string | null;
  defaultSubject?: string | null;
  defaultSubjectCategory?: string | null;
  defaultDifficulty?: DifficultyLevel | null;
  defaultEstimatedMinutes?: number | null;
  defaultColor?: string | null;

  // 타임스탬프
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * 템플릿 생성 입력
 */
export interface TemplateInput {
  tenantId?: string | null;
  studentId?: string | null;
  name: string;
  description?: string | null;

  // 기본값 설정
  defaultRangeType?: RangeType;
  defaultRangeUnit?: string | null;
  defaultSubject?: string | null;
  defaultSubjectCategory?: string | null;
  defaultDifficulty?: DifficultyLevel | null;
  defaultEstimatedMinutes?: number | null;
  defaultColor?: string | null;
}

/**
 * DB 스키마에서 사용하는 snake_case 타입
 */
export interface CustomContentDbRow {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  title: string;
  description?: string | null;
  range_type: string;
  range_start?: number | null;
  range_end?: number | null;
  range_unit?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  difficulty?: string | null;
  estimated_minutes?: number | null;
  tags?: string[] | null;
  color?: string | null;
  status: string;
  is_template?: boolean;
  template_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * 템플릿 DB 스키마
 */
export interface CustomContentTemplateDbRow {
  id: string;
  tenant_id?: string | null;
  student_id?: string | null;
  name: string;
  description?: string | null;
  default_range_type: string;
  default_range_unit?: string | null;
  default_subject?: string | null;
  default_subject_category?: string | null;
  default_difficulty?: string | null;
  default_estimated_minutes?: number | null;
  default_color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * DB 로우를 도메인 객체로 변환
 */
export function toCustomContent(row: CustomContentDbRow): CustomContent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    title: row.title,
    description: row.description,
    rangeType: (row.range_type as RangeType) || 'page',
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    rangeUnit: row.range_unit,
    subject: row.subject,
    subjectCategory: row.subject_category,
    difficulty: row.difficulty as DifficultyLevel | null,
    estimatedMinutes: row.estimated_minutes,
    tags: row.tags,
    color: row.color,
    status: (row.status as ContentStatus) || 'active',
    isTemplate: row.is_template,
    templateName: row.template_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 도메인 객체를 DB 로우로 변환
 */
export function toCustomContentDbRow(
  content: CustomContentInput
): Omit<CustomContentDbRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: content.tenantId ?? null,
    student_id: content.studentId,
    title: content.title,
    description: content.description ?? null,
    range_type: content.rangeType ?? 'page',
    range_start: content.rangeStart ?? null,
    range_end: content.rangeEnd ?? null,
    range_unit: content.rangeUnit ?? null,
    subject: content.subject ?? null,
    subject_category: content.subjectCategory ?? null,
    difficulty: content.difficulty ?? null,
    estimated_minutes: content.estimatedMinutes ?? null,
    tags: content.tags ?? null,
    color: content.color ?? null,
    status: content.status ?? 'active',
  };
}

/**
 * DB 로우를 템플릿 도메인 객체로 변환
 */
export function toCustomContentTemplate(row: CustomContentTemplateDbRow): CustomContentTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    name: row.name,
    description: row.description,
    defaultRangeType: (row.default_range_type as RangeType) || 'page',
    defaultRangeUnit: row.default_range_unit,
    defaultSubject: row.default_subject,
    defaultSubjectCategory: row.default_subject_category,
    defaultDifficulty: row.default_difficulty as DifficultyLevel | null,
    defaultEstimatedMinutes: row.default_estimated_minutes,
    defaultColor: row.default_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 범위 표시 문자열 생성
 */
export function formatRange(content: CustomContent): string {
  if (content.rangeStart == null && content.rangeEnd == null) {
    return '';
  }

  const unit = content.rangeUnit ?? getRangeTypeDefaultUnit(content.rangeType);

  if (content.rangeStart != null && content.rangeEnd != null) {
    if (content.rangeStart === content.rangeEnd) {
      return `${content.rangeStart}${unit}`;
    }
    return `${content.rangeStart}-${content.rangeEnd}${unit}`;
  }

  if (content.rangeStart != null) {
    return `${content.rangeStart}${unit}~`;
  }

  return `~${content.rangeEnd}${unit}`;
}

/**
 * 범위 유형별 기본 단위
 */
export function getRangeTypeDefaultUnit(rangeType: RangeType): string {
  switch (rangeType) {
    case 'page':
      return 'p';
    case 'time':
      return '분';
    case 'chapter':
      return '장';
    case 'unit':
      return '단원';
    case 'custom':
    default:
      return '';
  }
}

/**
 * 난이도 레이블
 */
export function getDifficultyLabel(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'easy':
      return '쉬움';
    case 'medium':
      return '보통';
    case 'hard':
      return '어려움';
    default:
      return '';
  }
}

/**
 * 난이도 색상
 */
export function getDifficultyColor(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'easy':
      return 'text-green-600 bg-green-100';
    case 'medium':
      return 'text-yellow-600 bg-yellow-100';
    case 'hard':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}
