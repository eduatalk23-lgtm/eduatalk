'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getStudentPlannersAction } from '@/lib/domains/admin-plan/actions';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
import { useAIPlanModalActions, useAIPlanModalSelectors } from '../context/AIPlanModalContext';

interface Step1PlannerSelectionProps {
  studentId: string;
}

export function Step1PlannerSelection({ studentId }: Step1PlannerSelectionProps) {
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [isLoadingPlanners, setIsLoadingPlanners] = useState(true);

  const { selectedPlannerId } = useAIPlanModalSelectors();
  const { setPlanner, setPeriod, setError } = useAIPlanModalActions();

  // 플래너 목록 로드
  useEffect(() => {
    async function loadPlanners() {
      try {
        setIsLoadingPlanners(true);
        const result = await getStudentPlannersAction(studentId);
        if (result.data && result.data.length > 0) {
          setPlanners(result.data);
          // 플래너가 1개면 자동 선택
          if (result.data.length === 1) {
            const planner = result.data[0];
            setPlanner(planner.id);
            setPeriod(planner.periodStart, planner.periodEnd);
          }
        }
      } catch (err) {
        console.error('Failed to load planners:', err);
        setError('플래너 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoadingPlanners(false);
      }
    }
    loadPlanners();
  }, [studentId, setPlanner, setPeriod, setError]);

  function handlePlannerSelect(planner: Planner) {
    setPlanner(planner.id);
    setPeriod(planner.periodStart, planner.periodEnd);
    setError(null);
  }

  if (isLoadingPlanners) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className="mt-4 text-sm text-gray-500">플래너 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          플래너 선택 <span className="text-red-500">*</span>
        </label>

        {planners.length > 0 ? (
          <div className="space-y-2">
            {planners.map((planner) => {
              const isSelected = selectedPlannerId === planner.id;
              return (
                <button
                  key={planner.id}
                  onClick={() => handlePlannerSelect(planner)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-all',
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{planner.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {planner.periodStart} ~ {planner.periodEnd}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {planner.status === 'active' ? '활성' : planner.status === 'draft' ? '초안' : '일시정지'}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-purple-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            <p>사용 가능한 플래너가 없습니다.</p>
            <p className="text-sm mt-1">먼저 플래너를 생성해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
