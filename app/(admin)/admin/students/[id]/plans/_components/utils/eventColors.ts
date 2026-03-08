/**
 * 24색 이벤트 팔레트 + 커스텀 hex 지원
 *
 * calendar_events.color 필드에 저장되는 값:
 * - 팔레트 키 (예: 'peacock', 'tomato')
 * - 커스텀 hex (예: '#ff5733')
 *
 * EventEditLeftColumn, InlineQuickCreate에서 색상 선택 UI로 사용
 */

export interface EventColor {
  key: string;
  label: string;
  /** Solid fill 배경색 (hex) */
  hex: string;
  /** 밝은 배경 (bordered 모드용) */
  lightBg: string;
  /** 색 텍스트 (bordered 모드용, Tailwind class) */
  coloredText: string;
  /** 색 테두리 (bordered 모드용, Tailwind class) */
  coloredBorder: string;
  /** 진행률 바 */
  progressBar: string;
}

/**
 * 24색 팔레트 (GCal 11색 + 13색 확장)
 * 색상환 순서: 빨강(warm) → 노랑 → 초록 → 파랑(cool) → 보라 → 무채색
 */
export const EVENT_COLOR_PALETTE: EventColor[] = [
  // --- GCal 기본 11색 (색상환 순서) ---
  { key: 'tomato',     label: '토마토',   hex: '#d50000', lightBg: 'bg-red-50',     coloredText: 'text-red-700',     coloredBorder: 'border-red-500',     progressBar: 'bg-red-200' },
  { key: 'flamingo',   label: '플라밍고', hex: '#e67c73', lightBg: 'bg-red-50',     coloredText: 'text-red-600',     coloredBorder: 'border-red-400',     progressBar: 'bg-red-200' },
  { key: 'tangerine',  label: '귤',       hex: '#f4511e', lightBg: 'bg-orange-50',  coloredText: 'text-orange-700',  coloredBorder: 'border-orange-400',  progressBar: 'bg-orange-200' },
  { key: 'banana',     label: '바나나',   hex: '#f6bf26', lightBg: 'bg-yellow-50',  coloredText: 'text-yellow-700',  coloredBorder: 'border-yellow-400',  progressBar: 'bg-yellow-200' },
  { key: 'sage',       label: '세이지',   hex: '#33b679', lightBg: 'bg-emerald-50', coloredText: 'text-emerald-700', coloredBorder: 'border-emerald-400', progressBar: 'bg-emerald-200' },
  { key: 'basil',      label: '바질',     hex: '#0b8043', lightBg: 'bg-green-50',   coloredText: 'text-green-700',   coloredBorder: 'border-green-400',   progressBar: 'bg-green-200' },
  { key: 'peacock',    label: '공작',     hex: '#039be5', lightBg: 'bg-sky-50',     coloredText: 'text-sky-700',     coloredBorder: 'border-sky-400',     progressBar: 'bg-sky-200' },
  { key: 'blueberry',  label: '블루베리', hex: '#3f51b5', lightBg: 'bg-blue-50',    coloredText: 'text-blue-700',    coloredBorder: 'border-blue-400',    progressBar: 'bg-blue-200' },
  { key: 'lavender',   label: '라벤더',   hex: '#7986cb', lightBg: 'bg-indigo-50',  coloredText: 'text-indigo-700',  coloredBorder: 'border-indigo-400',  progressBar: 'bg-indigo-200' },
  { key: 'grape',      label: '포도',     hex: '#8e24aa', lightBg: 'bg-purple-50',  coloredText: 'text-purple-700',  coloredBorder: 'border-purple-400',  progressBar: 'bg-purple-200' },
  { key: 'graphite',   label: '흑연',     hex: '#616161', lightBg: 'bg-gray-100',   coloredText: 'text-gray-700',    coloredBorder: 'border-gray-400',    progressBar: 'bg-gray-300' },

  // --- 확장 13색 (색상환 순서: warm → cool) ---
  { key: 'cherry',     label: '체리',     hex: '#c62828', lightBg: 'bg-rose-50',    coloredText: 'text-rose-700',    coloredBorder: 'border-rose-400',    progressBar: 'bg-rose-200' },
  { key: 'radicchio',  label: '라디키오', hex: '#ad1457', lightBg: 'bg-pink-50',    coloredText: 'text-pink-700',    coloredBorder: 'border-pink-400',    progressBar: 'bg-pink-200' },
  { key: 'pumpkin',    label: '호박',     hex: '#e65100', lightBg: 'bg-orange-50',  coloredText: 'text-orange-800',  coloredBorder: 'border-orange-500',  progressBar: 'bg-orange-200' },
  { key: 'mango',      label: '망고',     hex: '#ff8f00', lightBg: 'bg-amber-50',   coloredText: 'text-amber-700',   coloredBorder: 'border-amber-400',   progressBar: 'bg-amber-200' },
  { key: 'cocoa',      label: '코코아',   hex: '#795548', lightBg: 'bg-amber-50',   coloredText: 'text-amber-800',   coloredBorder: 'border-amber-500',   progressBar: 'bg-amber-200' },
  { key: 'pistachio',  label: '피스타치오', hex: '#7cb342', lightBg: 'bg-lime-50',  coloredText: 'text-lime-700',    coloredBorder: 'border-lime-400',    progressBar: 'bg-lime-200' },
  { key: 'avocado',    label: '아보카도', hex: '#689f38', lightBg: 'bg-lime-50',    coloredText: 'text-lime-700',    coloredBorder: 'border-lime-500',    progressBar: 'bg-lime-200' },
  { key: 'eucalyptus', label: '유칼립투스', hex: '#009688', lightBg: 'bg-teal-50',  coloredText: 'text-teal-700',    coloredBorder: 'border-teal-400',    progressBar: 'bg-teal-200' },
  { key: 'ocean',      label: '오션',     hex: '#0277bd', lightBg: 'bg-cyan-50',    coloredText: 'text-cyan-700',    coloredBorder: 'border-cyan-400',    progressBar: 'bg-cyan-200' },
  { key: 'cobalt',     label: '코발트',   hex: '#1565c0', lightBg: 'bg-blue-50',    coloredText: 'text-blue-800',    coloredBorder: 'border-blue-500',    progressBar: 'bg-blue-200' },
  { key: 'wisteria',   label: '등나무',   hex: '#9575cd', lightBg: 'bg-violet-50',  coloredText: 'text-violet-600',  coloredBorder: 'border-violet-300',  progressBar: 'bg-violet-200' },
  { key: 'amethyst',   label: '자수정',   hex: '#6a1b9a', lightBg: 'bg-violet-50',  coloredText: 'text-violet-700',  coloredBorder: 'border-violet-400',  progressBar: 'bg-violet-200' },
  { key: 'birch',      label: '자작나무', hex: '#78909c', lightBg: 'bg-slate-50',   coloredText: 'text-slate-600',   coloredBorder: 'border-slate-400',   progressBar: 'bg-slate-200' },
];

