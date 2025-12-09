"use client";

import { SelectionProvider, useSelection } from "./SelectionContext";
import { SelectionToolbar } from "./SelectionToolbar";

type TabKey = "books" | "lectures" | "custom";

type ContentsListWrapperProps = {
  activeTab: TabKey;
  children: React.ReactNode;
};

function ContentsListContent({ children }: { children: React.ReactNode }) {
  const { selectedIds, cancel, deleteSelected, isPending } = useSelection();
  const hasSelection = selectedIds.size > 0;

  return (
    <div>
      {/* 선택 모드 툴바 */}
      {hasSelection && (
        <SelectionToolbar
          count={selectedIds.size}
          onCancel={cancel}
          onDelete={deleteSelected}
          isPending={isPending}
        />
      )}

      {children}
    </div>
  );
}

export function ContentsListWrapper({ activeTab, children }: ContentsListWrapperProps) {
  return (
    <SelectionProvider activeTab={activeTab}>
      <ContentsListContent>{children}</ContentsListContent>
    </SelectionProvider>
  );
}

