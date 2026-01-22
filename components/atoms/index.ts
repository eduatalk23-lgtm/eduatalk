/**
 * Atoms - 가장 기본적인 UI 컴포넌트
 *
 * 더 이상 분해할 수 없는 기본 요소들입니다.
 * 다른 atoms와 조합하여 molecules를 만듭니다.
 */

// Button
export { default as Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

// Input
export { default as Input } from "./Input";
export type { InputProps, InputSize } from "./Input";

// Select
export { default as Select } from "./Select";
export type { SelectProps, SelectSize } from "./Select";

// Label
export { default as Label } from "./Label";
export type { LabelProps } from "./Label";

// Badge
export { Badge, default as BadgeDefault } from "./Badge";
export type { BadgeProps, BadgeVariant, BadgeSize } from "./Badge";

// Spinner
export { Spinner, default as SpinnerDefault } from "./Spinner";
export type { SpinnerProps, SpinnerSize } from "./Spinner";

// Skeleton
export { Skeleton, default as SkeletonDefault } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

// ProgressBar
export { ProgressBar, default as ProgressBarDefault } from "./ProgressBar";
export type { ProgressBarProps, ProgressBarVariant, ProgressBarSize } from "./ProgressBar";

// ToggleSwitch
export { default as ToggleSwitch } from "./ToggleSwitch";
export type { ToggleSwitchProps } from "./ToggleSwitch";

// Avatar
export { Avatar, default as AvatarDefault } from "./Avatar";
export type { AvatarProps, AvatarSize, AvatarVariant } from "./Avatar";

// TextArea
export { TextArea, default as TextAreaDefault } from "./TextArea";
export type { TextAreaProps, TextAreaSize, TextAreaResize } from "./TextArea";

// PasswordInput
export { default as PasswordInput } from "./PasswordInput";
export type { PasswordInputProps, PasswordInputSize } from "./PasswordInput";

// PasswordStrengthIndicator
export { default as PasswordStrengthIndicator, calculatePasswordStrength } from "./PasswordStrengthIndicator";
export type {
  PasswordStrengthIndicatorProps,
  PasswordStrength,
  PasswordStrengthResult,
} from "./PasswordStrengthIndicator";

