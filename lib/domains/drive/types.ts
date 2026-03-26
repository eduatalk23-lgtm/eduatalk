/**
 * Drive System Types
 * 통합 파일 저장소 & 워크플로우 타입 정의
 */

// -- 카테고리 --
/** 기본 카테고리 (코드 내장) */
export const DEFAULT_FILE_CATEGORIES = ["transcript", "grade_report"] as const;
export type DefaultFileCategory = (typeof DEFAULT_FILE_CATEGORIES)[number];

/** 카테고리 키 — 기본 카테고리 + 커스텀 카테고리 (string) */
export type FileCategory = string;

/** @deprecated FILE_CATEGORIES → DEFAULT_FILE_CATEGORIES 사용 */
export const FILE_CATEGORIES = DEFAULT_FILE_CATEGORIES;

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  transcript: "생기부",
  grade_report: "성적표",
};

/** @deprecated FILE_CATEGORY_LABELS → DEFAULT_CATEGORY_LABELS + getCategoryLabel() 사용 */
export const FILE_CATEGORY_LABELS: Record<string, string> = DEFAULT_CATEGORY_LABELS;

/** 커스텀 카테고리 (DB에서 로드) */
export interface CustomFileCategory {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/** 카테고리 레이블 조회 (기본 + 커스텀) */
export function getCategoryLabel(
  key: string,
  customCategories?: CustomFileCategory[]
): string {
  if (key in DEFAULT_CATEGORY_LABELS) {
    return DEFAULT_CATEGORY_LABELS[key as DefaultFileCategory];
  }
  const custom = customCategories?.find((c) => c.key === key);
  return custom?.label ?? key;
}

// -- 업로더 역할 --
export type UploaderRole = "student" | "parent" | "admin";

// -- 파일 --
export interface DriveFile {
  id: string;
  tenant_id: string;
  student_id: string;
  uploaded_by: string;
  uploaded_by_role: UploaderRole;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  category: FileCategory;
  version_group_id: string;
  version_number: number;
  expires_at: string;
  created_at: string;
}

export interface DriveFileInsert {
  tenant_id: string;
  student_id: string;
  uploaded_by: string;
  uploaded_by_role: UploaderRole;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  category: FileCategory;
  version_group_id?: string;
  version_number?: number;
  expires_at: string;
}

// -- 파일 용처 --
export type FileContextType = "drive" | "workflow" | "chat" | "distribution" | "guide";

export interface FileContext {
  id: string;
  file_id: string;
  context_type: FileContextType;
  context_id: string | null;
  created_at: string;
}

// -- 워크플로우 요청 --
export const REQUEST_STATUSES = [
  "pending",
  "overdue",
  "submitted",
  "approved",
  "rejected",
] as const;
export type FileRequestStatus = (typeof REQUEST_STATUSES)[number];

export interface FileRequest {
  id: string;
  tenant_id: string;
  student_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: FileCategory;
  allowed_mime_types: string[] | null;
  deadline: string | null;
  status: FileRequestStatus;
  rejection_reason: string | null;
  approved_file_id: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

// -- 조회 필터 --
export interface DriveFileFilter {
  category?: FileCategory;
  contextType?: FileContextType;
  uploadedByRole?: UploaderRole;
}

// -- 허용 파일 타입 --
export const DRIVE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/haansofthwp",
  "application/x-hwp",
] as const;

export type DriveAllowedMimeType = (typeof DRIVE_ALLOWED_MIME_TYPES)[number];

/** 드라이브 파일 최대 크기: 50MB */
export const DRIVE_MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 드라이브 파일 만료 일수 */
export const DRIVE_EXPIRY_DAYS = 7;

// -- 학생 이름 포함 요청 타입 (대시보드용) --
export interface FileRequestWithStudent extends FileRequest {
  student_name: string;
}

// -- MIME 타입 그룹 프리셋 (UI 체크박스용) --
// DRIVE_ALLOWED_MIME_TYPES 에서 파생 — MIME 타입 추가/제거 시 한 곳만 수정
export const MIME_TYPE_GROUPS = {
  image: {
    label: "이미지",
    types: DRIVE_ALLOWED_MIME_TYPES.filter((t) => t.startsWith("image/")),
  },
  pdf: {
    label: "PDF",
    types: DRIVE_ALLOWED_MIME_TYPES.filter((t) => t === "application/pdf"),
  },
  word: {
    label: "Word",
    types: DRIVE_ALLOWED_MIME_TYPES.filter(
      (t) => t === "application/msword" || t.includes("wordprocessingml")
    ),
  },
  hwp: {
    label: "HWP",
    types: DRIVE_ALLOWED_MIME_TYPES.filter(
      (t) => t.includes("hwp")
    ),
  },
} as const;
export type MimeTypeGroupKey = keyof typeof MIME_TYPE_GROUPS;

// -- 자료 배포 --
export interface FileDistribution {
  id: string;
  tenant_id: string;
  file_id: string;
  student_id: string;
  distributed_by: string;
  title: string;
  description: string | null;
  viewed_at: string | null;
  downloaded_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface DistributionWithFile extends FileDistribution {
  file: DriveFile;
  is_updated: boolean;
}

export interface DistributionTracking {
  distribution_id: string;
  student_id: string;
  student_name: string;
  viewed_at: string | null;
  downloaded_at: string | null;
}

// -- 요청 템플릿 --
export interface RequestTemplate {
  id: string;
  tenant_id: string;
  name: string;
  title: string;
  description: string | null;
  category: FileCategory;
  allowed_mime_types: string[] | null;
  deadline_days: number | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
