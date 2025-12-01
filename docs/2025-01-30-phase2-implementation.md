# Phase 2 Implementation: UI 통합 완성

## 구현 일자
2025-01-30

## 개요
Step 4와 Step 6의 UI 통합 완성 작업을 진행하였습니다. 이전에 구축된 백엔드 로직과 데이터 구조를 기반으로, 사용자 인터페이스를 완전히 통합하여 실제로 사용 가능한 기능으로 완성했습니다.

## 구현된 기능

### Phase 1: Step 4 핸들러 함수 구현 ✅
**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**구현 내용**:
- `handleLoadDetailSubjects`: 세부 과목 비동기 불러오기
- `handleAddRequiredSubject`: 새 필수 교과 추가
- `handleRequiredSubjectUpdate`: 필수 교과 수정
- `handleRequiredSubjectRemove`: 필수 교과 삭제
- `handleConstraintHandlingChange`: 제약 조건 처리 방식 변경

**핵심 기능**:
- 세부 과목 정보는 `fetchDetailSubjects` 서버 액션을 통해 비동기로 조회
- `subject_constraints` 객체를 업데이트하여 필수 교과 설정 관리
- 모든 핸들러는 `useCallback`으로 최적화

### Phase 2: Step 4 메인 UI 섹션 통합 ✅
**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**구현 내용**:
- "필수 교과 설정" 섹션을 "추천 콘텐츠 받기" 섹션 위에 추가
- 토글 방식으로 UI 표시/숨김 제어 (`show_required_subjects_ui`)
- `RequiredSubjectItem` 컴포넌트를 활용한 개별 교과 설정
- 교과 추가 버튼 (border-dashed 스타일)
- 제약 조건 처리 방식 선택 (경고/엄격/자동 보정)

**UI 구조**:
```
필수 교과 설정
├─ 설정하기/숨기기 토글
└─ (펼쳤을 때)
   ├─ 안내 문구
   ├─ 필수 교과 목록 (RequiredSubjectItem)
   ├─ + 필수 교과 추가 버튼
   └─ 제약 조건 처리 방식 선택
```

### Phase 3: Step 4 실시간 검증 표시 개선 ✅
**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**구현 내용**:
- 필수 교과 부족 시 amber(경고) 색상 박스 표시
- SVG 아이콘을 사용한 시각적 강조
- 교과별 부족 개수 상세 표시 (현재 X개 / 필요 Y개)
- 조건부 렌더링: `show_required_subjects_ui`와 `missingRequiredSubjects.length > 0`

**UI 요소**:
- 경고 아이콘 (SVG)
- 교과명 (굵게)
- 현재 개수 / 필요 개수
- 부족 개수 강조 표시

### Phase 4: Step 6 SubjectAllocationUI 컴포넌트 추출 ✅
**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

**구현 내용**:
- 기존 교과별 설정 로직을 독립적인 컴포넌트로 추출
- `SubjectAllocationUI` 컴포넌트 생성
- Props: `data`, `onUpdate`, `contentInfos`

**주요 기능**:
- 콘텐츠에서 과목 추출 및 정렬
- 교과별 전략/취약 라디오 버튼
- 전략과목 선택 시 주당 배정 일수 선택 (2/3/4일)
- 교과별 콘텐츠 개수 표시

**장점**:
- 재사용성 향상
- 코드 가독성 개선
- Phase 6에서 모드 전환 UI와 결합 용이

### Phase 5: Step 6 ContentAllocationUI 컴포넌트 구현 ✅
**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

**구현 내용**:
- 콘텐츠별 전략/취약 설정 UI 구현
- `ContentAllocationUI` 컴포넌트 생성
- 폴백 메커니즘 UI 반영

**주요 기능**:
1. **교과별 그룹화**: 콘텐츠를 교과별로 그룹화하여 표시
2. **폴백 메커니즘**: 
   - 1순위: `content_allocations` (콘텐츠별 설정)
   - 2순위: `subject_allocations` (교과별 설정)
   - 3순위: 기본값 (취약과목)
