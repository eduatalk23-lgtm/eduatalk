# 콘텐츠 표시 관련 UI 문제 수정

## 📋 작업 개요

플랜 위저드에서 콘텐츠 표시와 관련된 3가지 UI 문제를 수정했습니다:

1. 마스터에서 가져온 콘텐츠가 "학생 콘텐츠"로 표시되는 문제
2. "개정 교육과정" 표시 뒤에 "개정판"이 중복 표시되는 문제
3. `StrategyWeaknessAllocationEditor`에서 "교과 단위 설정 적용 중" 메시지가 엉뚱하게 표시되는 문제

## 🎯 목표

1. 마스터 콘텐츠와 학생 콘텐츠를 명확하게 구분하여 표시
2. 개정 교육과정 표시에서 중복된 "개정판" 텍스트 제거
3. 교과 단위 설정이 실제로 적용된 경우에만 메시지 표시

## 🔧 변경 사항

### 1. 마스터 콘텐츠 구분 표시 수정

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/ContentList.tsx`

**변경 내용**:
- `type === "student"`일 때 `master_content_id`를 확인하여 마스터 콘텐츠인지 구분
- 마스터 콘텐츠인 경우 "마스터 콘텐츠"로 표시
- 학생 콘텐츠인 경우 "학생 콘텐츠"로 표시

**코드 변경**:
```typescript
// 변경 전
{type === "student" ? "학생 콘텐츠" : "추천 콘텐츠"}

// 변경 후
{type === "student"
  ? (content as WizardData["student_contents"][number]).master_content_id
    ? "마스터 콘텐츠"
    : "학생 콘텐츠"
  : "추천 콘텐츠"}
```

### 2. "개정판" 텍스트 제거

다음 파일들에서 `{revision} 개정판` 형태를 `{revision}`으로 변경:

#### 2.1 ContentList.tsx
**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/ContentList.tsx`

```typescript
// 변경 전
{info.revision} 개정판

// 변경 후
{info.revision}
```

#### 2.2 ContentItem.tsx
**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentItem.tsx`

```typescript
// 변경 전
{metadata.revision} 개정판

// 변경 후
{metadata.revision}
```

#### 2.3 RecommendedContentCard.tsx
**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/components/RecommendedContentCard.tsx`

```typescript
// 변경 전
{content.revision} 개정판

// 변경 후
{content.revision}
```

#### 2.4 AddedContentsList.tsx
**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/components/AddedContentsList.tsx`

```typescript
// 변경 전
{recommendedContent.revision} 개정판

// 변경 후
{recommendedContent.revision}
```

### 3. "교과 단위 설정 적용 중" 조건 수정

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

**문제점**:
- `subjectGroupAllocation`이 있으면 무조건 "교과 단위 설정 적용 중" 메시지를 표시
- 실제로는 해당 콘텐츠가 교과 단위 설정의 영향을 받는지 확인해야 함

**변경 내용**:
- `getEffectiveAllocationForContent` 함수의 반환값에서 `source`를 확인
- `source === "subject"`일 때만 "교과 단위 설정 적용 중" 메시지 표시

**코드 변경**:
```typescript
// 변경 전
{subjectGroupAllocation && (
  <div className="text-xs text-gray-500">
    교과 단위 설정 적용 중
  </div>
)}
{!subjectGroupAllocation && source === "default" && (
  <div className="text-xs text-gray-500">
    기본값 (취약과목)
  </div>
)}

// 변경 후
{source === "subject" && (
  <div className="text-xs text-gray-500">
    교과 단위 설정 적용 중
  </div>
)}
{source === "default" && (
  <div className="text-xs text-gray-500">
    기본값 (취약과목)
  </div>
)}
```

## ✅ 검증 사항

### 1. 마스터 콘텐츠 구분
- [x] 마스터에서 가져온 콘텐츠는 "마스터 콘텐츠"로 표시
- [x] 학생이 직접 등록한 콘텐츠는 "학생 콘텐츠"로 표시
- [x] 추천 콘텐츠는 "추천 콘텐츠"로 표시

### 2. 개정 교육과정 표시
- [x] 모든 파일에서 "개정판" 텍스트 제거
- [x] 개정 교육과정명만 표시 (예: "2015 개정 교육과정")

### 3. 교과 단위 설정 메시지
- [x] 교과 단위 설정이 실제로 적용된 콘텐츠에만 메시지 표시
- [x] 콘텐츠별 설정이나 기본값을 사용하는 경우 메시지 미표시

## 📝 참고 사항

### 타입 안전성
- `ContentList.tsx`에서 `master_content_id` 접근 시 타입 단언 사용
- `WizardData["student_contents"]`에만 `master_content_id` 필드가 있음
- `WizardData["recommended_contents"]`에는 해당 필드가 없음

### getEffectiveAllocation 함수
- `source` 값은 다음 중 하나:
  - `"subject"`: 교과 단위 설정에서 가져온 값
  - `"content"`: 콘텐츠별 설정에서 가져온 값
  - `"default"`: 기본값 (취약과목)

## 🎨 UI 개선 효과

1. **명확한 콘텐츠 구분**: 마스터 콘텐츠와 학생 콘텐츠를 명확하게 구분하여 사용자가 콘텐츠 출처를 쉽게 파악할 수 있음
2. **간결한 표시**: 중복된 "개정판" 텍스트 제거로 UI가 더 깔끔해짐
3. **정확한 상태 표시**: 실제로 교과 단위 설정이 적용된 경우에만 메시지를 표시하여 사용자 혼란 방지

