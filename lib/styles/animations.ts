/**
 * Animation Constants - 중앙화된 애니메이션 시스템
 *
 * 모든 애니메이션 관련 상수와 유틸리티를 한 곳에서 관리합니다.
 * globals.css의 @keyframes와 연동되어 일관된 애니메이션을 제공합니다.
 *
 * @see globals.css - @keyframes 정의
 * @see lib/styles/tokens.ts - 기본 애니메이션 토큰
 *
 * ## 사용 예시
 *
 * ```tsx
 * import { animationClasses, durations, createTransition } from "@/lib/styles/animations";
 *
 * // 클래스 직접 사용
 * <div className={animationClasses.fadeIn}>페이드 인</div>
 *
 * // 트랜지션 생성
 * <button style={{ transition: createTransition(["transform", "opacity"], durations.fast) }}>
 *   버튼
 * </button>
 * ```
 */

// ============================================================================
// Duration Constants (ms)
// ============================================================================

/**
 * 애니메이션 지속 시간 (밀리초)
 *
 * 2025년 웹 트렌드에 맞춰 짧은 지속시간을 기본으로 사용합니다.
 * - instant: 즉시 (0ms) - 상태 변경
 * - fastest: 75ms - 마이크로 인터랙션
 * - fast: 150ms - 호버, 포커스 효과
 * - normal: 200ms - 기본 트랜지션
 * - slow: 300ms - 모달, 드로어
 * - slower: 500ms - 페이지 전환
 * - slowest: 700ms - 복잡한 애니메이션
 */
export const durations = {
  instant: 0,
  fastest: 75,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
  slowest: 700,
  // 특수 용도
  skeleton: 1500, // 스켈레톤 펄스
  confetti: 3000, // 축하 효과
  levelUp: 2000, // 레벨업 애니메이션
} as const;

export type DurationKey = keyof typeof durations;

/**
 * CSS 단위가 포함된 지속 시간
 */
export const durationsCss = {
  instant: "0ms",
  fastest: "75ms",
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
  slowest: "700ms",
  skeleton: "1.5s",
  confetti: "3s",
  levelUp: "2s",
} as const;

// ============================================================================
// Easing Functions
// ============================================================================

/**
 * 이징 함수 (cubic-bezier)
 *
 * - linear: 일정한 속도
 * - ease: 기본 이징
 * - easeIn: 천천히 시작
 * - easeOut: 천천히 끝남 (권장)
 * - easeInOut: 천천히 시작하고 끝남
 * - spring: 스프링 효과 (바운스)
 * - bounce: 바운스 효과
 */
export const easings = {
  linear: "linear",
  ease: "ease",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  /** MD3 emphasized-decelerate: 열기/진입 전환에 사용 */
  emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  /** MD3 emphasized-accelerate: 닫기/퇴장 전환에 사용 */
  emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)",
} as const;

export type EasingKey = keyof typeof easings;

// ============================================================================
// Keyframe Animation Names
// ============================================================================

/**
 * globals.css에 정의된 @keyframes 이름
 *
 * 이 이름들은 globals.css의 @keyframes 정의와 일치해야 합니다.
 */
export const keyframeNames = {
  // 기본 애니메이션
  shimmer: "shimmer",
  bounceSlow: "bounce-slow",
  bounceIn: "bounce-in",
  float: "float",
  confettiFall: "confetti-fall",

  // Tailwind 기본 애니메이션
  spin: "spin",
  ping: "ping",
  pulse: "pulse",
  bounce: "bounce",
} as const;

// ============================================================================
// CSS Animation Classes
// ============================================================================

/**
 * Tailwind 애니메이션 클래스
 *
 * globals.css의 커스텀 애니메이션과 Tailwind 기본 애니메이션을 포함합니다.
 */
