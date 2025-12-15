/**
 * 테마 관련 유틸리티 클래스
 * 
 * @deprecated 이 파일은 더 이상 사용되지 않으며, 향후 버전에서 삭제될 예정입니다.
 * 모든 기능은 @/lib/utils/darkMode로 마이그레이션되었습니다.
 * 
 * ⚠️ 새로운 코드에서는 절대 이 파일을 import하지 마세요.
 * 대신 @/lib/utils/darkMode에서 직접 import하세요.
 * 
 * 이 파일은 하위 호환성을 위해 darkMode.ts의 re-export만 제공합니다.
 * 
 * 마이그레이션 가이드:
 * - 이전: import { textPrimary } from "@/lib/utils/themeUtils"
 * - 이후: import { textPrimary } from "@/lib/utils/darkMode"
 * 
 * 사용 가능한 유틸리티 함수들 (darkMode.ts):
 * - bgSurface, borderDefault, cardBase (카드 스타일)
 * - textPrimary, textSecondary, textTertiary, textMuted (텍스트 색상)
 * - getBadgeStyle(), getRiskColorClasses() (특수 스타일)
 * - 기타 유틸리티 함수들
 */

// darkMode.ts의 모든 export를 re-export (하위 호환성)
// ⚠️ 이 re-export는 향후 제거될 예정입니다.
export * from "./darkMode";

