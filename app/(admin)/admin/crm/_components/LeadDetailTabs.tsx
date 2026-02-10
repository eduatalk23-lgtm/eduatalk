"use client";

import { useState } from "react";
import { Tabs, TabPanel } from "@/components/molecules/Tabs";
import type {
  SalesLeadWithRelations,
  LeadActivity,
  LeadTaskWithLead,
  LeadScoreLog,
  Program,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";
import { LeadOverviewTab } from "./LeadOverviewTab";
import { LeadActivitiesTab } from "./LeadActivitiesTab";
import { LeadTasksTab } from "./LeadTasksTab";
import { LeadScoreTab } from "./LeadScoreTab";

type LeadDetailTabsProps = {
  lead: SalesLeadWithRelations;
  activities: CrmPaginatedResult<LeadActivity>;
  tasks: CrmPaginatedResult<LeadTaskWithLead>;
  scoreLogs: CrmPaginatedResult<LeadScoreLog>;
  programs: Program[];
  adminUsers: { id: string; name: string }[];
  resolvedSchoolName?: string | null;
};

export function LeadDetailTabs({
  lead,
  activities,
  tasks,
  scoreLogs,
  programs,
  adminUsers,
  resolvedSchoolName,
}: LeadDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "개요" },
    { id: "activities", label: "활동", badge: activities.totalCount },
    { id: "tasks", label: "태스크", badge: tasks.totalCount },
    { id: "score", label: "스코어" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="line"
      />

      <TabPanel tabId="overview" activeTab={activeTab}>
        <LeadOverviewTab
          lead={lead}
          programs={programs}
          adminUsers={adminUsers}
          resolvedSchoolName={resolvedSchoolName}
        />
      </TabPanel>

      <TabPanel tabId="activities" activeTab={activeTab}>
        <LeadActivitiesTab lead={lead} activities={activities} />
      </TabPanel>

      <TabPanel tabId="tasks" activeTab={activeTab}>
        <LeadTasksTab
          lead={lead}
          tasks={tasks}
          adminUsers={adminUsers}
        />
      </TabPanel>

      <TabPanel tabId="score" activeTab={activeTab}>
        <LeadScoreTab lead={lead} scoreLogs={scoreLogs} />
      </TabPanel>
    </div>
  );
}
