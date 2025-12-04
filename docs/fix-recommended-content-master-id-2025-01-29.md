# 추천 콘텐츠 master_content_id 저장 문제 수정

**작업 일시**: 2025-01-29  
**작업자**: AI Assistant  
**이슈**: 추천 콘텐츠 선택 후 등록했는데 다른 콘텐츠가 표시되는 문제

## 문제 상황

학생이 추천 콘텐츠를 1개 선택하여 범위 지정하고 등록 제출했는데, 등록한 콘텐츠와 다른 콘텐츠(선택하지 않은)가 선택 등록한 콘텐츠로 표시되는 문제가 발생했습니다.

## 원인 분석

### 근본 원인

1. **`planGroupDataSync.ts`**: 추천 콘텐츠의 `master_content_id`를 `content_id`로 올바르게 설정 (131번 라인)
2. **`create.ts`**: 이미 설정된 `master_content_id`를 무시하고 학생 콘텐츠 조회 결과로 덮어씀 (130번 라인)
3. **결과**: 추천 콘텐츠의 `master_content_id`가 `null`로 저장되어 불러올 때 매핑 오류 발생

### 문제 흐름

```
1. planGroupDataSync.ts에서 추천 콘텐츠의 master_content_id = content_id 설정 ✅
2. create.ts에서 masterContentIdMap.get(c.content_id)로 덮어씀 ❌
   → 추천 콘텐츠는 학생 콘텐츠가 아니므로 null 반환
3. plan_contents 테이블에 master_content_id = null로 저장 ❌
4. classifyPlanContents에서 master_content_id가 null이어서 매핑 실패
5. RecommendedContentsPanel에서 잘못된 콘텐츠 표시 ❌
```

## 해결 방법

### 수정 1: create.ts에서 이미 설정된 master_content_id 우선 사용

**파일**: `app/(student)/actions/plan-groups/create.ts`

기존 로직을 수정하여 `data.contents`에 이미 `master_content_id`가 설정되어 있으면 그것을 우선 사용하도록 변경:

```typescript
// 변경 전
master_content_id: masterContentIdMap.get(c.content_id) || null,

// 변경 후
master_content_id: c.master_content_id ?? (masterContentIdMap.get(c.content_id) || null),
```

**효과**:
- `planGroupDataSync.ts`에서 설정한 `master_content_id`가 보존됨
- 추천 콘텐츠의 경우 `master_content_id = content_id`로 올바르게 저장됨
- 학생 콘텐츠의 경우 기존 로직대로 동작 (masterContentIdMap에서 조회)

### 수정 2: RecommendedContentsPanel 매핑 로직 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`

불러올 때 매핑이 실패하는 경우를 대비한 방어 코드 추가:

```typescript
// 변경 전
const originalContent = allRecommendedContents.find(
  (c) => c.id === content.content_id
);

// 변경 후
const originalContent = allRecommendedContents.find(
  (c) => c.id === content.content_id || 
         (content.master_content_id && c.id === content.master_content_id)
);
```

**효과**:
- `content_id`로 먼저 찾고, 없으면 `master_content_id`로도 찾기
- 매핑 실패 시에도 대체 방법으로 찾을 수 있음

## 수정된 파일

1. **`app/(student)/actions/plan-groups/create.ts`**
   - 130번 라인 수정: `master_content_id` 우선순위 변경
   - 이미 설정된 값 우선 사용 → 없으면 학생 콘텐츠 조회 결과 사용

2. **`app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`**
   - 450번 라인 수정: 매핑 로직 개선 (방어 코드)

## 테스트 시나리오

1. ✅ 추천 콘텐츠 1개 선택 → 범위 지정 → 등록
2. ✅ 저장된 데이터 확인: `master_content_id`가 `content_id`와 동일한지 확인
3. ✅ 불러온 후 표시 확인: 선택한 콘텐츠가 정확히 표시되는지 확인
4. ✅ 여러 추천 콘텐츠 선택 시 각각 정확히 매칭되는지 확인

## 예상 효과

- ✅ 추천 콘텐츠의 `master_content_id`가 올바르게 저장됨
- ✅ `classifyPlanContents` 함수가 추천 콘텐츠를 정확하게 분류
- ✅ `RecommendedContentsPanel`에서 올바른 콘텐츠 표시
- ✅ 간단한 수정으로 문제 해결 (복잡한 로직 불필요)

## 참고 사항

- `planGroupDataSync.ts`에서 이미 추천 콘텐츠의 `master_content_id`를 올바르게 설정하고 있었음
- 문제는 `create.ts`에서 이 값을 덮어쓰는 것이었음
- `??` 연산자를 사용하여 nullish coalescing으로 간단하게 해결

