# 콘텐츠 선택 화면에 교과 정보 표시 추가

## 📋 작업 개요

콘텐츠 선택 화면에서 교과(교과 그룹)와 과목 정보를 모두 표시하도록 개선했습니다. 이를 통해 전략과목/취약과목 설정 시 논리적 오류를 찾기 쉽고, 일관성을 확보할 수 있습니다.

## 🎯 목표

1. 콘텐츠 선택 화면에서 교과 정보 표시
2. 전략과목/취약과목 설정의 논리적 오류 발견 용이
3. 일관성 확보를 통한 플랜 배치 로직 개선

## 🔧 변경 사항

### 1. 타입 정의 업데이트

#### `lib/data/contentMetadata.ts`
- `ContentMetadata` 타입에 `subject_group_name` 필드 추가
- 교과명을 저장할 수 있도록 타입 확장

#### `lib/types/content-selection.ts`
- `ContentMetadata` 타입에 `subject_group_name` 필드 추가
- `ContentCardProps`의 `content` 타입에 `subject_group_name` 필드 추가

### 2. 메타데이터 조회 로직 개선

#### `lib/data/contentMetadata.ts`

**헬퍼 함수 추가:**
- `fetchSubjectGroupName`: 단일 `subject_id`를 통해 교과명 조회
- `fetchSubjectGroupNamesBatch`: 여러 `subject_id`를 배치로 조회하여 교과명 맵 반환

**데이터베이스 조회:**
- `subjects` 테이블과 `subject_groups` 테이블을 JOIN하여 교과명 조회
- `subject_id` → `subjects.subject_group_id` → `subject_groups.name`

**수정된 함수:**
- `fetchContentMetadata`: 모든 반환 지점에서 교과명 조회 추가
- `fetchContentMetadataBatch`: 배치 조회 시 교과명도 함께 조회

### 3. UI 컴포넌트 업데이트

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx`
- 교과명을 파란색 배지로 표시 (과목명보다 먼저 표시)
- 교과명 스타일: `bg-blue-100 text-blue-800 font-medium`

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx`
- `ContentCard`에 `subject_group_name` 전달

#### `app/(student)/plan/new-group/_components/_features/content-selection/components/UnifiedContentsView.tsx`
- 학생 콘텐츠 및 추천 콘텐츠 카드에 `subject_group_name` 전달

## 📊 데이터 흐름

```
master_books/master_lectures
  └─ subject_id (FK)
      └─ subjects
          └─ subject_group_id (FK)
              └─ subject_groups
                  └─ name (교과명)
```

## 🎨 UI 변경 사항

### 이전
```
[과목명] [학기] [난이도] [출판사]
```

### 이후
```
[교과명] [과목명] [학기] [난이도] [출판사]
```

- 교과명은 파란색 배지로 강조 표시
- 교과명이 과목명보다 먼저 표시되어 계층 구조 명확화

## ✅ 검증 사항

- [x] 타입 정의 업데이트 완료
- [x] 메타데이터 조회 로직 개선 완료
- [x] UI 컴포넌트 업데이트 완료
- [x] 배치 조회 성능 최적화 (N+1 문제 방지)
- [x] 린터 에러 없음

## 🔍 관련 파일

### 수정된 파일
1. `lib/data/contentMetadata.ts` - 메타데이터 조회 로직
2. `lib/types/content-selection.ts` - 타입 정의
3. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentCard.tsx` - UI 컴포넌트
4. `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx` - 학생 콘텐츠 패널
5. `app/(student)/plan/new-group/_components/_features/content-selection/components/UnifiedContentsView.tsx` - 통합 콘텐츠 뷰

## 📝 향후 개선 사항

1. **추천 콘텐츠 메타데이터 조회**: `RecommendedContentsPanel`에서도 교과 정보를 조회하도록 개선
2. **캐싱 최적화**: 교과명 조회 결과를 캐싱하여 성능 개선
3. **에러 처리 강화**: 교과명 조회 실패 시 사용자에게 명확한 메시지 표시

## 🎯 기대 효과

1. **일관성 확보**: 교과 정보가 명확히 표시되어 전략과목/취약과목 설정 시 논리적 오류 발견 용이
2. **플랜 배치 개선**: 교과 정보를 기반으로 한 플랜 배치 로직의 정확성 향상
3. **사용자 경험 개선**: 콘텐츠 선택 시 교과 정보를 한눈에 확인 가능

