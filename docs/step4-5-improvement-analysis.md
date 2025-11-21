# Step 4, 5 개선 요구사항 분석

## 📋 사용자 요구사항 정리

### 1. **추가된 콘텐츠에서 학생/추천 구분 표시**
**현재 문제:**
- Step 4 (콘텐츠 선택)에서 선택한 콘텐츠와 Step 5 (추천 콘텐츠)에서 선택한 콘텐츠가 구분 없이 `data.contents` 배열에 저장됨
- Step 4의 "추가된 콘텐츠 목록"에서 학생 콘텐츠와 추천 콘텐츠를 구분할 수 없음

**요구사항:**
- 추가된 콘텐츠 목록에서 "학생 콘텐츠"와 "추천 콘텐츠"를 시각적으로 구분해서 표시
- 예: "📚 학생 교재", "🎯 추천 교재" 같은 라벨

### 2. **Step 4에 Step 5의 추천 콘텐츠 반영 불필요**
**현재 문제:**
- Step 5에서 선택한 추천 콘텐츠가 Step 4의 `data.contents`에 추가되어 Step 4로 돌아가면 추천 콘텐츠도 보임

**요구사항:**
- Step 4에서는 Step 5의 추천 콘텐츠를 보여주지 않음
- Step 4는 순수하게 학생이 직접 선택한 콘텐츠만 관리

### 3. **추가된 콘텐츠를 학생/추천으로 분리 관리**
**현재 구조:**
```typescript
contents: Array<{
  content_type: "book" | "lecture";
  content_id: string;
  start_range: number;
  end_range: number;
}>
```

**요구사항:**
- 학생 콘텐츠와 추천 콘텐츠를 분리해서 관리
- 두 가지 옵션:
  - **옵션 A**: 두 개의 배열로 분리
    ```typescript
    student_contents: Array<{...}>;
    recommended_contents: Array<{...}>;
    ```
  - **옵션 B**: 하나의 배열에 `source` 필드 추가
    ```typescript
    contents: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      start_range: number;
      end_range: number;
      source: "student" | "recommended"; // 추가
    }>
    ```

**권장: 옵션 B (source 필드 추가)**
- 기존 구조와 호환성 유지
- 하나의 배열로 관리하되 출처만 구분
- 최대 9개 제한도 하나의 배열로 쉽게 관리 가능

### 4. **Step 5에서 필수 과목 선택 유무 관리**
**현재 문제:**
- Step 5의 필수 과목 검증이 `selectedSubjectCategories`만 확인
- 학생 콘텐츠에 이미 필수 과목이 있어도 추천 콘텐츠에서 필수 과목을 선택해야 함
- 또는 학생 콘텐츠와 추천 콘텐츠를 합쳐서 검증하는데, 이게 혼란스러움

**요구사항:**
- **추천 콘텐츠에서만 필수 과목 검증**
- 학생 콘텐츠에 필수 과목이 있어도, 추천 콘텐츠에서도 각각 1개 이상 선택해야 함
- 또는 더 나은 방법: **전체 콘텐츠(학생 + 추천)에서 필수 과목이 각각 1개 이상 있으면 통과**

**권장 로직:**
```typescript
// 전체 콘텐츠(학생 + 추천)에서 필수 과목 확인
const allContents = [...studentContents, ...recommendedContents];
const allSubjectCategories = new Set(
  allContents.map(c => getSubjectCategory(c))
);
const missingRequiredSubjects = requiredSubjects.filter(
  subject => !allSubjectCategories.has(subject)
);
```

### 5. **소수점 2번째 자리 반올림**
**현재 문제:**
- 숫자 표시가 일관되지 않음
- 예: `4.333333`, `4.5`, `4.0` 등 다양한 형식

**요구사항:**
- 모든 숫자를 소수점 2번째 자리까지 표시 (반올림)
- 예: `4.33`, `4.50`, `4.00`
- `toFixed(2)` 사용

**적용 위치:**
- 성적 통계 (등급, 백분위, 위험도 등)
- 시간 통계 (학습 시간, 평균 시간 등)
- 기타 모든 숫자 표시

### 6. **불필요한 정보 제거**
**요구사항:**
- UI에서 불필요한 정보 제거
- 구체적인 위치는 코드 리뷰 후 결정

## 🎯 개선 방향

### 데이터 구조 변경

