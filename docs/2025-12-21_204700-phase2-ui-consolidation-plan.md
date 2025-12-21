# Phase 2: UI 일관화 계획

## 목표

전략과목/취약과목 설정 UI를 교재/강의 콘텐츠 선택 UI와 일관된 패턴으로 통합하고 개선합니다.

## 현재 상황 분석

### 기존 컴포넌트

1. **Step6Simplified.tsx의 SubjectAllocationEditor** (640줄)
   - 교과별/콘텐츠별 설정 모드 혼재
   - 복잡한 로직 (모드 전환, 초기화 등)
   - 교과별 그룹화 + 콘텐츠 목록

2. **ContentAllocationUI.tsx** (206줄)
   - 콘텐츠별만 지원
   - 간단한 구조
   - 교과별 그룹화 + 콘텐츠 목록

3. **SubjectAllocationUI.tsx** (169줄)
   - 교과별만 지원
   - 간단한 구조

### 참고할 UI 패턴

1. **ContentSelector**
   - 탭 기반 (book/lecture/custom)
   - 검색 기능
   - 일관된 카드 UI

2. **ContentList**
   - 교과별 그룹화
   - 일관된 카드 UI
   - 명확한 구조

## 통합 컴포넌트 설계

### StrategyWeaknessAllocationEditor

**위치**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

**기능**:
- 교과별/콘텐츠별 설정 모드 통합
- 교과별 그룹화
- 일관된 카드 UI
- 모드 전환 UI

**구조**:
```typescript
<StrategyWeaknessAllocationEditor>
  {/* 모드 선택 (전역 또는 교과별) */}
  <AllocationModeSelector />
  
  {/* 교과별 그룹 */}
  {subjects.map(subject => (
    <SubjectGroup key={subject}>
      <SubjectHeader 
        subject={subject}
        contentCount={contents.length}
        mode={allocationMode}
        onModeChange={handleModeChange}
      />
      
      {/* 교과 단위 설정 (모드가 "subject"일 때) */}
      {mode === "subject" && (
        <SubjectAllocationControls />
      )}
      
      {/* 콘텐츠 목록 */}
      <ContentList>
        {contents.map(content => (
          <ContentCard key={content.id}>
            <ContentHeader content={content} />
            {/* 콘텐츠별 설정 (모드가 "content"일 때) */}
            {mode === "content" && (
              <ContentAllocationControls />
            )}
            {/* 폴백 정보 표시 */}
            <AllocationSourceBadge />
          </ContentCard>
        ))}
      </ContentList>
    </SubjectGroup>
  ))}
  
  {/* 설정 요약 */}
  <AllocationSummary />
</StrategyWeaknessAllocationEditor>
```

## 단계별 구현 계획

### Step 1: 공통 컴포넌트 추출

1. **AllocationControls 컴포넌트**
   - 전략/취약 라디오 버튼
   - 주당 배정 일수 선택
   - 재사용 가능한 UI

2. **AllocationSourceBadge 컴포넌트**
   - 폴백 정보 표시
   - "교과별 설정 적용 중", "기본값 (취약과목)" 등

3. **SubjectGroup 컴포넌트**
   - 교과별 그룹화 컨테이너
   - 헤더 + 콘텐츠 목록

### Step 2: 통합 컴포넌트 생성

1. **StrategyWeaknessAllocationEditor 생성**
   - 기존 로직 통합
   - 일관된 UI 패턴 적용

### Step 3: 기존 컴포넌트 교체

1. **Step6Simplified.tsx 수정**
   - SubjectAllocationEditor 제거
   - StrategyWeaknessAllocationEditor 사용

2. **ContentAllocationUI.tsx 수정**
   - StrategyWeaknessAllocationEditor 사용
   - 또는 통합 컴포넌트로 대체

3. **SubjectAllocationUI.tsx 제거**
   - StrategyWeaknessAllocationEditor로 통합

## UI 패턴 일관성

### 공통 패턴

1. **카드 기반 UI**
   - `rounded-lg border border-gray-200 bg-white p-4`
   - 일관된 간격: `gap-3`, `gap-4`

2. **헤더 스타일**
   - `text-sm font-semibold text-gray-900`
   - 아이콘 + 텍스트

3. **버튼 스타일**
   - 라디오 버튼: `rounded border p-2`
   - 선택 버튼: `bg-gray-900 text-white`

4. **요약 섹션**
   - `rounded-lg border border-blue-200 bg-blue-50 p-3`
   - `text-xs text-blue-800`

## 예상 효과

1. **코드 중복 제거**: 3개 컴포넌트 → 1개 통합 컴포넌트
2. **유지보수성 향상**: 일관된 패턴으로 수정 용이
3. **사용자 경험 개선**: 일관된 UI로 사용성 향상
4. **코드 가독성 향상**: 명확한 구조

## 주의사항

1. **하위 호환성**: 기존 기능 유지
2. **점진적 마이그레이션**: 한 번에 모든 것을 변경하지 않고 단계적으로
3. **테스트**: 각 단계마다 충분한 테스트