export const animationClasses = {
  // === 커스텀 애니메이션 (globals.css) ===

  /** 셔머 효과 - 스켈레톤 로딩에 사용 */
  shimmer: "animate-shimmer",

  /** 느린 바운스 - 스트릭 불꽃 등에 사용 */
  bounceSlow: "animate-bounce-slow",

  /** 바운스 인 - 업적 해금에 사용 */
  bounceIn: "animate-bounce-in",

  /** 떠다니는 효과 - 레벨업 파티클에 사용 */
  float: "animate-float",

  // === Tailwind 기본 애니메이션 ===

  /** 회전 - 로딩 스피너 */
  spin: "animate-spin",

  /** 핑 - 알림 인디케이터 */
  ping: "animate-ping",

  /** 펄스 - 스켈레톤 로딩 */
  pulse: "animate-pulse",

  /** 바운스 - 주목 끌기 */
  bounce: "animate-bounce",

  // === Tailwind CSS animate-in/out ===

  /** 페이드 인 */
  fadeIn: "animate-in fade-in-0",
  fadeInFast: "animate-in fade-in-0 duration-150",
  fadeInSlow: "animate-in fade-in-0 duration-300",

  /** 페이드 아웃 */
  fadeOut: "animate-out fade-out-0",
  fadeOutFast: "animate-out fade-out-0 duration-150",

  /** 슬라이드 인 */
  slideInFromTop: "animate-in slide-in-from-top-4",
  slideInFromBottom: "animate-in slide-in-from-bottom-4",
  slideInFromLeft: "animate-in slide-in-from-left-4",
  slideInFromRight: "animate-in slide-in-from-right-4",

  /** 슬라이드 아웃 */
  slideOutToTop: "animate-out slide-out-to-top-4",
  slideOutToBottom: "animate-out slide-out-to-bottom-4",
  slideOutToLeft: "animate-out slide-out-to-left-4",
  slideOutToRight: "animate-out slide-out-to-right-4",

  /** 줌 인/아웃 */
  zoomIn: "animate-in zoom-in-95",
  zoomOut: "animate-out zoom-out-95",
} as const;

export type AnimationClassKey = keyof typeof animationClasses;

// ============================================================================
// Transition Classes
// ============================================================================

/**
 * 미리 정의된 트랜지션 클래스 조합
 *
 * 컴포넌트에서 자주 사용되는 트랜지션 패턴을 제공합니다.
 */
export const transitionClasses = {
  // === 기본 트랜지션 ===

  /** 모든 속성 - 빠름 */
  allFast: "transition-all duration-150 ease-out",

  /** 모든 속성 - 기본 */
  all: "transition-all duration-200 ease-out",

  /** 모든 속성 - 느림 */
  allSlow: "transition-all duration-300 ease-out",

  // === 특정 속성 트랜지션 ===

  /** 색상만 */
  colors: "transition-colors duration-200 ease-out",
  colorsFast: "transition-colors duration-150 ease-out",

  /** 투명도만 */
  opacity: "transition-opacity duration-200 ease-out",
  opacityFast: "transition-opacity duration-150 ease-out",

  /** 변환만 (transform) */
  transform: "transition-transform duration-200 ease-out",
  transformFast: "transition-transform duration-150 ease-out",

  /** 그림자만 */
  shadow: "transition-shadow duration-200 ease-out",

  // === 컴포넌트별 트랜지션 ===

  /** 버튼 호버 */
  button: "transition-colors duration-150 ease-out",

  /** 카드 호버 */
  card: "transition-shadow duration-200 ease-out",

  /** 모달/드로어 */
  modal: "transition-all duration-300 ease-out",

  /** 토스트 */
  toast: "transition-all duration-200 ease-out",

  /** 드롭다운 메뉴 */
  dropdown: "transition-all duration-150 ease-out",

  /** 툴팁 */
  tooltip: "transition-opacity duration-150 ease-out",
} as const;

export type TransitionClassKey = keyof typeof transitionClasses;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * CSS transition 문자열 생성
 *
 * @param properties 트랜지션 적용할 CSS 속성 배열
 * @param duration 지속 시간 (ms)
 * @param easing 이징 함수
 * @returns CSS transition 값
 *
 * @example
 * ```tsx
 * const transition = createTransition(["transform", "opacity"], 200);
 * // "transform 200ms cubic-bezier(0, 0, 0.2, 1), opacity 200ms cubic-bezier(0, 0, 0.2, 1)"
 * ```
 */
export function createTransition(
  properties: string | string[],
  duration: number = durations.normal,
  easing: EasingKey = "easeOut"
): string {
  const props = Array.isArray(properties) ? properties : [properties];
  const easingValue = easings[easing];
  return props.map((prop) => `${prop} ${duration}ms ${easingValue}`).join(", ");
}

/**
 * CSS animation 문자열 생성
 *
 * @param name 키프레임 이름
 * @param duration 지속 시간 (ms)
 * @param easing 이징 함수
 * @param options 추가 옵션 (iteration-count, direction, fill-mode)
 * @returns CSS animation 값
 *
 * @example
 * ```tsx
 * const animation = createAnimation("bounce-in", 600, "bounce");
 * // "bounce-in 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)"
 *
 * const looping = createAnimation("shimmer", 2000, "linear", { iterationCount: "infinite" });
 * // "shimmer 2000ms linear infinite"
 * ```
 */
