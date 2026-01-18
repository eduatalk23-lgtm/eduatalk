# CampParticipantsList 컴포넌트 리팩토링

## 작업 일시
2025-02-05

## 작업 개요
`CampParticipantsList` 컴포넌트의 복잡도를 낮추고 가독성과 유지보수성을 향상시키기 위해 역할별로 분리하는 리팩토링을 진행했습니다.

## 작업 내용

### 1. 타입 정의 분리 (`types.ts`)
- 컴포넌트 내부에 정의된 타입들을 별도 파일로 분리
- `CampParticipantsListProps`, `SortColumn`, `SortOrder`, `StatusFilter`, `ParticipantsStats` 타입 정의
- `Participant` 타입은 기존 파일에서 re-export

### 2. 커스텀 훅 추출 (`useCampParticipantsLogic.ts`)
- 데이터 페칭 로직 (`loadParticipants`)
- 로딩 상태 관리
- 필터링 및 정렬 로직 (`filteredParticipants`)
- 선택 로직 (`selectedParticipantIds`, `handleSelectAll`, `handleToggleSelect`)
- 중복 로드 방지 로직 (`lastLoadTimeRef`, `isLoadingRef`)
- 통계 계산 (`stats`, `needsActionParticipants`)
- 일괄 작업 핸들러 (`handleBulkCreatePlanGroups`, `handleBatchConfirm`)
- 페이지 포커스 및 가시성 변경 이벤트 처리

### 3. UI 컴포넌트 분리

#### `ParticipantsStats.tsx`
- 상단 통계 카드 컴포넌트
- 전체, 수락, 대기중, 거절, 플랜 생성 완료, 작업 필요 통계 표시

#### `ParticipantsToolbar.tsx`
- 검색 필터 및 상태 필터 셀렉트 박스
- 일괄 작업 버튼들 (플랜 그룹 일괄 생성, 일괄 설정 및 플랜 생성, 추천 콘텐츠만 적용, 일괄 활성화, 상태 변경)
- 선택된 참여자 수 표시

#### `ParticipantsTable.tsx`
- 참여자 목록 테이블
- 정렬 기능
- 체크박스 선택 기능
- 각 참여자별 작업 버튼 (남은 단계 진행, 제출 내용 확인, 상세 보기 등)

### 4. 메인 컴포넌트 재구성 (`CampParticipantsList.tsx`)
- 커스텀 훅 호출
- 분리된 하위 컴포넌트들을 배치하는 컨테이너 역할만 수행
- 일괄 작업 다이얼로그 상태 관리
- 모달 및 위저드 컴포넌트 관리

## 파일 구조

```
app/(admin)/admin/camp-templates/[id]/participants/
├── CampParticipantsList.tsx (메인 컴포넌트)
└── _components/
    ├── types.ts (타입 정의)
    ├── useCampParticipantsLogic.ts (커스텀 훅)
    ├── ParticipantsStats.tsx (통계 컴포넌트)
    ├── ParticipantsToolbar.tsx (툴바 컴포넌트)
    ├── ParticipantsTable.tsx (테이블 컴포넌트)
    ├── BatchOperationDialog.tsx (기존)
    ├── BulkRecommendContentsModal.tsx (기존)
    └── BatchPlanWizard.tsx (기존)
```

## 개선 효과

### 가독성 향상
- 메인 컴포넌트가 1052줄에서 약 200줄로 감소
- 각 컴포넌트가 단일 책임을 가지도록 분리

### 유지보수성 향상
- 로직과 UI가 명확히 분리되어 수정이 용이
- 각 컴포넌트를 독립적으로 테스트 가능

### 재사용성 향상
- 분리된 컴포넌트들을 다른 곳에서도 활용 가능
- 커스텀 훅을 다른 컴포넌트에서도 사용 가능

## 기능 유지
- 기존의 모든 기능이 리팩토링 후에도 동일하게 동작
- 검색, 필터, 정렬, 일괄 처리, 페이지네이션 등 모든 기능 유지

## 주의사항
- 기존 기능의 동작 방식이 변경되지 않도록 주의
- 타입 안전성 유지
- 성능 최적화 (메모이제이션) 유지

