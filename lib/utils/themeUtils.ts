/**
 * 테마 관련 유틸리티 클래스
 * 
 * @deprecated 이 파일은 더 이상 사용되지 않습니다.
 * 모든 기능은 @/lib/utils/darkMode로 마이그레이션되었습니다.
 * 
 * 이 파일은 darkMode.ts의 re-export만 제공하며, 새로운 코드에서는
 * @/lib/utils/darkMode에서 직접 import하세요.
 * 
 * themeClasses 객체는 더 이상 제공되지 않습니다.
 * 대신 darkMode.ts의 다음 함수들을 사용하세요:
 * - bgSurface, borderDefault, cardBase (카드 스타일)
 * - textPrimary, textSecondary, textTertiary (텍스트 색상)
 * - 기타 유틸리티 함수들
 */

// darkMode.ts의 모든 export를 re-export (하위 호환성)
export * from "./darkMode";

