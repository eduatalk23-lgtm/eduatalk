# 마스터 콘텐츠 탭 추가 구현

## 작업 개요
일반모드의 콘텐츠 추가 탭에 "마스터 콘텐츠" 탭을 추가하여, 마스터 콘텐츠를 검색하고 선택한 후 student_contents에 바로 추가할 수 있도록 구현했습니다.

## 작업 일자
2025-01-30

## 구현 내용

### 1. Step3ContentSelection 컴포넌트 수정
- **파일**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- **변경사항**:
  - 탭 상태에 "master" 옵션 추가 (`"student" | "recommended" | "master"`)
  - 탭 UI에 "마스터 콘텐츠" 탭 버튼 추가 (Package 아이콘 사용)
  - MasterContentsPanel 컴포넌트 import 및 렌더링

### 2. MasterContentsPanel 컴포넌트 생성
- **파일**: `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
- **주요 기능**:
  - 마스터 콘텐츠 검색 (제목, 콘텐츠 타입, 과목 필터)
  - 검색 결과 목록 표시
  - 마스터 콘텐츠 선택 및 범위 설정
  - 선택한 마스터 콘텐츠를 student_contents에 추가
  - 기존 학생 콘텐츠와의 중복 체크 (master_content_id 기반)

#### 검색 기능
- 콘텐츠 타입 선택: 전체/교재/강의
- 제목 검색
- 과목 필터 (선택사항)
- `searchContentMastersAction` 액션 사용

#### 선택 및 추가 기능
- 검색 결과에서 마스터 콘텐츠 선택
- 범위 설정 모달을 통해 학습 범위 지정
- 마스터 콘텐츠 ID를 `master_content_id`로 저장하여 중복 방지
- 최대 9개 제한 검증

### 3. Export 추가
- **파일**: `app/(student)/plan/new-group/_components/_shared/index.ts`
- MasterContentsPanel 컴포넌트 export 추가

## 사용된 컴포넌트 및 API

### 컴포넌트
- `ContentCard`: 선택된 콘텐츠 표시
- `RangeSettingModal`: 범위 설정 모달 (마스터 콘텐츠는 `isRecommendedContent={true}`로 설정하여 마스터 API 사용)

### API 액션
- `searchContentMastersAction`: 마스터 콘텐츠 검색
- `/api/master-content-details`: 마스터 콘텐츠 상세 정보 조회 (범위 설정 시)

## 데이터 흐름

1. 사용자가 마스터 콘텐츠 탭 선택
2. 검색 조건 입력 (제목, 타입, 과목)
3. 검색 실행 → `searchContentMastersAction` 호출
4. 검색 결과 표시
5. 마스터 콘텐츠 선택 → 범위 설정 모달 열기
6. 범위 설정 → `/api/master-content-details`로 상세 정보 조회
7. 범위 저장 → student_contents에 추가 (master_content_id 포함)
8. 중복 체크: master_content_id 기반으로 이미 추가된 콘텐츠 필터링

## 중복 방지 로직

마스터 콘텐츠는 `master_content_id` 필드를 통해 중복을 방지합니다:
- 이미 추가된 마스터 콘텐츠는 검색 결과에서 제외
- 동일한 `master_content_id`를 가진 콘텐츠는 추가 불가

## 주요 특징

1. **기존 패턴 재사용**: StudentContentsPanel과 RecommendedContentsPanel의 UI/UX 패턴을 참고하여 일관성 유지
2. **마스터 API 활용**: 범위 설정 시 마스터 콘텐츠 API 사용 (`isRecommendedContent={true}`)
3. **통합 관리**: student_contents에 추가되므로 기존 학생 콘텐츠와 동일하게 관리
4. **최대 개수 제한**: 전체 콘텐츠 개수(학생 + 추천 + 마스터)가 9개를 초과하지 않도록 검증

## 관련 파일

### 수정된 파일
- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/_shared/index.ts`

### 생성된 파일
- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`

## 다음 단계 (선택사항)

1. 학기/개정판 필터 추가 (필요시)
2. 검색 결과 페이지네이션 (현재는 20개 제한)
3. 검색 결과 정렬 기능

