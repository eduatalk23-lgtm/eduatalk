/**
 * 콘텐츠 마스터 데이터 액세스 레이어
 *
 * master_books, master_lectures 테이블 사용
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 *
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 * 실제 구현은 contentMasters/ 디렉토리에서 모듈별로 분리되어 있습니다.
 *
 * @see contentMasters/books - 교재 관련 함수
 * @see contentMasters/lectures - 강의 관련 함수
 * @see contentMasters/custom - 커스텀 콘텐츠 관련 함수
 * @see contentMasters/copy - 콘텐츠 복사 함수
 * @see contentMasters/filters - 필터 옵션 조회 함수
 * @see contentMasters/hybrid - 통합 함수 (하위 호환성)
 */

// Re-export all from modular structure
export * from "./contentMasters/index";
