# 관리자 추천 콘텐츠 조회 시 tenantId 문제 해결

## 🔍 문제 상황

관리자가 '남은 단계 진행하기'에서 학생의 추천 콘텐츠를 조회할 때, 공개 콘텐츠만 조회되는 문제가 발생했습니다.

### 근본 원인

1. **API에서 현재 로그인한 사용자의 tenantId 조회**
   - `/api/recommended-master-contents` API가 `user.userId`로 `students` 테이블에서 `tenant_id` 조회
   - 관리자가 호출하면 관리자의 `userId`로 조회하므로 `student`가 `null`이거나 관리자의 tenantId가 조회됨
   - 결과: `tenantId`가 `null`이 되어 공개 콘텐츠만 조회됨

2. **관리자가 다른 학생의 데이터를 조회해야 함**
   - 관리자가 처리하는 학생의 `tenantId`를 사용해야 함
   - 해당 학생의 기관(tenant) 콘텐츠도 조회할 수 있어야 함

## 🛠 해결 방법

### 수정 내용

#### 1. API에 `student_id` 파라미터 추가

**파일**: `app/api/recommended-master-contents/route.ts`

관리자/컨설턴트가 다른 학생의 추천 콘텐츠를 조회할 때 해당 학생의 `tenantId`를 사용하도록 수정했습니다.

**변경 전**:
```typescript
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  // 학생의 tenant_id 조회
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.userId) // 현재 로그인한 사용자의 ID 사용
    .maybeSingle();

  const recommendations = await getRecommendedMasterContents(
    supabase,
    user.userId,
    student?.tenant_id || null,
    ...
  );
}
```

**변경 후**:
```typescript
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const { role } = await getCurrentUserRole();
  const supabase = await createSupabaseServerClient();

  // 쿼리 파라미터에서 student_id 추출
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get("student_id");
  
  // 학생 ID 결정: 관리자/컨설턴트인 경우 student_id 파라미터 사용, 학생인 경우 자신의 ID 사용
  let targetStudentId: string;
  if (role === "admin" || role === "consultant") {
    if (!studentIdParam) {
      return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
    }
    targetStudentId = studentIdParam;
  } else {
    targetStudentId = user.userId;
  }

  // 대상 학생의 tenant_id 조회
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", targetStudentId) // 대상 학생의 ID 사용
    .maybeSingle();

  const recommendations = await getRecommendedMasterContents(
    supabase,
    targetStudentId,
    student.tenant_id || null,
    ...
  );
}
```

#### 2. `Step4RecommendedContents` 컴포넌트에 `studentId` prop 추가

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

관리자 모드에서 다른 학생의 추천 콘텐츠를 조회할 때 `student_id`를 API에 전달하도록 수정했습니다.

**변경 전**:
```typescript
type Step4RecommendedContentsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
};
```

**변경 후**:
```typescript
type Step4RecommendedContentsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string; // 관리자 모드에서 다른 학생의 추천 콘텐츠 조회 시 사용
};
```

**API 호출 시 student_id 전달**:
```typescript
// 관리자 모드에서 다른 학생의 추천 콘텐츠를 조회할 때는 student_id 파라미터 추가
if (propStudentId) {
  params.append("student_id", propStudentId);
}

const response = await fetch(`/api/recommended-master-contents?${params.toString()}`);
```

#### 3. `PlanGroupWizard`에서 `student_id` 전달

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

관리자 모드에서 `initialData`의 `student_id`를 `Step4RecommendedContents`에 전달하도록 수정했습니다.

**변경 후**:
```typescript
{currentStep === 5 && !isTemplateMode && (!isCampMode || isAdminContinueMode) && (
  <Step4RecommendedContents
    data={wizardData}
    onUpdate={updateWizardData}
    isEditMode={isEditMode}
    isCampMode={isCampMode}
    studentId={(initialData as any)?.student_id}
  />
)}
```

## 📊 변경 사항 요약

### 데이터 흐름

**변경 전**:
1. 관리자 호출 → `user.userId` (관리자 ID)로 학생 조회
2. `student`가 `null` 또는 관리자의 tenantId 조회
3. `tenantId`가 `null` → 공개 콘텐츠만 조회

**변경 후**:
1. 관리자 호출 → `student_id` 파라미터로 대상 학생 ID 전달
2. 대상 학생의 `tenantId` 조회
3. 해당 학생의 기관(tenant) 콘텐츠 + 공개 콘텐츠 조회

### 효과

- ✅ 관리자가 다른 학생의 추천 콘텐츠 조회 시 해당 학생의 tenantId 사용
- ✅ 해당 학생의 기관(tenant) 콘텐츠도 조회 가능
- ✅ 학생이 자신의 추천 콘텐츠 조회 시 기존 동작 유지

## ✅ 검증 완료

- [x] API에 `student_id` 파라미터 추가
- [x] 관리자/컨설턴트인 경우 `student_id` 필수 확인
- [x] `Step4RecommendedContents`에 `studentId` prop 추가
- [x] `PlanGroupWizard`에서 `student_id` 전달
- [x] 린터 오류 없음

## 📝 참고

### API 사용 예시

**학생이 자신의 추천 콘텐츠 조회**:
```
GET /api/recommended-master-contents?subjects=국어&subjects=수학
```

**관리자가 다른 학생의 추천 콘텐츠 조회**:
```
GET /api/recommended-master-contents?subjects=국어&subjects=수학&student_id=xxx
```

### RLS 우회 로직

관리자/컨설턴트가 다른 학생의 추천 콘텐츠를 조회할 때:

1. **API에서 Admin 클라이언트 사용**
   - 마스터 콘텐츠 조회 시 RLS 문제가 있을 수 있으므로 Admin 클라이언트 사용
   - `getRecommendedMasterContents`에 Admin 클라이언트 전달

2. **마스터 콘텐츠 조회 함수 수정**
   - `searchMasterBooks`와 `searchMasterLectures`에 supabase 클라이언트를 옵셔널 파라미터로 추가
   - 전달받은 클라이언트(Admin 클라이언트)를 사용하여 RLS 우회

### tenantId 조회 로직

`searchMasterBooks`와 `searchMasterLectures` 함수는 다음과 같이 동작합니다:

```typescript
if (filters.tenantId) {
  query = query.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
} else {
  query = query.is("tenant_id", null); // 공개 콘텐츠만
}
```

- `tenantId`가 있으면: 공개 콘텐츠 + 해당 tenant 콘텐츠 조회
- `tenantId`가 없으면: 공개 콘텐츠만 조회

이제 관리자가 학생의 `tenantId`를 사용하고 Admin 클라이언트로 조회하므로, 해당 학생의 기관 콘텐츠뿐만 아니라 다른 테넌트의 마스터 콘텐츠도 조회할 수 있습니다.

