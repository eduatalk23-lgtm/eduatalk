"use client";

import { useSearchParams } from "next/navigation";
import { ContentTabs } from "./ContentTabs";
import { ContentDetailActions } from "./ContentDetailActions";

type TabItem = {
  key: string;
  label: string;
};

type ContentDetailTabsWrapperProps = {
  tabs: TabItem[];
  defaultTab?: string;
  backHref: string;
  backLabel?: string;
  deleteAction?: () => void;
  deleteLabel?: string;
  additionalActions?: React.ReactNode;
  children: (activeTab: string) => React.ReactNode;
};

export function ContentDetailTabsWrapper({
  tabs,
  defaultTab,
  backHref,
  backLabel,
  deleteAction,
  deleteLabel,
  additionalActions,
  children,
}: ContentDetailTabsWrapperProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || defaultTab || tabs[0]?.key;

  return (
    <div className="flex flex-col gap-6">
      <ContentDetailActions
        backHref={backHref}
        backLabel={backLabel}
        deleteAction={deleteAction}
        deleteLabel={deleteLabel}
        additionalActions={additionalActions}
      />

      <ContentTabs tabs={tabs} defaultTab={defaultTab} />

      {children(activeTab || "")}
    </div>
  );
}









