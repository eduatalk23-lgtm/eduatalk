/**
 * Navigation - 네비게이션 컴포넌트
 *
 * 사이트 네비게이션을 위한 컴포넌트들을 제공합니다.
 *
 * ## 컴포넌트 개요
 *
 * 1. **CommandPalette** - VS Code 스타일 커맨드 팔레트
 *    - Cmd+K / Ctrl+K로 열기
 *    - 검색 및 명령어 실행
 *
 * 2. **Breadcrumb** - 빵가루 네비게이션
 *    - 현재 위치 표시
 *    - 드롭다운 메뉴 지원
 *
 * @module navigation
 */

// ============================================================================
// CommandPalette
// ============================================================================

export {
  CommandPaletteProvider,
  CommandPaletteTrigger,
  useCommandPalette,
  usePageCommands,
  createNavigationCommands,
  type Command,
  type CommandType,
  type CommandGroup,
  type CommandPaletteProviderProps,
} from "./CommandPalette";

// ============================================================================
// Breadcrumb
// ============================================================================

export {
  Breadcrumb,
  AdminBreadcrumb,
  StudentBreadcrumb,
  useAutoBreadcrumb,
  type BreadcrumbItem,
  type BreadcrumbMenuItem,
  type BreadcrumbProps,
} from "./Breadcrumb";
