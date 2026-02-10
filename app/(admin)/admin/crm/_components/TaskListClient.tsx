"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button";
import type { LeadTaskWithLead } from "@/lib/domains/crm/types";
import { TaskTable } from "./TaskTable";
import { TaskFormDialog } from "./TaskFormDialog";

type TaskListClientProps = {
  tasks: LeadTaskWithLead[];
  adminUsers: { id: string; name: string }[];
  defaultLeadId?: string;
};

export function TaskListClient({
  tasks,
  adminUsers,
  defaultLeadId,
}: TaskListClientProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {defaultLeadId && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setShowForm(true)}>
            새 태스크
          </Button>
        </div>
      )}

      <TaskTable tasks={tasks} />

      {defaultLeadId && (
        <TaskFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          leadId={defaultLeadId}
          adminUsers={adminUsers}
        />
      )}
    </>
  );
}
