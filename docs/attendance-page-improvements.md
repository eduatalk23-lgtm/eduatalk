# 출석 관리 페이지 개선 작업

## 개요

`/admin/attendance` 페이지의 기능 및 UI/UX 문제점을 해결하고, 코드 중복을 제거하여 유지보수성을 향상시켰습니다.

**작업 일자**: 2024-12-15

## 주요 개선 사항

### Phase 1: 통계 계산 수정 ✅

#### 문제점
- 페이지네이션된 데이터만으로 통계를 계산하여 부정확한 결과 표시
- 통계 계산 로직이 여러 곳에 중복되어 있음

#### 해결 방법

1. **통계 계산 유틸리티 함수 생성**
   - 파일: `lib/domains/attendance/utils.ts` (신규)
   - `calculateStatsFromRecords()` 함수로 통계 계산 로직 통합

2. **필터 기반 통계 계산 함수 추가**
   - 파일: `lib/domains/attendance/service.ts`
   - `calculateAttendanceStatsWithFilters()` 함수 추가
   - 필터링된 전체 데이터를 기반으로 통계 계산

3. **페이지 통계 계산 로직 수정**
   - 파일: `app/(admin)/admin/attendance/page.tsx`
   - 필터 기반 통계 계산 함수 사용으로 변경
   - 페이지네이션된 데이터가 아닌 필터링된 전체 데이터로 통계 계산

### Phase 2: 데이터 갱신 개선 ✅

#### 문제점
- 출석 기록 입력 후 목록이 자동으로 갱신되지 않음
- 사용자가 수동으로 새로고침해야 함

#### 해결 방법

1. **React Query 훅 생성**
   - 파일: `lib/hooks/useAttendance.ts` (신규)
   - `useRecordAttendance()` 훅 생성
   - 성공 시 출석 목록 및 통계 쿼리 자동 무효화

2. **출석 기록 폼에 React Query 적용**
   - 파일: `app/(admin)/admin/attendance/_components/AttendanceRecordForm.tsx`
   - `useTransition` 대신 `useMutation` 사용
   - 출석 기록 저장 후 자동으로 목록 및 통계 갱신

### Phase 3: 학생 검색 제한 해결 ✅

#### 문제점
- 학생 검색 시 100명 제한으로 인해 검색 누락 가능
- 출석 기록 입력 폼에서도 100명 제한

#### 해결 방법

1. **학생 검색 제한 확대**
   - 파일: `app/(admin)/admin/attendance/page.tsx`
   - `.limit(100)` → `.range(0, 999)` 변경
   - 최대 1000명까지 조회 가능하도록 개선

### Phase 4: UI/UX 개선 ✅

#### 문제점
1. 필터 옵션이 많아 UI가 복잡함
2. 통계 카드 스타일 불일치 (첫 번째 그리드와 두 번째 그리드)
3. 페이지네이션 정보 부족 (전체 개수, 현재 범위 미표시)

#### 해결 방법

1. **필터 UI 개선**
   - 파일: `app/(admin)/admin/attendance/_components/AttendanceSearchFilter.tsx`
   - 기본 필터와 고급 필터 분리
   - 접기/펼치기 기능 추가 (ChevronDown/ChevronUp 아이콘 사용)
   - 기본 필터: 학생명, 날짜, 상태
   - 고급 필터: 입실 방법, 정렬

2. **통계 카드 스타일 통일**
   - 파일: `app/(admin)/admin/attendance/_components/AttendanceStatistics.tsx`
   - 두 번째 그리드(5개)도 첫 번째 그리드와 동일한 카드 스타일 적용
   - `rounded-lg border border-gray-200 bg-white p-4` 스타일 통일

3. **페이지네이션 정보 보강**
   - 파일: `app/(admin)/admin/attendance/_components/AttendancePagination.tsx`
   - 전체 개수(`totalItems`), 페이지 크기(`pageSize`) props 추가
   - "1-20 / 총 150개" 형식으로 현재 범위 및 전체 개수 표시

## 수정된 파일 목록

### 신규 생성
- `lib/domains/attendance/utils.ts` - 통계 계산 유틸리티 함수
- `lib/hooks/useAttendance.ts` - 출석 관련 React Query 훅

### 수정
- `lib/domains/attendance/service.ts` - 필터 기반 통계 계산 함수 추가, 기존 함수 리팩토링
- `app/(admin)/admin/attendance/page.tsx` - 통계 계산 로직 수정, 학생 검색 제한 제거
- `app/(admin)/admin/attendance/_components/AttendanceRecordForm.tsx` - React Query 적용
- `app/(admin)/admin/attendance/_components/AttendanceSearchFilter.tsx` - 필터 UI 개선 (접기/펼치기)
- `app/(admin)/admin/attendance/_components/AttendanceStatistics.tsx` - 통계 카드 스타일 통일
- `app/(admin)/admin/attendance/_components/AttendancePagination.tsx` - 페이지네이션 정보 보강

## 기술 스택

- **React Query** (`@tanstack/react-query`): 서버 상태 관리 및 자동 갱신
- **Next.js 15**: App Router, Server Components
- **TypeScript**: 타입 안전성 보장

## 향후 개선 사항

### Phase 5: 코드 최적화 및 중복 제거 (우선순위: 낮음)
- [ ] 필터 컴포넌트 통합 (`AttendanceFilters.tsx` 삭제)
- [ ] 타입 정의 통합 확인

### Phase 6: 데이터베이스 최적화 (우선순위: 낮음)
- [ ] 인덱스 확인 및 추가
- [ ] SQL 집계 함수를 활용한 통계 계산 최적화

### 추가 기능 제안
- [ ] 체크박스 선택 항목 일괄 삭제 기능
- [ ] 체크박스 선택 항목 일괄 상태 변경 기능
- [ ] 모바일 최적화 (테이블 → 카드 레이아웃 변환)

## 테스트 체크리스트

- [x] 통계 계산이 필터링된 전체 데이터를 기반으로 정확하게 계산되는지 확인
- [x] 출석 기록 입력 후 목록이 자동으로 갱신되는지 확인
- [x] 학생 검색이 100명 이상에서도 정상 작동하는지 확인
- [x] 필터 접기/펼치기 기능이 정상 작동하는지 확인
- [x] 통계 카드 스타일이 통일되어 있는지 확인
- [x] 페이지네이션 정보가 올바르게 표시되는지 확인

## 참고 사항

- React Query는 이미 프로젝트에 설치되어 있었음 (`@tanstack/react-query`)
- Server Actions는 그대로 유지하되, 클라이언트에서 React Query로 래핑
- 기존 `revalidatePath`는 Server Action에 유지 (SSR 호환성)
- 학생 검색 제한은 1000명으로 확대 (대부분의 학원에서 충분한 범위)

