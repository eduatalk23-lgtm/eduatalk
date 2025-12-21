# 전략과목/취약과목 기능 리팩토링 계획

## 문제 분석

### 1. 하드코딩된 subject_id 생성

**문제점**:
- `subject.toLowerCase().replace(/\s+/g, "_")`로 임의의 subject_id 생성
- 실제 데이터베이스의 `subject_id`를 사용하지 않음
- 매칭 로직에서 정확한 매칭이 불가능

**위치**:
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx` (250, 432, 492줄)
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/SubjectAllocationUI.tsx` (89, 115, 147줄)

**영향**:
- `getEffectiveAllocation` 함수의 `subject_id` 매칭이 작동하지 않음
- 교과별 설정이 정확하게 매칭되지 않을 수 있음

### 2. 데이터 구조 불일치

**문제점**:
- 콘텐츠는 `subject_id`를 가지고 있지만, 교과별 설정에서는 `subject_name`만 사용
- `subject_category`와 `subject_id`의 관계가 명확하지 않음
- 교과별 설정에서 실제 `subject_id`를 사용하지 않음

**현재 구조**:
```typescript
// 콘텐츠 정보
{
  subject_category: "수학",  // 교과
  subject: "미적분",          // 과목
  subject_id: "uuid-123"     // 실제 과목 ID (사용 안 함)
}

// 교과별 설정
{
  subject_id: "수학".toLowerCase().replace(/\s+/g, "_"), // 하드코딩!
  subject_name: "수학"
}
```

### 3. UI 일관성 부족

**문제점**:
- `Step6Simplified.tsx`: 교과별/콘텐츠별 설정 모드 혼재, 복잡한 로직 (640줄)
- `ContentAllocationUI.tsx`: 콘텐츠별만 지원, 간단한 구조 (206줄)
- `SubjectAllocationUI.tsx`: 교과별만 지원 (169줄)
- 각 컴포넌트가 다른 패턴을 사용

**교재/강의 콘텐츠 선택 UI 패턴**:
- `ContentSelector`: 탭 기반 (book/lecture/custom)
- `ContentList`: 일관된 카드 UI
- `StudentContentsPanel`: 명확한 구조

### 4. 검증 로직 문제

**문제점**:
- `wizardValidator.ts`에서 `subject_name`으로만 검증
- 실제 콘텐츠의 `subject_category`와 매칭해야 함
- 에러 메시지가 "다음 과목의 콘텐츠를 선택해주세요"로 표시됨 (이미 수정했지만 확인 필요)

**현재 검증 로직**:
```typescript
const allocatedSubjects = new Set(
  (wizardData.subject_allocations || []).map((a) => a.subject_name)
);
const contentSubjects = new Set([
  ...wizardData.student_contents.map((c) => c.subject_category).filter(Boolean),
  ...wizardData.recommended_contents.map((c) => c.subject_category).filter(Boolean),
]);
```

### 5. 초기화 로직 문제

**문제점**:
- `Step6Simplified.tsx`에서 모든 콘텐츠에 기본값(취약과목)을 자동으로 추가
- 이는 불필요한 데이터 생성 및 혼란 야기

## 수정 계획

### Phase 1: 데이터 구조 정리

#### 1.1 subject_id 사용 개선

**목표**: 실제 데이터베이스의 `subject_id` 사용

**방법**:
1. 콘텐츠에서 `subject_id` 추출
2. 교과별 설정에서 실제 `subject_id` 사용
3. 하드코딩된 `subject_id` 생성 제거

**수정 파일**:
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/SubjectAllocationUI.tsx`

**변경 사항**:
```typescript
// 변경 전
subject_id: subject.toLowerCase().replace(/\s+/g, "_")

