# 캠프 템플릿 리뷰 페이지에서 전략과목/취약과목 정보 섹션 및 플랜 생성하기 버튼 제거

## 작업 개요

**작업일**: 2024년 11월  
**작업 내용**: 
1. 캠프 템플릿 참가자 리뷰 페이지에서 '전략과목/취약과목 정보' 항목 제거
2. '플랜 생성하기' 버튼 제거 (절차상 맞지 않은 위치에 있는 버튼 및 기능)

## 변경 사항

### 제거된 항목

1. **UI 섹션 제거**
   - '전략과목/취약과목 정보' 섹션 전체 제거
   - 개요 탭에서 표시되던 전략과목/취약과목 설정 UI 제거

2. **관련 함수 제거**
   - `handleSubjectAllocationChange`: 과목 할당 변경 핸들러 제거
   - `handleSave`: 전략과목/취약과목 설정 저장 함수 제거

3. **상태 및 변수 제거**
   - `subjectAllocations` 상태 제거
   - `subjects` 계산 로직 제거
   - `SubjectAllocation` 타입 정의 제거

4. **버튼 제거**
   - '설정 저장' 버튼 제거
   - '플랜 생성하기' 버튼 전체 제거 (절차상 맞지 않은 위치)

5. **Import 제거**
   - `updateCampPlanGroupSubjectAllocations` import 제거
   - `generatePlansFromGroupAction` import 제거
   - `useRouter` import 제거
   - `useTransition` import 제거

### 제거된 함수

**`handleGeneratePlans` 함수**
- 플랜 생성 함수 전체 제거
- 관련 상태 및 훅 제거:
  - `useRouter` 훅 제거
  - `useTransition` 훅 제거
  - `isPending` 상태 제거
  - `startTransition` 함수 제거

## 영향 범위

### 수정된 파일

- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`

### 영향받는 기능

- **캠프 템플릿 리뷰 페이지**: 
  - 개요 탭에서 전략과목/취약과목 정보 섹션이 더 이상 표시되지 않음
  - '플랜 생성하기' 버튼이 더 이상 표시되지 않음
  - 리뷰 페이지는 이제 정보 확인 용도로만 사용됨

## 사유

1. **전략과목/취약과목 정보 섹션 제거**
   - 불필요한 항목으로 판단되어 제거
   - 사용자 경험 개선을 위해 복잡한 설정 단계 제거

2. **플랜 생성하기 버튼 제거**
   - 절차상 맞지 않은 위치에 있는 버튼 및 기능
   - 리뷰 페이지는 정보 확인 용도로만 사용되어야 함

## 테스트 확인 사항

- [ ] 캠프 템플릿 리뷰 페이지에서 전략과목/취약과목 정보 섹션이 표시되지 않는지 확인
- [ ] 캠프 템플릿 리뷰 페이지에서 '플랜 생성하기' 버튼이 표시되지 않는지 확인
- [ ] 페이지 로드 시 오류가 발생하지 않는지 확인
- [ ] 다른 탭(Step 1, Step 2, Step 3, Step 4)이 정상적으로 작동하는지 확인

