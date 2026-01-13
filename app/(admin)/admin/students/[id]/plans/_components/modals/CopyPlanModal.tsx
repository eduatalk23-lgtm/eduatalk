'use client';

import { useState, useTransition, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { copyPlansToDate } from '@/lib/domains/admin-plan/actions/copyPlan';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import { VALIDATION, ERROR, formatError, formatCopySuccess } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface CopyPlanModalProps {
  planIds: string[];
  studentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanInfo {
  id: string;
  content_title: string | null;
  custom_title: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  plan_date: string;
}

export function CopyPlanModal({
  planIds,
  studentId,
  onClose,
  onSuccess,
}: CopyPlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateString(tomorrow);
  });
  const { showSuccess, showError } = useToast();

  // 플랜 정보 로드
  useEffect(() => {
    async function fetchPlans() {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          custom_title,
          planned_start_page_or_time,
          planned_end_page_or_time,
          plan_date
        `)
        .in('id', planIds);

      if (!error && data) {
        setPlans(data);
      }
      setIsLoading(false);
    }

    fetchPlans();
  }, [planIds]);

  const handleAddDate = () => {
    if (dateInput && !targetDates.includes(dateInput)) {
      setTargetDates([...targetDates, dateInput].sort());
    }
  };

  const handleRemoveDate = (date: string) => {
    setTargetDates(targetDates.filter((d) => d !== date));
  };

  const handleSubmit = async () => {
    if (targetDates.length === 0) {
      showError(VALIDATION.SELECT_DATES);
      return;
    }

    startTransition(async () => {
      const result = await copyPlansToDate({
        sourcePlanIds: planIds,
        targetDates,
        studentId,
      });

      if (result.success) {
        showSuccess(formatCopySuccess(planIds.length, targetDates.length));
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.PLAN_COPY));
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${month}/${day} (${days[date.getDay()]})`;
  };

  const totalCopies = plans.length * targetDates.length;

  // 로딩 스켈레톤
  const loadingContent = (
    <div className="p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    </div>
  );

  // 메인 콘텐츠
  const mainContent = (
    <div className="p-4 space-y-4">
      {/* 선택된 플랜 목록 */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">
          복사할 플랜 ({plans.length}개)
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {plans.map((plan) => {
            const range =
              plan.planned_start_page_or_time && plan.planned_end_page_or_time
                ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
                : null;

            return (
              <div
                key={plan.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
              >
                <span className="truncate">
                  {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                </span>
                {range && <span className="text-gray-500 shrink-0 ml-2">{range}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 날짜 선택 */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">
          복사할 날짜 선택
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={handleAddDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {/* 선택된 날짜 목록 */}
      {targetDates.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            선택된 날짜 ({targetDates.length}개)
          </div>
          <div className="flex flex-wrap gap-2">
            {targetDates.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {formatDate(date)}
                <button
                  onClick={() => handleRemoveDate(date)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 */}
      {totalCopies > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>{plans.length}</strong>개 플랜 ×{' '}
            <strong>{targetDates.length}</strong>개 날짜 ={' '}
            <strong>{totalCopies}</strong>개의 새 플랜이 생성됩니다
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="플랜 복사"
      subtitle={`${plans.length}개 플랜을 다른 날짜로 복사합니다`}
      icon={<Copy className="h-5 w-5" />}
      theme="blue"
      size="md"
      loading={isPending}
      footer={
        !isLoading && (
          <>
            <ModalButton variant="secondary" onClick={onClose}>
              취소
            </ModalButton>
            <ModalButton
              theme="blue"
              onClick={handleSubmit}
              disabled={targetDates.length === 0}
              loading={isPending}
            >
              {totalCopies}개 플랜 복사
            </ModalButton>
          </>
        )
      }
    >
      {isLoading ? loadingContent : mainContent}
    </ModalWrapper>
  );
}
