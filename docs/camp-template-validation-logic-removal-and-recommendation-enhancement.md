# 캠프 템플릿 검증 로직 제거 및 추천 기능 고도화

## 작업 개요

캠프 템플릿 생성/수정 및 학습 계획 위저드에서 검증 로직을 간소화하고, 추천 콘텐츠 기능을 고도화하는 작업을 진행했습니다.

**작업 일시**: 2024-11-23

---

## 1. 관리자 캠프 템플릿 생성/수정 페이지 - 검증 설정 제거

### 변경 사항

#### 1.1 "4단계 콘텐츠 선택 검증 설정" 제거

**파일**: 
- `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

**제거된 내용**:
- 교육과정 개정판(`curriculumRevisions`) 관련 상태 및 로직
- 교과 그룹(`subjectGroups`) 관련 상태 및 로직
- 교과별 과목(`subjectsByGroup`) 관련 상태 및 로직
- 필수 교과 검증 활성화(`enableRequiredSubjectsValidation`) 상태
- 필수 교과 선택(`requiredSubjects`) 상태
- 해당 UI 섹션 전체 (약 200줄)

**변경된 로직**:
- 템플릿 저장 시 `subject_constraints` 필드 제거
- 관련 API 호출 제거 (`loadCurriculumRevisions`, `loadSubjectGroups`, `loadSubjectsForGroup`)

**영향 범위**:
- 캠프 템플릿 생성/수정 시 더 이상 교과별 필수 검증 설정이 필요 없음
- 템플릿 데이터 구조에서 `subject_constraints` 필드 제거

---

## 2. 학습 계획 위저드 - 필수 교과 제약 제거

### 변경 사항

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**제거된 내용**:
- Step 5 (추천 콘텐츠 단계) 검증 로직에서 국어/수학/영어 각 1개 이상 필수 제약
- `requiredSubjects` 배열 및 관련 검증 코드

**변경 전 코드**:
```typescript
const requiredSubjects = ["국어", "수학", "영어"];
for (const subject of requiredSubjects) {
  const hasSubject = selectedContents.some(
    (c) => c.subject === subject
  );
  if (!hasSubject) {
    errors.push(
      `${subject} 교과의 콘텐츠를 최소 1개 이상 선택해주세요.`
    );
  }
}
```

**변경 후**:
- 해당 검증 로직 완전 제거
- 콘텐츠 선택 시 교과별 필수 제약 없음

**영향 범위**:
- 학생이 학습 계획 생성 시 교과별 콘텐츠 선택의 자유도 증가
- 관리자가 "남은 단계 진행" 시에도 동일하게 적용

---

## 3. 전략과목/취약과목 정보 섹션 이동

### 변경 사항

#### 3.1 추천 콘텐츠 단계에서 제거

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**제거된 내용**:
- "전략과목/취약과목 정보" 섹션 전체
- `showSubjectAllocations` 상태 및 관련 로직

#### 3.2 최종 확인 단계로 이동

**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

**추가된 내용**:
- "전략과목/취약과목 정보" 섹션을 최종 확인 단계에 추가
- 로직 변경: 교과 기준이 아닌 **추가 등록한 콘텐츠 기준**으로 변경

**변경된 로직**:
- 이전: `data.subject_allocations`의 교과별 정보 표시
- 이후: `contentInfos` (학생 콘텐츠 + 추가 등록 콘텐츠 통합)를 기준으로 교과별 콘텐츠 개수 계산
- `subjectContentCount` 계산 로직 변경:
  ```typescript
  const subjectContentCount = useMemo(() => {
    const counts: Record<string, number> = {};
    contentInfos.forEach((content) => {
      const subject = content.subject || "기타";
      counts[subject] = (counts[subject] || 0) + 1;
    });
    return counts;
  }, [contentInfos]);
  ```

**표시 내용**:
- 교과별 콘텐츠 개수
- 전략과목 설정 시: 해당 교과의 주 학습일 수
- 취약과목 설정 시: 해당 교과의 주 학습일 수

---

## 4. 최종 확인 단계 - 제약 조건 검증 결과 제거

### 변경 사항

**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

**제거된 내용**:
- "제약 조건 검증 결과" 섹션 전체
- `validateConstraints` 함수 및 관련 로직
- 제약 조건 위반 메시지 표시 UI

**영향 범위**:
- 최종 확인 단계에서 제약 조건 검증 결과가 더 이상 표시되지 않음
- 템플릿의 `subject_constraints` 설정이 있어도 무시됨

---

## 5. 추천 콘텐츠 추천 받기 기능 고도화

### 변경 사항

**파일**: 
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
- `app/api/recommended-master-contents/route.ts`
- `lib/recommendations/masterContentRecommendation.ts`

### 5.1 UI 개선

**추가된 기능**:

1. **교과 선택**:
   - 체크박스로 교과 선택 (국어, 수학, 영어, 과학, 사회)
   - 선택한 교과에 대해서만 추천 요청

2. **개수 버튼**:
   - 각 교과별로 추천받을 콘텐츠 개수 설정 (최소 1개, 최대 9개)
   - 증감 버튼으로 개수 조절
   - 최대 개수는 학생 콘텐츠 수를 고려하여 동적 계산
     - 공식: `9 - (현재 학생 콘텐츠 수)`

3. **콘텐츠 자동 배정 옵션**:
   - 체크박스로 "콘텐츠 자동 배정" 선택 가능
   - 선택 시 추천받은 콘텐츠가 자동으로 "추가 추천 콘텐츠"에 추가됨
   - 자동 배정 시 `start_range`와 `end_range`가 마스터 콘텐츠의 전체 범위로 설정됨

### 5.2 제약 조건

1. **최소 제약**:
   - 추천받을 교과 최소 1개 선택 필수
   - 각 교과당 최소 1개 콘텐츠 요청

2. **최대 제약**:
   - 학생 콘텐츠 수 포함하여 최대 9개까지 가능
   - 교과별 개수 버튼의 최대값이 자동으로 조절됨

3. **콘텐츠 부족 처리**:
   - 요청한 교과/개수에 비해 추천 콘텐츠가 부족한 경우
   - "콘텐츠가 부족합니다" 메시지 표시
   - 사용자에게 부족한 상태로 진행할지 확인

### 5.3 API 변경

**파일**: `app/api/recommended-master-contents/route.ts`

**변경 내용**:
- 쿼리 파라미터 추가:
  - `subjects`: 선택한 교과 배열 (예: `subjects=국어&subjects=수학`)
  - `count_국어`, `count_수학`, ... : 교과별 요청 개수

**변경 전**:
```typescript
GET /api/recommended-master-contents?studentId=xxx
```

**변경 후**:
```typescript
GET /api/recommended-master-contents?studentId=xxx&subjects=국어&subjects=수학&count_국어=3&count_수학=2
```

### 5.4 추천 로직 개선

**파일**: `lib/recommendations/masterContentRecommendation.ts`

**변경 내용**:
- `getRecommendedMasterContents` 함수 시그니처 변경:
  ```typescript
  export async function getRecommendedMasterContents(
    supabase: SupabaseServerClient,
    studentId: string,
    tenantId: string | null,
    requestedSubjectCounts?: Map<string, number>
  ): Promise<RecommendedMasterContent[]>
  ```

- 선택한 교과와 개수에 따라 추천 결과 필터링 및 제한
- 교과별로 요청한 개수만큼만 추천
- 선택하지 않은 교과는 추천 목록에서 제외

### 5.5 자동 배정 로직

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**구현 내용**:

1. **자동 배정 활성화 시**:
   - 추천받은 콘텐츠를 즉시 `data.recommended_contents`에 추가
   - 각 콘텐츠의 `start_range`와 `end_range`를 마스터 콘텐츠의 전체 범위로 설정
   - 마스터 콘텐츠 상세 정보를 API로 조회하여 실제 범위 확인

2. **범위 설정 로직**:
   ```typescript
   // 교재인 경우: 1페이지 ~ 마지막 페이지
   // 강의인 경우: 1회차 ~ 마지막 회차
   const contentDetails = await fetch(`/api/master-content-details?...`);
   const { min_page, max_page, min_episode, max_episode } = await contentDetails.json();
   
   if (contentType === 'book') {
     start_range = min_page || 1;
     end_range = max_page || 1;
   } else {
     start_range = min_episode || 1;
     end_range = max_episode || 1;
   }
   ```

3. **수동 추가 시**:
   - 기존과 동일하게 사용자가 직접 범위 설정
   - "추가 추천 콘텐츠" 목록에 추가

---

## 변경된 파일 목록

### 수정된 파일

1. `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
   - "4단계 콘텐츠 선택 검증 설정" 섹션 제거
   - 관련 상태 및 로직 제거

