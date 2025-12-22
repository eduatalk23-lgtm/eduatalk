/**
 * Content 도메인 Public API
 *
 * 콘텐츠 관련 기능을 통합합니다:
 * - 마스터 콘텐츠 (관리자가 등록한 공용 콘텐츠)
 * - 학생 콘텐츠 (학생이 등록한 개인 콘텐츠)
 * - 콘텐츠 메타데이터 (출판사, 플랫폼 등)
 *
 * Note: CRUD 작업은 ./actions의 Server Actions 사용을 권장합니다.
 *
 * IMPORTANT: 데이터 레이어 함수(lib/data/*)는 서버 전용 코드를 사용하므로
 * 클라이언트 컴포넌트에서 직접 import할 수 없습니다.
 * 서버 컴포넌트에서만 직접 import 필요: import { ... } from "@/lib/data/studentContents"
 */

// Types only (re-export from data layer - safe for client)
export type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";

// Server Actions (CRUD 작업용 - 클라이언트 컴포넌트에서 사용)
export * from "./actions";
