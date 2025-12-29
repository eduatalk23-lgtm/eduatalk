import { Dialog } from "@/components/ui/Dialog";

type BlockSetHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BlockSetHelpDialog({ open, onOpenChange }: BlockSetHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          블록 세트란?
        </h3>
        <p className="text-sm text-gray-600">
          블록 세트는 학습 가능한 시간대를 미리 정의해둔 템플릿입니다.
          <br />
          학생의 생활 패턴(학교 등교, 학원 시간 등)을 고려하여 학습 가능한
          시간을 설정하면, 해당 시간 내에서 콘텐츠가 자동으로 배정됩니다.
        </p>
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
          <h4 className="text-sm font-medium text-gray-900">
            사용 예시
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
            <li>
              <strong>학기중 (평일):</strong> 방과 후 17:00 ~ 22:00
            </li>
            <li>
              <strong>학기중 (주말):</strong> 오전 10:00 ~ 22:00
            </li>
            <li>
              <strong>방학중:</strong> 오전 09:00 ~ 22:00
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
