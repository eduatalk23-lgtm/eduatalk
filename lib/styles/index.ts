/**
 * Design System - 통합 내보내기
 *
 * TimeLevelUp 디자인 시스템의 모든 토큰과 유틸리티를 제공합니다.
 *
 * ## 구조
 *
 * 1. **tokens.ts** - 디자인 토큰 (색상, 간격, 애니메이션 등)
 * 2. **cssVariables.ts** - CSS 변수 참조 및 유틸리티
 * 3. **darkMode.ts** - 다크 모드 유틸리티 (@/lib/utils/darkMode)
 *
 * ## 사용 예시
 *
 * ```tsx
 * // 디자인 토큰 사용
 * import { transitions, animations, componentSpacing } from "@/lib/styles";
 *
 * <div className={cn(transitions.fast, componentSpacing.cardPadding.md)}>
 *   내용
 * </div>
 *
 * // CSS 변수 유틸리티 사용
 * import { semanticColorVar, elevationVar } from "@/lib/styles";
 *
 * <div style={{
 *   backgroundColor: semanticColorVar("primary", 500, 0.1),
 *   boxShadow: elevationVar(4)
 * }}>
 *   내용
 * </div>
 *
 * // 다크 모드 유틸리티 (별도 import)
 * import { textPrimaryVar, bgSurfaceVar } from "@/lib/utils/darkMode";
 * ```
 *
 * @module styles
 */

// ============================================================================
// Design Tokens (tokens.ts)
// ============================================================================

export {
  // Colors
  semanticColors,
  statusColors,
  chartColors,
  gradeColors,
  // Spacing
  spacing,
  componentSpacing,
  // Animation
  animationDuration,
  animationEasing,
  transitions,
  animations,
  // Typography
  fontSize,
  fontWeight,
  textStyles,
  // Elevation
  elevation,
  componentElevation,
  // Border Radius
  borderRadius,
  componentRadius,
  // Z-Index
  zIndex,
  // Breakpoints
  breakpoints,
  // Utility Functions
  getChartColor,
  getGradeColorTokens,
  getStatusSemanticColor,
  // Types
  type SemanticColor,
  type StatusType,
} from "./tokens";

// ============================================================================
// CSS Variables (cssVariables.ts)
// ============================================================================

export {
  // CSS Variable Names
  baseCssVars,
  textCssVars,
  semanticColorCssVars,
  gradeCssVars,
  chartCssVars,
  dayTypeCssVars,
  riskCssVars,
  elevationCssVars,
  tierCssVars,
  // CSS Variable Utilities
  cssVar,
  rgbVar,
  semanticColorVar,
  gradeColorVar,
  chartColorVar,
  elevationVar,
  // Tailwind Classes
  tailwindSemanticColors,
  cssVarTailwindClasses,
  // Types
  type SemanticColorName,
  type ColorShade,
  type GradeNumber,
  type ChartColorIndex,
  type ElevationLevel,
  type DayType,
  type RiskLevel,
  type TierLevel,
} from "./cssVariables";

// ============================================================================
// Animations (animations.ts)
// ============================================================================

export {
  // Duration Constants
  durations,
  durationsCss,
  // Easing Functions
  easings,
  // Keyframe Names
  keyframeNames,
  // Animation Classes
  animationClasses,
  // Transition Classes
  transitionClasses,
  // Utility Functions
  createTransition,
  createAnimation,
  getStaggerDelay,
  prefersReducedMotion,
  // Presets
  animationPresets,
  // Types
  type DurationKey,
  type EasingKey,
  type AnimationClassKey,
  type TransitionClassKey,
  type AnimationPresetKey,
} from "./animations";