```typescript
// WizardData 타입 수정
export type WizardData = {
  // ... 기존 필드들 ...
  
  // Step 4: 학생 콘텐츠
  student_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
  }>;
  
  // Step 5: 추천 콘텐츠
  recommended_contents: Array<{
    content_type: "book" | "lecture";
    content_id: string; // 마스터 콘텐츠 ID
    start_range: number;
    end_range: number;
  }>;
  
  // 또는 옵션 B: source 필드 추가
  contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    source: "student" | "recommended"; // 추가
  }>;
};
```

### UI 개선

1. **Step 4 (콘텐츠 선택)**
   - "추가된 콘텐츠" 섹션에 "학생 콘텐츠" 라벨 표시
   - Step 5의 추천 콘텐츠는 표시하지 않음
   - 카운터: `학생 콘텐츠 X/9`

2. **Step 5 (추천 콘텐츠)**
   - "추가된 콘텐츠" 섹션에 "추천 콘텐츠" 라벨 표시
   - 학생 콘텐츠와 추천 콘텐츠를 구분해서 표시
   - 카운터: `전체 X/9 (학생 Y개 + 추천 Z개)`
   - 필수 과목 검증: 전체 콘텐츠(학생 + 추천) 기준으로 검증

3. **숫자 포맷팅**
   - 모든 숫자에 `toFixed(2)` 적용
   - 유틸리티 함수 생성: `formatNumber(value: number): string`

## 📝 구현 체크리스트

### 데이터 구조
- [ ] `WizardData` 타입에 `source` 필드 추가 또는 분리
- [ ] Step 4에서 `source: "student"`로 저장
- [ ] Step 5에서 `source: "recommended"`로 저장

### Step 4 개선
- [ ] "추가된 콘텐츠" 섹션에 "학생 콘텐츠" 라벨 추가
- [ ] `data.contents.filter(c => c.source === "student")`만 표시
- [ ] 카운터: 학생 콘텐츠 개수만 표시

### Step 5 개선
- [ ] "추가된 콘텐츠" 섹션에 "학생 콘텐츠"와 "추천 콘텐츠" 구분 표시
- [ ] 필수 과목 검증 로직 수정 (전체 콘텐츠 기준)
- [ ] 카운터: 전체/학생/추천 개수 표시

### 숫자 포맷팅
- [ ] `formatNumber` 유틸리티 함수 생성
- [ ] 모든 숫자 표시에 적용
- [ ] 성적 통계, 시간 통계 등 모든 곳에 적용

### 불필요한 정보 제거
- [ ] 코드 리뷰 후 불필요한 정보 식별
- [ ] UI에서 제거

---

## 🚀 추가 개선 사항

### 7. **추천 콘텐츠의 범위 수정 기능**
**현재 문제:**
- Step 5에서 추천 콘텐츠를 추가할 때 기본값만 설정됨 (교재: 1~100, 강의: 1~10)
- 추가 후 수정할 수 없음

**요구사항:**
- 추천 콘텐츠도 범위를 수정할 수 있어야 함
- 마스터 콘텐츠의 `total_pages` 또는 `total_episodes`를 기반으로 자동 설정
- Step 5의 "추가된 콘텐츠" 목록에서 범위 수정 가능

**구현 방안:**
```typescript
// 마스터 콘텐츠 정보 조회하여 자동 설정
const masterBook = await getMasterBookById(content.id);
const defaultEndRange = masterBook?.book?.total_pages || 100;

// 또는 Step 5에서 추가된 추천 콘텐츠도 수정 가능하도록
// "추가된 콘텐츠" 목록에 수정 버튼 추가
```

### 8. **중복 콘텐츠 방지 강화**
**현재 문제:**
- Step 4에서 선택한 콘텐츠와 Step 5에서 선택한 추천 콘텐츠가 중복될 수 있음
- 현재는 Step 5에서 Step 4의 콘텐츠를 제외하지만, 반대 방향(Step 4에서 Step 5의 콘텐츠 확인)은 없음

**요구사항:**
- Step 4에서 선택 시 Step 5의 추천 콘텐츠와 중복 체크
- Step 5에서 선택 시 Step 4의 학생 콘텐츠와 중복 체크
- 중복 선택 시 경고 메시지 표시

**구현 방안:**
```typescript
// Step 4에서 선택 시
const isDuplicate = data.recommended_contents?.some(
  rc => rc.content_type === contentType && rc.content_id === contentId
);

// Step 5에서 선택 시 (이미 구현됨)
const isDuplicate = data.contents.some(
  c => c.content_type === contentType && c.content_id === contentId
);
```

