"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button";
import { EmptyState } from "@/components/molecules/EmptyState";
import type { SalesLeadWithRelations, Program } from "@/lib/domains/crm/types";
import { LeadTable } from "./LeadTable";
import { ConsultationFormDialog } from "./ConsultationFormDialog";

type LeadListClientProps = {
  leads: SalesLeadWithRelations[];
  programs: Program[];
  adminUsers: { id: string; name: string }[];
  currentUserId: string;
};

export function LeadListClient({
  leads,
  programs,
  adminUsers,
  currentUserId,
}: LeadListClientProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowForm(true)}>
          리드/상담 등록
        </Button>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          title="리드가 없습니다"
          description="조건에 맞는 리드가 없습니다."
        />
      ) : (
        <LeadTable leads={leads} />
      )}

      <ConsultationFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        programs={programs}
        adminUsers={adminUsers}
        currentUserId={currentUserId}
      />
    </>
  );
}
