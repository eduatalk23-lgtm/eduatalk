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

// ============================================================
// 자유 학습 아이템 (Free Learning Items)
// ============================================================

/**
 * 자유 학습 아이템 유형
 * - free: 자유 학습 (기본)
 * - review: 복습
 * - practice: 연습/문제풀이
 * - reading: 독서/읽기
 * - video: 영상 시청
 * - assignment: 과제/숙제
 * - custom: 사용자 정의
 */
export type FreeLearningItemType =
  | 'free'
  | 'review'
  | 'practice'
  | 'reading'
  | 'video'
  | 'assignment'
  | 'custom';

/**
 * 자유 학습 아이템 아이콘 매핑
 */
export const FREE_LEARNING_ITEM_ICONS: Record<FreeLearningItemType, string> = {
  free: 'Sparkles',
  review: 'RotateCcw',
  practice: 'PencilLine',
  reading: 'BookOpen',
  video: 'Play',
  assignment: 'ClipboardList',
  custom: 'Layers',
};

/**
 * 자유 학습 아이템 레이블
 */
export const FREE_LEARNING_ITEM_LABELS: Record<FreeLearningItemType, string> = {
  free: '자유 학습',
  review: '복습',
  practice: '연습',
  reading: '독서',
  video: '영상',
  assignment: '과제',
  custom: '사용자 정의',
};

/**
 * 자유 학습 아이템 기본 색상
 */
export const FREE_LEARNING_ITEM_COLORS: Record<FreeLearningItemType, string> = {
  free: '#6366F1', // indigo
  review: '#10B981', // emerald
  practice: '#F59E0B', // amber
  reading: '#8B5CF6', // violet
  video: '#EF4444', // red
  assignment: '#3B82F6', // blue
  custom: '#6B7280', // gray
};

/**
 * 자유 학습 아이템 인터페이스
 * flexible_contents 테이블 기반
 */
export interface FreeLearningItem {
  id: string;
  tenantId: string;
  studentId: string | null;

  // 기본 정보
  title: string;
  description: string | null;
  itemType: FreeLearningItemType;

  // 과목 정보 (선택)
  subjectId: string | null;
  subject: string | null;
  subjectArea: string | null;

  // 범위 정보 (선택)
  rangeType: RangeType | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  rangeUnit: string | null;
  totalVolume: number | null;

  // 스타일
  icon: string | null;
  color: string | null;
  tags: string[];

  // 설정
  estimatedMinutes: number | null;
  isTemplate: boolean;
  isArchived: boolean;
  archivedAt: string | null;

  // 마스터 콘텐츠 연결 (선택)
  masterBookId: string | null;
  masterLectureId: string | null;
  masterCustomContentId: string | null;

  // 타임스탬프
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 자유 학습 아이템 생성 입력
 */
export interface FreeLearningItemInput {
  tenantId: string;
  studentId?: string | null;

  // 필수
  title: string;

