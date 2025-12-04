# 캠프 템플릿 제출 시 추천 콘텐츠 저장 문제 수정

## 🔍 문제 상황

캠프 템플릿을 제출한 후 제출 내용 확인 화면에서, 학생이 추가하지 않은 추천 콘텐츠가 표시되는 문제가 발생했습니다.

### 원인 분석

1. **템플릿 데이터 병합 시 문제**:
   - `submitCampParticipation` 함수에서 템플릿의 `recommended_contents`를 그대로 `mergedData`에 포함
   - 학생이 Step4에서 추천 콘텐츠를 선택하지 않았어도, 템플릿에 포함된 추천 콘텐츠가 저장됨

2. **데이터 저장 흐름**:
   ```
   템플릿 recommended_contents 
   → mergedData.recommended_contents 
   → syncWizardDataToCreationData 
   → plan_contents 테이블 저장
   → classifyPlanContents에서 추천 콘텐츠로 분류
   ```

3. **확인 화면 표시**:
   - `classifyPlanContents` 함수가 `plan_contents` 테이블의 모든 콘텐츠를 조회
   - 학생 콘텐츠 테이블에 없는 콘텐츠를 추천 콘텐츠로 분류
   - 결과적으로 템플릿의 추천 콘텐츠가 확인 화면에 표시됨

## 🛠 해결 방법

### 변경 사항

**파일**: `app/(student)/actions/campActions.ts`

**변경 전**:
```typescript
student_contents: wizardData.student_contents || [],
recommended_contents: templateData.recommended_contents || [],
```

**변경 후**:
```typescript
student_contents: wizardData.student_contents || [],
// 학생이 선택한 추천 콘텐츠만 저장 (템플릿의 recommended_contents는 초기값으로만 사용)
recommended_contents: wizardData.recommended_contents || [],
```

### 해결 원리

- 템플릿의 `recommended_contents`는 초기값으로만 사용 (Step4에서 추천 콘텐츠 목록 표시용)
- 학생이 실제로 선택한 추천 콘텐츠만 `wizardData.recommended_contents`에 포함
- 제출 시 `wizardData.recommended_contents`만 저장하여, 학생이 선택하지 않은 콘텐츠는 저장되지 않음

## ✅ 검증 방법

1. **캠프 템플릿 제출 테스트**:
   - 템플릿에 추천 콘텐츠가 포함된 경우
   - Step4에서 추천 콘텐츠를 선택하지 않고 제출
   - 제출 확인 화면에서 추천 콘텐츠가 표시되지 않는지 확인

2. **추천 콘텐츠 선택 테스트**:
   - Step4에서 추천 콘텐츠를 선택하고 제출
   - 제출 확인 화면에서 선택한 추천 콘텐츠만 표시되는지 확인

## 📝 관련 파일

- `app/(student)/actions/campActions.ts` - 캠프 참여 정보 제출 로직
- `lib/utils/planGroupDataSync.ts` - 데이터 변환 로직
- `lib/data/planContents.ts` - 콘텐츠 분류 로직
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 제출 확인 화면

## 🎯 영향 범위

- **긍정적 영향**:
  - 학생이 선택하지 않은 추천 콘텐츠가 저장되지 않음
  - 제출 확인 화면에서 정확한 콘텐츠만 표시됨
  - 데이터 일관성 향상

- **주의 사항**:
  - 템플릿의 `recommended_contents`는 초기값으로만 사용되므로, 학생이 명시적으로 선택해야 저장됨
  - 기존에 제출된 플랜 그룹에는 영향 없음 (새로 제출하는 경우에만 적용)

---

**수정 일자**: 2025-01-29
**수정자**: Auto (AI Assistant)

