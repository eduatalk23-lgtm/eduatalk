"use client";

import { useRef, useEffect } from "react";
import { PlanScheduleView, type PlanScheduleViewRef } from "./PlanScheduleView";

type Step7DetailViewProps = {
  groupId: string;
  onScheduleViewReady?: (ref: PlanScheduleViewRef | null) => void;
};

export function Step7DetailView({ groupId, onScheduleViewReady }: Step7DetailViewProps) {
  const scheduleViewRef = useRef<PlanScheduleViewRef>(null);

  // ref가 준비되면 부모 컴포넌트에 전달
  useEffect(() => {
    if (onScheduleViewReady) {
      onScheduleViewReady(scheduleViewRef.current);
    }
  }, [onScheduleViewReady]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">스케줄 결과</h2>
        <p className="mt-1 text-sm text-gray-500">
          생성된 학습 플랜을 확인할 수 있습니다.
        </p>
      </div>

      <PlanScheduleView ref={scheduleViewRef} groupId={groupId} />
    </div>
  );
}

