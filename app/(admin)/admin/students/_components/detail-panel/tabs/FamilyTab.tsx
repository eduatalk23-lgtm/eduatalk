"use client";

import { ConnectionSection } from "../../../[id]/_components/ConnectionSection";

export function FamilyTab({ studentId }: { studentId: string }) {
  // key 로 학생 전환 시 리마운트하여 stale 데이터 flash 방지
  return <ConnectionSection key={studentId} studentId={studentId} />;
}