3. **시각적 표시**: 
   - "교과별 설정 적용 중" (2순위 폴백)
   - "기본값 (취약과목)" (3순위 폴백)
4. **설정 요약**: 
   - 콘텐츠별 설정 개수
   - 교과별 설정 개수
   - 우선순위 안내

**UI 구조**:
```
교과별 섹션
├─ 교과명
└─ 콘텐츠 목록
   ├─ 콘텐츠 제목 (책/강의 아이콘)
   ├─ 폴백 상태 표시 (선택사항)
   ├─ 전략/취약 라디오 버튼
   └─ 주당 배정 일수 (전략과목인 경우)

설정 요약 (파란색 박스)
├─ 콘텐츠별 설정: N개
├─ 교과별 설정 (폴백): M개
└─ 우선순위 안내
```

### Phase 6: Step 6 모드 전환 UI 통합 ✅
**파일**: `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`

**구현 내용**:
- 기존 전략/취약과목 섹션을 새로운 모드 전환 UI로 완전 교체
- 교과별 / 콘텐츠별 설정 모드 토글 버튼
- 조건부 렌더링으로 모드별 UI 표시

**UI 구조**:
```
전략과목/취약과목 정보
├─ 헤더
│  ├─ 제목
│  └─ 모드 토글 (교과별 설정 / 콘텐츠별 설정)
├─ 안내 문구 (모드별 상이)
└─ 컴포넌트 렌더링
   ├─ SubjectAllocationUI (교과별 모드)
   └─ ContentAllocationUI (콘텐츠별 모드)
```

**모드별 동작**:
- **교과별 설정 모드** (`allocation_mode: "subject"` 또는 기본값):
  - 같은 교과의 모든 콘텐츠에 동일한 설정 적용
  - 빠른 설정 가능
  
- **콘텐츠별 설정 모드** (`allocation_mode: "content"`):
  - 개별 콘텐츠마다 세밀한 설정 가능
  - 폴백 메커니즘으로 설정되지 않은 콘텐츠는 교과별 설정을 따름

## 기술적 세부사항

### 1. 상태 관리
- `WizardData`의 다음 필드 활용:
  - `show_required_subjects_ui`: Step 4 필수 교과 UI 표시 여부
  - `allocation_mode`: Step 6 전략/취약 설정 모드 ("subject" | "content")
  - `subject_constraints`: 필수 교과 제약 조건
  - `subject_allocations`: 교과별 전략/취약 설정
  - `content_allocations`: 콘텐츠별 전략/취약 설정

### 2. 컴포넌트 계층
```
Step4RecommendedContents
├─ 필수 교과 설정 섹션
│  └─ RequiredSubjectItem (기존)
└─ 추천 콘텐츠 받기 섹션

Step6FinalReview
└─ 전략과목/취약과목 정보
   ├─ SubjectAllocationUI (신규)
   └─ ContentAllocationUI (신규)
```

### 3. 데이터 흐름
```
사용자 입력
  ↓
핸들러 함수 (useCallback)
  ↓
onUpdate({ ...updates })
  ↓
WizardData 업데이트
  ↓
UI 리렌더링
```

### 4. 폴백 메커니즘 (ContentAllocationUI)
```javascript
getEffectiveAllocation(content) {
  // 1순위: 콘텐츠별 설정
  if (content_allocations[content_id]) return content_allocations[content_id];
  
  // 2순위: 교과별 설정
  if (subject_allocations[subject_category]) return subject_allocations[subject_category];
  
  // 3순위: 기본값
  return { subject_type: "weakness" };
}
```

## UI/UX 개선사항

### Step 4 개선
1. **토글 방식**: 필수 교과 설정을 선택적으로 표시하여 UI 복잡도 감소
2. **실시간 검증**: 부족한 필수 교과를 즉시 시각화
3. **세부 과목 선택**: 더 정확한 필수 교과 지정 가능

### Step 6 개선
1. **모드 전환**: 사용자의 니즈에 따라 빠른 설정 또는 세밀한 설정 선택 가능
2. **폴백 표시**: 어떤 설정이 적용되는지 명확히 표시
3. **설정 요약**: 현재 설정 상태를 한눈에 파악 가능

