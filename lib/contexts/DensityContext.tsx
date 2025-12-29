"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * 정보 밀도 레벨
 *
 * - compact: 최소 간격, 작은 텍스트 (데이터 집약적 뷰)
 * - normal: 기본 간격 (균형잡힌 뷰)
 * - comfortable: 넓은 간격, 큰 터치 타겟 (여유로운 뷰)
 */
export type DensityLevel = "compact" | "normal" | "comfortable";

export interface DensityContextValue {
  /** 현재 밀도 레벨 */
  density: DensityLevel;
  /** 밀도 레벨 변경 */
  setDensity: (density: DensityLevel) => void;
  /** 밀도별 클래스 가져오기 */
  getDensityClasses: (type: DensityClassType) => string;
  /** 밀도별 값 가져오기 */
  getDensityValue: <T>(values: DensityValues<T>) => T;
}

export type DensityClassType =
  | "padding"
  | "gap"
  | "text"
  | "tableRow"
  | "cardPadding"
  | "listItem"
  | "buttonSize"
  | "iconSize";

export type DensityValues<T> = {
  compact: T;
  normal: T;
  comfortable: T;
};

// ============================================================================
// Constants
// ============================================================================

const DENSITY_STORAGE_KEY = "ui-density";

/**
 * 밀도별 Tailwind 클래스 정의
 */
export const densityClasses: Record<DensityClassType, DensityValues<string>> = {
  // 기본 패딩
  padding: {
    compact: "p-2",
    normal: "p-4",
    comfortable: "p-6",
  },
  // 기본 간격
  gap: {
    compact: "gap-2",
    normal: "gap-4",
    comfortable: "gap-6",
  },
  // 텍스트 크기
  text: {
    compact: "text-xs",
    normal: "text-sm",
    comfortable: "text-base",
  },
  // 테이블 행
  tableRow: {
    compact: "py-1 px-2",
    normal: "py-2 px-4",
    comfortable: "py-4 px-6",
  },
  // 카드 패딩
  cardPadding: {
    compact: "p-3",
    normal: "p-4 md:p-5",
    comfortable: "p-6 md:p-8",
  },
  // 리스트 아이템
  listItem: {
    compact: "py-1.5 px-2",
    normal: "py-2.5 px-3",
    comfortable: "py-4 px-4",
  },
  // 버튼 크기
  buttonSize: {
    compact: "h-7 px-2 text-xs",
    normal: "h-9 px-4 text-sm",
    comfortable: "h-11 px-6 text-base",
  },
  // 아이콘 크기
  iconSize: {
    compact: "size-4",
    normal: "size-5",
    comfortable: "size-6",
  },
};

/**
 * 밀도별 수치 값 (px)
 */
export const densityValues = {
  // 기본 간격 (px)
  spacing: {
    compact: 8,
    normal: 16,
    comfortable: 24,
  } as DensityValues<number>,
  // 테이블 행 높이 (px)
  tableRowHeight: {
    compact: 32,
    normal: 44,
    comfortable: 56,
  } as DensityValues<number>,
  // 아이콘 크기 (px)
  iconSize: {
    compact: 16,
    normal: 20,
    comfortable: 24,
  } as DensityValues<number>,
  // 폰트 크기 (px)
  fontSize: {
    compact: 12,
    normal: 14,
    comfortable: 16,
  } as DensityValues<number>,
};

// ============================================================================
// Context
// ============================================================================

const DensityContext = createContext<DensityContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface DensityProviderProps {
  children: ReactNode;
  /** 초기 밀도 (기본값: normal) */
  defaultDensity?: DensityLevel;
  /** localStorage에 저장 여부 */
  persist?: boolean;
}

/**
 * 밀도 컨텍스트 프로바이더
 *
 * 애플리케이션 전체의 정보 밀도를 관리합니다.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { DensityProvider } from "@/lib/contexts/DensityContext";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <DensityProvider defaultDensity="normal" persist>
 *       {children}
 *     </DensityProvider>
 *   );
 * }
 * ```
 */
