"use client";

/**
 * 플랜 뷰 컨텍스트
 *
 * 다중 뷰 시스템의 상태를 관리합니다.
 * - 현재 뷰 타입
 * - 뷰 설정
 * - 저장된 뷰 목록
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type {
  ViewType,
  ViewSettings,
  PlanView,
  ViewContextValue,
} from "@/lib/types/plan/views";
import { DEFAULT_VIEW_SETTINGS } from "@/lib/types/plan/views";
import {
  getSavedViews,
  saveView as saveViewAction,
  deleteView as deleteViewAction,
  updateView,
} from "./actions";

// ============================================
// 컨텍스트 정의
// ============================================

const ViewContext = createContext<ViewContextValue | null>(null);

// ============================================
// Provider 컴포넌트
// ============================================

interface ViewProviderProps {
  children: ReactNode;
  initialView?: ViewType;
  initialSettings?: ViewSettings;
  savedViews?: PlanView[];
}

export function ViewProvider({
  children,
  initialView = "calendar",
  initialSettings,
  savedViews: initialSavedViews = [],
}: ViewProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL에서 뷰 타입 읽기
  const urlView = searchParams.get("view") as ViewType | null;

  // 상태
  const [currentView, setCurrentViewState] = useState<ViewType>(
    urlView || initialView
  );
  const [settings, setSettings] = useState<ViewSettings>(
    initialSettings || DEFAULT_VIEW_SETTINGS
  );
  const [savedViews, setSavedViews] = useState<PlanView[]>(initialSavedViews);
  const [selectedViewId, setSelectedViewId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  // URL과 상태 동기화
  useEffect(() => {
    if (urlView && urlView !== currentView) {
      setCurrentViewState(urlView);
    }
  }, [urlView, currentView]);

  // 저장된 뷰 로드
  useEffect(() => {
    async function loadViews() {
      const result = await getSavedViews();
      if (result.success && result.data) {
        setSavedViews(result.data);

        // 기본 뷰가 있으면 적용
        const defaultView = result.data.find((v) => v.isDefault);
        if (defaultView && !urlView) {
          setCurrentViewState(defaultView.viewType);
          setSettings(defaultView.settings);
          setSelectedViewId(defaultView.id);
        }
      }
    }

    if (initialSavedViews.length === 0) {
      loadViews();
    }
  }, [initialSavedViews.length, urlView]);

  // 뷰 타입 변경
  const setViewType = useCallback(
    (type: ViewType) => {
      setCurrentViewState(type);

      // URL 업데이트
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", type);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // 설정 업데이트
  const updateSettings = useCallback((newSettings: Partial<ViewSettings>) => {
    setSettings((prev) => {
      const updated: ViewSettings = {
        ...prev,
        ...newSettings,
      };

      if (newSettings.filters) {
        updated.filters = { ...prev.filters, ...newSettings.filters };
      }
      if (newSettings.display) {
        updated.display = { ...prev.display, ...newSettings.display };
      }
      if (newSettings.matrix) {
        updated.matrix = {
          startHour: newSettings.matrix.startHour ?? prev.matrix?.startHour ?? 8,
          endHour: newSettings.matrix.endHour ?? prev.matrix?.endHour ?? 22,
          slotDuration: newSettings.matrix.slotDuration ?? prev.matrix?.slotDuration ?? 50,
          showWeekends: newSettings.matrix.showWeekends ?? prev.matrix?.showWeekends ?? false,
        };
      }

      return updated;
    });
  }, []);

  // 뷰 저장
  const saveView = useCallback(
    async (name: string) => {
      setIsLoading(true);
      try {
        const result = await saveViewAction({
          name,
          viewType: currentView,
          settings,
        });

        if (result.success && result.data) {
          setSavedViews((prev) => [result.data!, ...prev]);
          setSelectedViewId(result.data.id);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [currentView, settings]
  );

  // 뷰 불러오기
  const loadView = useCallback(
    (viewId: string) => {
      const view = savedViews.find((v) => v.id === viewId);
      if (view) {
        setCurrentViewState(view.viewType);
        setSettings(view.settings);
        setSelectedViewId(viewId);

        // URL 업데이트
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", view.viewType);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    },
    [savedViews, pathname, router, searchParams]
  );

  // 뷰 삭제
  const deleteViewHandler = useCallback(async (viewId: string) => {
    setIsLoading(true);
    try {
      const result = await deleteViewAction(viewId);
      if (result.success) {
        setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
        setSelectedViewId(undefined);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 기본 뷰로 설정
  const setDefaultView = useCallback(async (viewId: string) => {
    setIsLoading(true);
    try {
      const result = await updateView(viewId, { isDefault: true });
      if (result.success) {
        setSavedViews((prev) =>
          prev.map((v) => ({
            ...v,
            isDefault: v.id === viewId,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: ViewContextValue = {
    currentView,
    settings,
    savedViews,
    selectedViewId,
    isLoading,
    setViewType,
    updateSettings,
    saveView,
    loadView,
    deleteView: deleteViewHandler,
    setDefaultView,
  };

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useView(): ViewContextValue {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useView must be used within a ViewProvider");
  }
  return context;
}

/**
 * 선택적 뷰 컨텍스트 (Provider 없이도 사용 가능)
 */
export function useOptionalView(): ViewContextValue | null {
  return useContext(ViewContext);
}
