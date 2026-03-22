/** 캘린더 사이드 패널 메모 시스템 타입 */

export type MemoAuthorRole = "student" | "admin" | "consultant";

/** G3-4: 메모 영역 태깅 타입 */
export type MemoRecordAreaType = "setek" | "changche" | "haengteuk" | "reading" | "personal_setek";

export const MEMO_AREA_TYPE_LABELS: Record<MemoRecordAreaType, string> = {
  setek: "세특",
  changche: "창체",
  haengteuk: "행특",
  reading: "독서",
  personal_setek: "개인세특",
};
export type MemoVisibility = "public" | "private";

export const MEMO_COLORS = [
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
] as const;

export type MemoColor = (typeof MEMO_COLORS)[number];

export const MEMO_COLOR_MAP: Record<MemoColor, { bg: string; border: string }> =
  {
    default: { bg: "bg-[var(--color-bg-secondary)]", border: "border-[var(--color-border)]" },
    red: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800" },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800" },
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-800" },
    green: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-800" },
    teal: { bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-200 dark:border-teal-800" },
    blue: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800" },
    purple: { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800" },
  };

/** DB 행 타입 */
export interface CalendarMemoRow {
  id: string;
  tenant_id: string;
  student_id: string;
  author_id: string;
  author_role: MemoAuthorRole;
  title: string | null;
  content: string;
  is_checklist: boolean;
  memo_date: string | null;
  visibility: MemoVisibility;
  pinned: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** G3-4: 영역 타입 (null=일반 메모) */
  record_area_type: MemoRecordAreaType | null;
  /** G3-4: 영역 ID (null=일반 메모) */
  record_area_id: string | null;
}

/** 메모 목록 아이템 (작성자 이름 포함) */
export interface CalendarMemoWithAuthor extends CalendarMemoRow {
  author_name: string | null;
}

/** 메모 생성 입력 */
export interface CreateMemoInput {
  studentId: string;
  title?: string;
  content: string;
  isChecklist?: boolean;
  memoDate?: string;
  visibility?: MemoVisibility;
  color?: MemoColor;
  /** G3-4: 영역 태깅 */
  recordAreaType?: MemoRecordAreaType;
  recordAreaId?: string;
}

/** 메모 수정 입력 */
export interface UpdateMemoInput {
  title?: string | null;
  content?: string;
  isChecklist?: boolean;
  memoDate?: string | null;
  visibility?: MemoVisibility;
  pinned?: boolean;
  color?: MemoColor | null;
}

/** 서버 액션 결과 */
export interface MemoActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}