2. `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
   - "4단계 콘텐츠 선택 검증 설정" 섹션 제거
   - 관련 상태 및 로직 제거

3. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - Step 5 검증에서 국어/수학/영어 필수 제약 제거

4. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
   - "전략과목/취약과목 정보" 섹션 제거
   - 추천 콘텐츠 기능 고도화:
     - 교과 선택 UI 추가
     - 개수 버튼 추가
     - 콘텐츠 자동 배정 옵션 추가
     - 콘텐츠 부족 메시지 추가

5. `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`
   - "제약 조건 검증 결과" 섹션 제거
   - "전략과목/취약과목 정보" 섹션 추가
   - 로직 변경: 추가 등록한 콘텐츠 기준으로 계산

6. `app/api/recommended-master-contents/route.ts`
   - 교과 및 개수 파라미터 파싱 추가
   - `getRecommendedMasterContents`에 파라미터 전달

7. `lib/recommendations/masterContentRecommendation.ts`
   - 교과별 개수 제약을 고려한 추천 로직 추가
   - 선택한 교과만 추천하도록 필터링

---

## 사용자 영향

### 관리자

1. **템플릿 생성/수정 간소화**:
   - 교과별 필수 검증 설정 단계가 제거되어 템플릿 생성이 더 간단해짐
   - 템플릿 구조가 단순해짐

2. **남은 단계 진행**:
   - 학생의 콘텐츠 선택에 대한 제약이 줄어듦
   - 더 유연한 콘텐츠 선택 가능

### 학생

1. **콘텐츠 선택 자유도 증가**:
   - 교과별 필수 콘텐츠 선택 제약 없음
   - 원하는 콘텐츠만 선택 가능

2. **추천 콘텐츠 기능 개선**:
   - 원하는 교과와 개수를 지정하여 추천받을 수 있음
   - 자동 배정 옵션으로 추천받은 콘텐츠를 바로 추가 가능
   - 콘텐츠 부족 시 명확한 안내 메시지 제공

3. **최종 확인 단계 개선**:
   - 전략과목/취약과목 정보가 실제 등록한 콘텐츠 기준으로 표시
   - 제약 조건 검증 결과 제거로 화면이 더 간결해짐

---

## 테스트 시나리오

### 1. 캠프 템플릿 생성

1. 관리자 → 캠프 템플릿 → 새 템플릿 생성
2. 기본 정보 입력
3. 4단계 콘텐츠 선택 검증 설정 섹션이 없는지 확인
4. 템플릿 저장 성공 확인

### 2. 학습 계획 생성 (학생)

1. 학습 계획 → 새 계획 그룹 생성
2. 기본 정보 입력
3. 추천 콘텐츠 단계에서:
   - 교과 선택 (국어, 수학 체크)
   - 개수 버튼으로 각 교과당 2개씩 설정
   - "콘텐츠 자동 배정" 체크
   - "추천받기" 클릭
   - 추천받은 콘텐츠가 자동으로 추가되는지 확인
4. 최종 확인 단계에서:
   - 전략과목/취약과목 정보가 등록한 콘텐츠 기준으로 표시되는지 확인
   - 제약 조건 검증 결과 섹션이 없는지 확인

### 3. 추천 콘텐츠 부족 케이스

1. 추천 콘텐츠 단계
2. 교과 선택 및 개수 설정 (예: 국어 10개)
3. "추천받기" 클릭
4. "콘텐츠가 부족합니다" 메시지 표시 확인
5. 부족한 상태로 진행 가능한지 확인

### 4. 최대 개수 제한

1. 학생 콘텐츠 5개 등록된 상태
2. 추천 콘텐츠 단계에서 개수 버튼 최대값이 4개로 제한되는지 확인 (5 + 4 = 9)
3. 더 이상 증가하지 않는지 확인

---

## 향후 개선 사항

1. **추천 알고리즘 개선**:
   - 교과별 개수 제약을 더 정교하게 반영
   - 학생의 학습 이력 및 성적 데이터를 더 활용

2. **UI/UX 개선**:
   - 교과 선택 시 시각적 피드백 강화
   - 추천 콘텐츠 로딩 상태 표시 개선

3. **에러 처리 강화**:
   - API 에러 시 사용자 친화적 메시지
   - 네트워크 오류 시 재시도 옵션

---

## 참고 사항

- 이번 변경으로 템플릿의 `subject_constraints` 필드가 사용되지 않게 되었으나, 기존 데이터와의 호환성을 위해 데이터베이스 스키마는 변경하지 않았습니다.
- 향후 마이그레이션 시 해당 필드를 제거하는 것을 고려할 수 있습니다.

---

**작업 완료일**: 2024-11-23