export function DensityProvider({
  children,
  defaultDensity = "normal",
  persist = true,
}: DensityProviderProps) {
  // 초기값을 lazy initializer로 설정
  const [density, setDensityState] = useState<DensityLevel>(() => {
    // SSR에서는 기본값 반환
    if (typeof window === "undefined") {
      return defaultDensity;
    }
    // 클라이언트에서 localStorage 확인
    if (persist) {
      const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (stored && ["compact", "normal", "comfortable"].includes(stored)) {
        return stored as DensityLevel;
      }
    }
    return defaultDensity;
  });

  // 밀도 변경 및 저장
  const setDensity = useCallback(
    (newDensity: DensityLevel) => {
      setDensityState(newDensity);
      if (persist && typeof window !== "undefined") {
        localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
      }
    },
    [persist]
  );

  // 밀도별 클래스 가져오기
  const getDensityClasses = useCallback(
    (type: DensityClassType): string => {
      return densityClasses[type][density];
    },
    [density]
  );

  // 밀도별 값 가져오기
  const getDensityValue = useCallback(
    <T,>(values: DensityValues<T>): T => {
      return values[density];
    },
    [density]
  );

  return (
    <DensityContext.Provider
      value={{
        density,
        setDensity,
        getDensityClasses,
        getDensityValue,
      }}
    >
      {children}
    </DensityContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 밀도 컨텍스트 훅
 *
 * @example
 * ```tsx
 * import { useDensity } from "@/lib/contexts/DensityContext";
 *
 * function MyComponent() {
 *   const { density, getDensityClasses } = useDensity();
 *
 *   return (
 *     <div className={getDensityClasses("padding")}>
 *       현재 밀도: {density}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error("useDensity must be used within a DensityProvider");
  }
  return context;
}

/**
 * 밀도 컨텍스트 훅 (선택적)
 *
 * Provider 없이도 기본값 반환
 */
export function useDensityOptional(): DensityContextValue {
  const context = useContext(DensityContext);
  if (!context) {
    // 기본값 반환
    return {
      density: "normal",
      setDensity: () => {},
      getDensityClasses: (type) => densityClasses[type].normal,
      getDensityValue: (values) => values.normal,
    };
  }
  return context;
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * 밀도 선택기 컴포넌트
 *
 * @example
 * ```tsx
 * <DensitySelector />
 * ```
 */
export function DensitySelector({
  className,
  showLabels = false,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  const { density, setDensity } = useDensity();

  const options: { value: DensityLevel; label: string; icon: string }[] = [
    { value: "compact", label: "좁게", icon: "▪" },
    { value: "normal", label: "보통", icon: "◼" },
    { value: "comfortable", label: "넓게", icon: "⬛" },
  ];

  return (
    <div className={`inline-flex items-center gap-1 ${className || ""}`}>
      {showLabels && (
        <span className="mr-2 text-sm text-gray-500 dark:text-gray-400">밀도:</span>
      )}
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setDensity(option.value)}
            className={`
              px-2 py-1 text-xs font-medium rounded-md transition-colors
              ${
                density === option.value
                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }
            `}
            title={option.label}
            aria-pressed={density === option.value}
          >
            {showLabels ? option.label : option.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 밀도 기반 클래스 생성 유틸리티
 *
 * 컨텍스트 없이 직접 클래스를 생성할 때 사용
 *
 * @example
 * ```tsx
 * const classes = getDensityClassesStatic("normal", "padding");
 * // => "p-4"
 * ```
 */
export function getDensityClassesStatic(
  density: DensityLevel,
  type: DensityClassType
): string {
  return densityClasses[type][density];
}

/**
 * 밀도 기반 값 선택 유틸리티
 *
 * @example
 * ```tsx
 * const spacing = getDensityValueStatic("compact", densityValues.spacing);
 * // => 8
 * ```
 */
export function getDensityValueStatic<T>(
  density: DensityLevel,
  values: DensityValues<T>
): T {
  return values[density];
}