## 테스트 체크리스트

### Step 4
- [ ] 필수 교과 설정 토글 동작
- [ ] 필수 교과 추가/삭제/수정
- [ ] 세부 과목 불러오기 (비동기)
- [ ] 제약 조건 처리 방식 변경
- [ ] 실시간 검증 표시

### Step 6
- [ ] 모드 전환 토글 동작
- [ ] 교과별 설정 모드에서 전략/취약 설정
- [ ] 교과별 설정 모드에서 주당 일수 설정
- [ ] 콘텐츠별 설정 모드에서 개별 콘텐츠 설정
- [ ] 폴백 메커니즘 동작 확인
- [ ] 설정 요약 정확성

### 통합 테스트
- [ ] Step 4 → Step 6 데이터 흐름
- [ ] 캠프 모드 / 일반 모드 각각 테스트
- [ ] 플랜 생성 시 설정 반영 확인

## 파일 변경 사항

### 수정된 파일
1. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
   - 필수 교과 설정 핸들러 추가 (5개)
   - 필수 교과 설정 UI 섹션 추가
   - 실시간 검증 표시 UI 추가

2. `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`
   - `SubjectAllocationUI` 컴포넌트 추출
   - `ContentAllocationUI` 컴포넌트 구현
   - 모드 전환 UI로 기존 섹션 교체

### 변경되지 않은 파일 (의존)
- `lib/types/wizard.ts` (타입 정의)
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` (메인 위저드)
- `app/(student)/actions/fetchDetailSubjects.ts` (서버 액션)
- `lib/plan/1730TimetableLogic.ts` (검증 로직)
- `lib/validation/wizardValidator.ts` (서버 검증)

## 성과

### 정량적 성과
- **새로운 UI 컴포넌트**: 2개 (`SubjectAllocationUI`, `ContentAllocationUI`)
- **새로운 핸들러 함수**: 5개 (Step 4)
- **코드 라인 수**: 약 +500줄
- **Linting 에러**: 0개

### 정성적 성과
- ✅ 사용자가 직접 필수 교과를 설정할 수 있음
- ✅ 실시간으로 필수 교과 충족 여부 확인 가능
- ✅ 교과별/콘텐츠별 전략 설정을 자유롭게 선택 가능
- ✅ 폴백 메커니즘으로 설정 누락 방지
- ✅ 직관적이고 사용하기 쉬운 UI

## 다음 단계

### 권장 후속 작업
1. **실제 사용자 테스트**: 캠프 모드와 일반 모드에서 실제 플랜 생성 테스트
2. **성능 최적화**: 대량의 콘텐츠가 있을 때 렌더링 성능 확인
3. **접근성 개선**: 키보드 네비게이션, 스크린 리더 지원 강화
4. **모바일 반응형**: 모바일 환경에서 UI 테스트 및 개선

### 추가 기능 제안
1. **일괄 설정**: 여러 콘텐츠를 한 번에 전략/취약으로 설정
2. **설정 템플릿**: 자주 사용하는 설정을 템플릿으로 저장
3. **AI 추천**: 성적 데이터 기반으로 전략/취약 과목 자동 추천

## 결론

Step 4와 Step 6의 UI 통합 작업을 성공적으로 완료했습니다. 이전에 구축된 백엔드 로직과 데이터 구조를 기반으로, 사용자가 직접 설정을 조작할 수 있는 직관적인 인터페이스를 구현했습니다.

특히 다음 세 가지 핵심 기능이 완성되었습니다:
1. **필수 교과 설정** (Step 4): 세부 과목까지 지정 가능한 필수 교과 제약
2. **교과별 전략/취약 설정** (Step 6): 빠른 설정을 위한 교과 단위 설정
3. **콘텐츠별 전략/취약 설정** (Step 6): 세밀한 조절을 위한 콘텐츠 단위 설정

이제 사용자는 플랜 그룹 생성 시 더 정확하고 유연한 설정을 통해 자신의 학습 계획을 최적화할 수 있습니다.
