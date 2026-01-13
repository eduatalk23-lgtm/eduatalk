/**
 * 플랜 상태 및 컨테이너 타입 관련 색상 유틸리티
 *
 * PLAN_STATUS_OPTIONS, CONTAINER_TYPE_OPTIONS의 추상화된 색상 이름을
 * Tailwind CSS 클래스로 변환하는 헬퍼 함수들
 */

// ============================================
// 색상 이름 → Tailwind 클래스 매핑
// ============================================

const TEXT_COLOR_MAP: Record<string, string> = {
  gray: 'text-gray-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
};

const BG_COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-100',
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  amber: 'bg-amber-100',
  red: 'bg-red-100',
  orange: 'bg-orange-100',
};

const BORDER_COLOR_MAP: Record<string, string> = {
  gray: 'border-gray-300',
  blue: 'border-blue-300',
  green: 'border-green-300',
  amber: 'border-amber-300',
  red: 'border-red-300',
  orange: 'border-orange-300',
};

// ============================================
// 단일 색상 변환 함수
// ============================================

/**
 * 색상 이름을 Tailwind 텍스트 색상 클래스로 변환
 * @example getStatusTextColor('gray') → 'text-gray-600'
 */
export function getStatusTextColor(color: string): string {
  return TEXT_COLOR_MAP[color] ?? TEXT_COLOR_MAP.gray;
}

/**
 * 색상 이름을 Tailwind 배경 색상 클래스로 변환
 * @example getStatusBgColor('blue') → 'bg-blue-100'
 */
export function getStatusBgColor(color: string): string {
  return BG_COLOR_MAP[color] ?? BG_COLOR_MAP.gray;
}

/**
 * 색상 이름을 Tailwind 보더 색상 클래스로 변환
 * @example getStatusBorderColor('green') → 'border-green-300'
 */
export function getStatusBorderColor(color: string): string {
  return BORDER_COLOR_MAP[color] ?? BORDER_COLOR_MAP.gray;
}

// ============================================
// 조합 색상 변환 함수
// ============================================

/**
 * 선택 가능한 요소(라디오 버튼, 카드 등)의 선택 상태 스타일
 * 배경 + 텍스트 + 보더 조합
 * @example getStatusSelectionColor('blue') → 'bg-blue-100 text-blue-700 border-blue-300'
 */
export function getStatusSelectionColor(color: string): string {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
    green: 'bg-green-100 text-green-700 border-green-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
  };
  return colorMap[color] ?? colorMap.gray;
}

/**
 * 뱃지/태그 스타일 (배경 + 텍스트)
 * @example getStatusBadgeColor('completed') → 'bg-green-100 text-green-700'
 */
export function getStatusBadgeColor(color: string): string {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return colorMap[color] ?? colorMap.gray;
}
