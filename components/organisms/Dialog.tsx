/**
 * @deprecated 이 파일은 components/ui/Dialog.tsx로 통합되었습니다.
 * 모든 import는 @/components/ui/Dialog로 변경해주세요.
 * 
 * 이 파일은 하위 호환성을 위해 re-export만 제공합니다.
 */

import { Dialog } from "@/components/ui/Dialog";

export {
  Dialog,
  DialogContent,
  DialogFooter,
  ConfirmDialog,
  type DialogSize,
} from "@/components/ui/Dialog";

export type { DialogProps } from "@/components/ui/Dialog";

// Legacy type exports
export type { DialogContentProps, DialogFooterProps, ConfirmDialogProps } from "@/components/ui/Dialog";

export default Dialog;