/** GCal 기본 11색 (이벤트 색상 드롭다운 기본 표시) */
export const GCAL_CORE_COLORS = EVENT_COLOR_PALETTE.slice(0, 11);

/** 확장 13색 (더보기 시 추가 표시) */
export const EXTENDED_COLORS = EVENT_COLOR_PALETTE.slice(11);

const COLOR_BY_KEY = new Map(EVENT_COLOR_PALETTE.map((c) => [c.key, c]));
const pick = (key: string) => COLOR_BY_KEY.get(key)!;

/**
 * 색상 계열별 정렬 (4열 × 6행)
 * 행 단위로 같은 계열이 나란히 배치
 * 더보기 확장 시 전체 팔레트용
 */
export const COLORS_BY_FAMILY: EventColor[] = [
  // 빨강 계열
  pick('tomato'), pick('cherry'), pick('flamingo'), pick('radicchio'),
  // 주황·노랑 계열
  pick('tangerine'), pick('pumpkin'), pick('banana'), pick('mango'),
  // 갈색·연두 계열
  pick('cocoa'), pick('pistachio'), pick('avocado'), pick('sage'),
  // 초록·청록 계열
  pick('basil'), pick('eucalyptus'), pick('ocean'), pick('peacock'),
  // 파랑·남색 계열
  pick('cobalt'), pick('blueberry'), pick('lavender'), pick('wisteria'),
  // 보라·무채색 계열
  pick('grape'), pick('amethyst'), pick('graphite'), pick('birch'),
];

const COLOR_MAP = new Map(EVENT_COLOR_PALETTE.map((c) => [c.key, c]));

/** hex 유효성 검사 */
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * 임의 hex 값으로 EventColor 생성
 * Tailwind 클래스 대신 인라인 스타일용 hex 기반 값 반환
 */
function createCustomEventColor(hex: string): EventColor {
  return {
    key: hex,
    label: hex,
    hex,
    // 커스텀 hex는 인라인 스타일로 적용 → Tailwind 클래스는 fallback
    lightBg: '',
    coloredText: '',
    coloredBorder: '',
    progressBar: '',
  };
}

/**
 * 이벤트 색상 키 또는 hex → EventColor
 * - 팔레트 키 ('peacock' 등) → 해당 EventColor
 * - hex 값 ('#ff5733' 등) → 동적 EventColor
 * - null/undefined → null
 */
export function getEventColor(colorKey: string | null | undefined): EventColor | null {
  if (!colorKey) return null;
  // 팔레트 키 매칭
  const preset = COLOR_MAP.get(colorKey);
  if (preset) return preset;
  // 커스텀 hex
  if (HEX_REGEX.test(colorKey)) return createCustomEventColor(colorKey);
  return null;
}

/** hex가 유효한 색상 값인지 확인 */
export function isValidHexColor(value: string): boolean {
  return HEX_REGEX.test(value);
}