  // 선택
  description?: string | null;
  itemType?: FreeLearningItemType;
  subjectId?: string | null;
  subject?: string | null;
  subjectArea?: string | null;
  rangeType?: RangeType | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  rangeUnit?: string | null;
  totalVolume?: number | null;
  icon?: string | null;
  color?: string | null;
  tags?: string[];
  estimatedMinutes?: number | null;
  isTemplate?: boolean;
  masterBookId?: string | null;
  masterLectureId?: string | null;
  masterCustomContentId?: string | null;
}

/**
 * 자유 학습 아이템 업데이트 입력
 */
export type FreeLearningItemUpdate = Partial<
  Omit<FreeLearningItemInput, 'tenantId' | 'studentId'>
>;

/**
 * 자유 학습 아이템 필터
 */
export interface FreeLearningItemFilters {
  studentId?: string;
  tenantId?: string;
  itemType?: FreeLearningItemType;
  subjectId?: string;
  tags?: string[];
  isTemplate?: boolean;
  isArchived?: boolean;
  search?: string;
}

/**
 * 자유 학습 아이템 DB 로우
 */
export interface FreeLearningItemDbRow {
  id: string;
  tenant_id: string;
  student_id: string | null;
  content_type: string;
  title: string;
  description: string | null;
  item_type: string | null;
  subject_id: string | null;
  subject: string | null;
  subject_area: string | null;
  curriculum: string | null;
  range_type: string | null;
  range_start: string | null;
  range_end: string | null;
  range_unit: string | null;
  total_volume: number | null;
  icon: string | null;
  color: string | null;
  tags: string[] | null;
  estimated_minutes: number | null;
  is_template: boolean | null;
  is_archived: boolean | null;
  archived_at: string | null;
  master_book_id: string | null;
  master_lecture_id: string | null;
  master_custom_content_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * DB 로우를 FreeLearningItem으로 변환
 */
export function toFreeLearningItem(row: FreeLearningItemDbRow): FreeLearningItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    title: row.title,
    description: row.description,
    itemType: (row.item_type as FreeLearningItemType) || 'free',
    subjectId: row.subject_id,
    subject: row.subject,
    subjectArea: row.subject_area,
    rangeType: row.range_type as RangeType | null,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    rangeUnit: row.range_unit,
    totalVolume: row.total_volume,
    icon: row.icon,
    color: row.color,
    tags: row.tags ?? [],
    estimatedMinutes: row.estimated_minutes,
    isTemplate: row.is_template ?? false,
    isArchived: row.is_archived ?? false,
    archivedAt: row.archived_at,
    masterBookId: row.master_book_id,
    masterLectureId: row.master_lecture_id,
    masterCustomContentId: row.master_custom_content_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * FreeLearningItemInput을 DB 로우로 변환
 */
export function toFreeLearningItemDbRow(
  input: FreeLearningItemInput
): Omit<FreeLearningItemDbRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: input.tenantId,
    student_id: input.studentId ?? null,
    content_type: 'free', // flexible_contents의 content_type
    title: input.title,
    description: input.description ?? null,
    item_type: input.itemType ?? 'free',
    subject_id: input.subjectId ?? null,
    subject: input.subject ?? null,
    subject_area: input.subjectArea ?? null,
    curriculum: null,
    range_type: input.rangeType ?? null,
    range_start: input.rangeStart ?? null,
    range_end: input.rangeEnd ?? null,
    range_unit: input.rangeUnit ?? null,
    total_volume: input.totalVolume ?? null,
    icon: input.icon ?? FREE_LEARNING_ITEM_ICONS[input.itemType ?? 'free'],
    color: input.color ?? FREE_LEARNING_ITEM_COLORS[input.itemType ?? 'free'],
    tags: input.tags ?? [],
    estimated_minutes: input.estimatedMinutes ?? null,
    is_template: input.isTemplate ?? false,
    is_archived: false,
    archived_at: null,
    master_book_id: input.masterBookId ?? null,
    master_lecture_id: input.masterLectureId ?? null,
    master_custom_content_id: input.masterCustomContentId ?? null,
    created_by: null,
  };
}

/**
 * 아이템 타입 아이콘 가져오기
 */
export function getFreeLearningItemIcon(itemType: FreeLearningItemType): string {
  return FREE_LEARNING_ITEM_ICONS[itemType] ?? FREE_LEARNING_ITEM_ICONS.free;
}

/**
 * 아이템 타입 레이블 가져오기
 */
export function getFreeLearningItemLabel(itemType: FreeLearningItemType): string {
  return FREE_LEARNING_ITEM_LABELS[itemType] ?? FREE_LEARNING_ITEM_LABELS.free;
}

/**
 * 아이템 타입 색상 가져오기
 */
export function getFreeLearningItemColor(itemType: FreeLearningItemType): string {
  return FREE_LEARNING_ITEM_COLORS[itemType] ?? FREE_LEARNING_ITEM_COLORS.free;
}
