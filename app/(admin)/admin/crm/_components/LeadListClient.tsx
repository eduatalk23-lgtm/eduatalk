"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button";
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

      <LeadTable leads={leads} />

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
