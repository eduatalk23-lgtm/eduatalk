/**
 * 과목 기반 색상 시스템
 * DJB2 해시를 사용하여 과목명에 따라 결정적으로 색상을 배정
 * 8색 팔레트는 lib/constants/colors.ts의 차트 팔레트와 일치
 */

interface SubjectColorSet {
  accent: string;
  bg: string;
  text: string;
  border: string;
}

const SUBJECT_COLOR_PALETTE: SubjectColorSet[] = [
  { accent: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { accent: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { accent: 'bg-pink-500', bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  { accent: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  { accent: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  { accent: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { accent: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  { accent: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
];

/** 기본 blue fallback (subject 없는 adhoc 등) */
const DEFAULT_COLORS: SubjectColorSet = SUBJECT_COLOR_PALETTE[5]; // blue

/** 상태별 고정 색상 (completed/deferred/missed) */
const STATUS_COLORS: Record<string, SubjectColorSet> = {
  completed: { accent: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  deferred: { accent: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  missed: { accent: 'bg-rose-400', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' },
};

/** DJB2 해시 — 한국어 과목명에 적합한 결정적 해시 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 과목명 → 0~7 팔레트 인덱스 */
export function getSubjectColorIndex(subject: string): number {
  return djb2Hash(subject) % SUBJECT_COLOR_PALETTE.length;
}

/**
 * 그리드 블록 최종 색상 반환
 * - completed/deferred/missed → 상태 색상 유지
 * - pending/in_progress → 과목 기반 색상
 * - subject 없는 경우 → 기본 blue fallback
 */
export function getGridBlockColors(
  subject: string | undefined,
  status: string,
  isCompleted: boolean,
): SubjectColorSet {
  // completed 상태 (isCompleted 플래그 또는 status)
  if (isCompleted || status === 'completed') return STATUS_COLORS.completed;
  if (status === 'deferred') return STATUS_COLORS.deferred;
  if (status === 'missed') return STATUS_COLORS.missed;

  // 과목 기반 색상
  if (!subject) return DEFAULT_COLORS;
  const index = getSubjectColorIndex(subject);
  return SUBJECT_COLOR_PALETTE[index];
}