// 변경 후
// 콘텐츠에서 실제 subject_id 추출
const subjectId = getSubjectIdFromContents(subject, contentInfos);
// 또는 subject_id가 없으면 undefined로 처리
subject_id: subjectId || undefined
```

#### 1.2 콘텐츠 정보 확장

**목표**: 콘텐츠 정보에 `subject_id` 포함

**방법**:
1. `ContentInfo` 타입에 `subject_id` 필드 추가
2. 콘텐츠 로딩 시 `subject_id` 포함
3. 교과별 설정에서 `subject_id` 사용

### Phase 2: UI 일관화

#### 2.1 통합 컴포넌트 생성

**목표**: 교재/강의 콘텐츠 선택 UI와 일관된 패턴 적용

**새 컴포넌트**: `StrategyWeaknessAllocationEditor`
- 교과별/콘텐츠별 설정을 하나의 컴포넌트로 통합
- `ContentAllocationUI`와 유사한 구조
- 명확한 모드 전환 UI

**구조**:
```typescript
<StrategyWeaknessAllocationEditor>
  <AllocationModeToggle /> {/* 교과별/콘텐츠별 */}
  <SubjectGroupList>
    <SubjectGroup>
      <SubjectHeader />
      <ContentList>
        <ContentCard>
          <AllocationControls />
        </ContentCard>
      </ContentList>
    </SubjectGroup>
  </SubjectGroupList>
</StrategyWeaknessAllocationEditor>
```

#### 2.2 기존 컴포넌트 정리

**목표**: 중복 제거 및 일관성 확보

**작업**:
1. `Step6Simplified.tsx`의 `SubjectAllocationEditor` 제거
2. `ContentAllocationUI.tsx`와 `SubjectAllocationUI.tsx` 통합
3. 새로운 통합 컴포넌트 사용

### Phase 3: 검증 로직 개선

#### 3.1 검증 로직 정확도 향상

**목표**: `subject_category`와 `subject_id` 모두 고려한 검증

**방법**:
1. `subject_id`가 있으면 `subject_id`로 매칭
2. `subject_id`가 없으면 `subject_category`로 매칭
3. 에러 메시지 명확화

**수정 파일**:
- `lib/validation/wizardValidator.ts`

#### 3.2 초기화 로직 개선

**목표**: 불필요한 자동 초기화 제거

**방법**:
1. 기본값 자동 추가 로직 제거
2. 사용자가 명시적으로 설정할 때만 데이터 생성
3. 폴백 메커니즘은 `getEffectiveAllocation`에서 처리

### Phase 4: 테스트 및 문서화

#### 4.1 테스트 추가

**목표**: 리팩토링된 로직 검증

**테스트 케이스**:
1. `subject_id`로 정확한 매칭
2. `subject_category`로 매칭
3. 교과별/콘텐츠별 설정 전환
4. 검증 로직 정확도

#### 4.2 문서화

**목표**: 변경 사항 및 사용법 문서화

**문서**:
- 리팩토링 가이드
- 컴포넌트 사용법
- 데이터 구조 설명

## 우선순위

### High Priority
1. ✅ 하드코딩된 `subject_id` 제거 (이미 부분 수정)
2. 실제 `subject_id` 사용
3. 검증 로직 개선

### Medium Priority
4. UI 일관화
5. 컴포넌트 통합

### Low Priority
6. 초기화 로직 개선
7. 테스트 추가

## 예상 효과

1. **정확성 향상**: 실제 `subject_id` 사용으로 정확한 매칭
2. **유지보수성 향상**: 일관된 UI 패턴
3. **사용자 경험 개선**: 명확한 설정 UI
4. **버그 감소**: 하드코딩 제거로 예상치 못한 동작 방지

## 주의사항

1. **하위 호환성**: 기존 데이터 구조 유지
2. **점진적 마이그레이션**: 한 번에 모든 것을 변경하지 않고 단계적으로
3. **테스트**: 각 단계마다 충분한 테스트

## 관련 파일

### 수정 대상
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/SubjectAllocationUI.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/ContentAllocationUI.tsx`
- `lib/validation/wizardValidator.ts`
- `lib/utils/subjectAllocation.ts`

### 참고 파일
- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentList.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx`

