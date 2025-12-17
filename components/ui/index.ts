/**
 * UI Components (Legacy)
 *
 * 이 파일은 기존 components/ui/ 컴포넌트들을 export합니다.
 * 새로운 코드에서는 @/components/atoms, @/components/molecules, @/components/organisms를 직접 사용하세요.
 *
 * @deprecated 이 export는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 Atomic Design 패턴을 따라 import하세요:
 *
 * @example
 * // 새로운 방식 (권장)
 * import { Button, Badge } from "@/components/atoms";
 * import { Card, FormField } from "@/components/molecules";
 * import { Dialog, DataTable } from "@/components/organisms";
 *
 * // 기존 방식 (하위 호환)
 * import { Badge, Card, Dialog } from "@/components/ui";
 */

// ============================================
// Atoms로 마이그레이션된 컴포넌트
// ============================================

// Badge → atoms/Badge (개선됨)
export { Badge } from "../atoms/Badge";

// Button → atoms/Button (마이그레이션 완료)
// @deprecated components/ui/button.tsx는 삭제되었습니다.
// 대신 @/components/atoms/Button을 사용하세요.
// export { Button } from "../atoms/Button"; // 필요시 직접 import

// LoadingSkeleton → atoms/Skeleton (개선됨)
export { LoadingSkeleton } from "./LoadingSkeleton";

// ProgressBar → atoms/ProgressBar (개선됨)
export { ProgressBar } from "../atoms/ProgressBar";

// ============================================
// Molecules로 마이그레이션된 컴포넌트
// ============================================

// Card → molecules/Card (개선됨)
export { Card, CardHeader, CardContent, CardFooter } from "../molecules/Card";

// EmptyState → molecules/EmptyState (마이그레이션 완료)
// @deprecated components/ui/EmptyState.tsx는 삭제되었습니다.
// 대신 @/components/molecules/EmptyState를 사용하세요.
// export { EmptyState } from "../molecules/EmptyState"; // 필요시 직접 import

// ErrorState → molecules/ErrorState (개선됨)
export { ErrorState } from "./ErrorState";

// FormInput → molecules/FormField (개선됨)
export { default as FormInput } from "./FormInput";

// SectionHeader → molecules/SectionHeader (개선됨)
export { SectionHeader } from "./SectionHeader";

// Toast → molecules/Toast (개선됨)
export { Toast } from "../molecules/Toast";

// ============================================
// Organisms로 마이그레이션된 컴포넌트
// ============================================

// Dialog → organisms/Dialog (개선됨)
export { Dialog, DialogContent, DialogFooter } from "./Dialog";

// ToastProvider → organisms/ToastContainer (개선됨)
export { ToastProvider, useToast } from "./ToastProvider";

// ============================================
// 아직 마이그레이션되지 않은 컴포넌트
// ============================================

// Form 관련 (기존 유지)
export { default as FormMessage } from "./FormMessage";
export { default as FormSubmitButton } from "./FormSubmitButton";

// 도메인 특화 컴포넌트 (기존 유지)
export { default as SchoolSelect } from "./SchoolSelect";
export { default as SchoolMultiSelect } from "./SchoolMultiSelect";
export { TimeRangeInput } from "./TimeRangeInput";
export { SkeletonForm } from "./SkeletonForm";

// 설정 페이지 컴포넌트
export { SectionCard } from "./SectionCard";
export { StickySaveButton } from "./StickySaveButton";

