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
