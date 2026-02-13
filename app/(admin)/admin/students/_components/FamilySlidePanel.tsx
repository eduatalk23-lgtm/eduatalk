"use client";

import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { ConnectionSection } from "../[id]/_components/ConnectionSection";

type FamilySlidePanelProps = {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
};

export function FamilySlidePanel({
  studentId,
  isOpen,
  onClose,
}: FamilySlidePanelProps) {
  return (
    <SlideOverPanel
      id="family-panel"
      isOpen={isOpen}
      onClose={onClose}
      title="가족 관리"
      size="full"
      className="max-w-[66vw]"
    >
      {/* key로 학생 전환 시 리마운트하여 stale 데이터 flash 방지 */}
      <ConnectionSection key={studentId} studentId={studentId} />
    </SlideOverPanel>
  );
}