export function createAnimation(
  name: string,
  duration: number = durations.normal,
  easing: EasingKey = "easeOut",
  options?: {
    iterationCount?: number | "infinite";
    direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
    fillMode?: "none" | "forwards" | "backwards" | "both";
    delay?: number;
  }
): string {
  const parts = [name, `${duration}ms`, easings[easing]];

  if (options?.delay) {
    parts.push(`${options.delay}ms`);
  }
  if (options?.iterationCount) {
    parts.push(String(options.iterationCount));
  }
  if (options?.direction) {
    parts.push(options.direction);
  }
  if (options?.fillMode) {
    parts.push(options.fillMode);
  }

  return parts.join(" ");
}

/**
 * 지연 애니메이션 클래스 생성
 *
 * 여러 요소에 순차적 애니메이션을 적용할 때 사용합니다.
 *
 * @param index 요소 인덱스
 * @param baseDelay 기본 지연 시간 (ms)
 * @returns Tailwind 지연 클래스
 *
 * @example
 * ```tsx
 * {items.map((item, i) => (
 *   <div
 *     key={item.id}
 *     className={cn(animationClasses.fadeIn, getStaggerDelay(i))}
 *   >
 *     {item.name}
 *   </div>
 * ))}
 * ```
 */
export function getStaggerDelay(index: number, baseDelay: number = 50): string {
  const delay = index * baseDelay;

  // Tailwind의 표준 delay 값에 매핑
  if (delay === 0) return "delay-0";
  if (delay <= 75) return "delay-75";
  if (delay <= 100) return "delay-100";
  if (delay <= 150) return "delay-150";
  if (delay <= 200) return "delay-200";
  if (delay <= 300) return "delay-300";
  if (delay <= 500) return "delay-500";
  if (delay <= 700) return "delay-700";
  if (delay <= 1000) return "delay-1000";

  // 커스텀 지연 (arbitrary value)
  return `delay-[${delay}ms]`;
}

/**
 * 축소된 모션 설정 확인
 *
 * prefers-reduced-motion 미디어 쿼리를 확인합니다.
 * 서버 사이드에서는 항상 false를 반환합니다.
 *
 * @returns 축소된 모션 선호 여부
 *
 * @example
 * ```tsx
 * const reduced = prefersReducedMotion();
 * const animationClass = reduced ? "" : animationClasses.fadeIn;
 * ```
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ============================================================================
// Preset Animation Configurations
// ============================================================================

/**
 * 컴포넌트별 애니메이션 프리셋
 *
 * 특정 컴포넌트에서 자주 사용되는 애니메이션 설정을 제공합니다.
 */
export const animationPresets = {
  /** 모달 열림 */
  modalOpen: {
    className: "animate-in fade-in-0 zoom-in-95 duration-200",
    style: {
      animation: createAnimation("", durations.normal, "easeOut"),
    },
  },

  /** 모달 닫힘 */
  modalClose: {
    className: "animate-out fade-out-0 zoom-out-95 duration-150",
  },

  /** 토스트 표시 */
  toastShow: {
    className: "animate-in slide-in-from-right-4 fade-in-0 duration-200",
  },

  /** 토스트 숨김 */
  toastHide: {
    className: "animate-out slide-out-to-right-4 fade-out-0 duration-150",
  },

  /** 드롭다운 열림 */
  dropdownOpen: {
    className: "animate-in fade-in-0 zoom-in-95 duration-150",
  },

  /** 드롭다운 닫힘 */
  dropdownClose: {
    className: "animate-out fade-out-0 zoom-out-95 duration-100",
  },

  /** 슬라이드오버 열림 */
  slideOverOpen: {
    className: "animate-in slide-in-from-right duration-300",
  },

  /** 슬라이드오버 닫힘 */
  slideOverClose: {
    className: "animate-out slide-out-to-right duration-200",
  },

  /** 스켈레톤 로딩 */
  skeleton: {
    className: "animate-pulse",
  },

  /** 로딩 스피너 */
  spinner: {
    className: "animate-spin",
  },

  /** 성공 체크마크 */
  successCheck: {
    className: "animate-bounce-in",
  },

  /** 레벨업 효과 */
  levelUp: {
    className: "animate-bounce-in animate-float",
  },
} as const;

export type AnimationPresetKey = keyof typeof animationPresets;

// ============================================================================
// Re-exports from tokens.ts (for convenience)
// ============================================================================

// Note: 이 상수들은 tokens.ts에도 정의되어 있습니다.
// 애니메이션 관련 코드에서 이 파일만 import하면 됩니다.
export {
  animationDuration,
  animationEasing,
  transitions,
  animations,
} from "./tokens";
