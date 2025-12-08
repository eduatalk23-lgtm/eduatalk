"use client";

import { createContext, useContext, useState, useTransition, ReactNode, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { deleteBooks, deleteLectures } from "@/app/(student)/actions/contentActions";

type TabKey = "books" | "lectures";

type SelectionContextType = {
  selectedIds: Set<string>;
  select: (id: string, checked: boolean) => void;
  selectAll: (checked: boolean, allIds: string[]) => void;
  cancel: () => void;
  deleteSelected: () => void;
  isPending: boolean;
  activeTab: TabKey;
};

const SelectionContext = createContext<SelectionContextType | null>(null);

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within SelectionProvider");
  }
  return context;
}

type SelectionProviderProps = {
  children: ReactNode;
  activeTab: TabKey;
};

export function SelectionProvider({ children, activeTab }: SelectionProviderProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const select = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((checked: boolean, allIds: string[]) => {
    if (checked) {
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const cancel = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      return;
    }

    const ids = Array.from(selectedIds);
    const count = ids.length;
    
    if (!confirm(`선택한 ${count}개의 ${activeTab === "books" ? "책" : "강의"}을 삭제하시겠습니까?`)) {
      return;
    }

    startTransition(async () => {
      try {
        if (activeTab === "books") {
          await deleteBooks(ids);
        } else {
          await deleteLectures(ids);
        }
        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "콘텐츠 삭제에 실패했습니다."
        );
      }
    });
  }, [selectedIds.size, activeTab, router]);

  // Context value를 메모이제이션하여 불필요한 리렌더링 방지
  const contextValue = useMemo(
    () => ({
      selectedIds,
      select,
      selectAll,
      cancel,
      deleteSelected,
      isPending,
      activeTab,
    }),
    [selectedIds, select, selectAll, cancel, deleteSelected, isPending, activeTab]
  );

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
}