### 9. **추천 콘텐츠 삭제 기능**
**현재 문제:**
- Step 5에서 추가한 추천 콘텐츠를 삭제할 수 없음
- Step 4로 돌아가서 전체 콘텐츠를 확인해야 함

**요구사항:**
- Step 5의 "추가된 콘텐츠" 목록에서 추천 콘텐츠 삭제 가능
- 학생 콘텐츠와 추천 콘텐츠를 구분해서 표시하고, 추천 콘텐츠만 삭제 가능

### 10. **마스터 콘텐츠 범위 자동 설정**
**현재 문제:**
- 추천 콘텐츠 추가 시 기본값(교재: 1~100, 강의: 1~10)만 설정
- 실제 마스터 콘텐츠의 전체 범위를 반영하지 않음

**요구사항:**
- 마스터 콘텐츠의 `total_pages` 또는 `total_episodes`를 조회
- 자동으로 `start_range: 1, end_range: total_pages/total_episodes` 설정
- 사용자가 필요시 수정 가능

**구현 방안:**
```typescript
// 추천 콘텐츠 추가 시
const masterInfo = content.contentType === "book"
  ? await getMasterBookById(content.id)
  : await getMasterLectureById(content.id);

const defaultEndRange = content.contentType === "book"
  ? masterInfo?.book?.total_pages || 100
  : masterInfo?.lecture?.total_episodes || 10;
```

### 11. **Step 4 → Step 5 자동 스킵 안내 개선**
**현재 문제:**
- Step 4에서 9개 모두 선택하면 Step 5를 자동으로 스킵
- 사용자에게 명확한 안내가 없음

**요구사항:**
- Step 4에서 9개 선택 시 명확한 안내 메시지
- "다음" 버튼 클릭 시 Step 5를 건너뛰고 바로 제출한다는 안내
- 또는 Step 5로 이동하되 "추천 콘텐츠를 받을 수 없습니다" 메시지 표시

### 12. **과목별 균형 안내**
**현재 문제:**
- 필수 과목(국어, 수학, 영어)만 검증
- 다른 과목의 균형에 대한 안내 없음

**요구사항:**
- 과목별 선택 현황 시각화
- 필수 과목 외에도 과목별 균형 있는 선택 권장
- 예: "현재 5개 과목이 선택되었습니다. 균형 있는 학습을 위해 다른 과목도 고려해보세요."

### 13. **추천 콘텐츠 미리보기**
**현재 문제:**
- 추천 콘텐츠를 선택하기 전에 상세 정보를 확인하기 어려움
- 추천 이유만으로 판단해야 함

**요구사항:**
- 추천 콘텐츠 클릭 시 상세 정보 모달/드로어 표시
- 마스터 콘텐츠의 전체 정보 (출판사, 난이도, 총 페이지/회차 등) 표시
- 추천 이유 상세 설명

### 14. **진행 상황 시각화 개선**
**현재 문제:**
- 각 단계별 선택 현황이 명확하지 않음
- 전체 진행 상황을 한눈에 파악하기 어려움

**요구사항:**
- Step 4, 5에서 선택 현황을 더 명확하게 표시
- 예: "학생 콘텐츠 3개 / 추천 콘텐츠 2개 / 전체 5개 / 최대 9개"
- 과목별 선택 현황도 표시

### 15. **숫자 포맷팅 일관성**
**요구사항:**
- 모든 숫자를 소수점 2자리로 통일
- `formatNumber` 유틸리티 함수 생성
- 성적 통계, 시간 통계 등 모든 곳에 적용

**구현 방안:**
```typescript
// utils/formatNumber.ts
export function formatNumber(value: number): string {
  return value.toFixed(2);
}

// 사용 예시
formatNumber(4.333333) // "4.33"
formatNumber(4.5) // "4.50"
formatNumber(4) // "4.00"
```

### 16. **콘텐츠 선택 검증 강화**
**현재 문제:**
- 범위 검증만 있음
- 다른 검증 로직 부족

**요구사항:**
- 범위가 유효한지 검증 (start ≤ end, 양수 등)
- 마스터 콘텐츠의 전체 범위를 초과하지 않는지 검증
- 실시간 검증 및 피드백

### 17. **불필요한 정보 제거**
**요구사항:**
- UI에서 불필요한 정보 식별 및 제거
- 코드 리뷰 후 구체적인 위치 결정

