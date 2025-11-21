# `/settings` 페이지 최적화 및 개선 제안

## 📊 현재 상태 분석

### 코드 구조
- **총 라인 수**: 737줄
- **상태 관리**: 10개의 useState 훅
- **부수 효과**: 3개의 useEffect 훅
- **최적화 훅**: useMemo, useCallback 미사용

### 주요 문제점

1. **성능 이슈**
   - 학교 타입 감지 로직이 5곳 이상 중복
   - 매 렌더링마다 계산되는 값들 (학교 타입, 학년 표시 등)
   - 핸들러 함수가 매 렌더링마다 재생성

2. **코드 중복**
   - 학교 타입 감지 로직 반복
   - 학년 변환 로직 반복
   - 폼 데이터 업데이트 패턴 반복

3. **타입 안전성**
   - `as any` 사용 다수 (gender, curriculum_revision 등)
   - 타입 가드 부족

4. **UX 개선 여지**
   - 변경사항 추적 없음
   - 연락처 자동 포맷팅 없음
   - 폼 유효성 검증 부족
   - 로딩 상태가 단순 텍스트

---

## 🚀 최적화 제안

### 1. 성능 최적화 (우선순위: ★★★★★)

#### 1.1 useMemo로 계산 값 메모이제이션

```typescript
// 학교 타입 감지 유틸 함수
const detectSchoolType = (school: string | null | undefined): "중학교" | "고등학교" | "" => {
  if (!school || typeof school !== "string") return "";
  if (school.includes("중") || school.includes("중학교")) return "중학교";
  if (school.includes("고") || school.includes("고등학교")) return "고등학교";
  return "";
};

// 컴포넌트 내부
const schoolType = useMemo(
  () => detectSchoolType(formData.school),
  [formData.school]
);

const gradeDisplay = useMemo(() => {
  if (!formData.grade) return "";
  if (schoolType === "중학교") return `중${formData.grade}학년`;
  if (schoolType === "고등학교") return `고${formData.grade}학년`;
  return `${formData.grade}학년`;
}, [formData.grade, schoolType]);
```

#### 1.2 useCallback으로 핸들러 메모이제이션

```typescript
const handleFieldChange = useCallback(
  (field: keyof typeof formData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  },
  []
);

const handleSchoolTypeChange = useCallback((schoolType: "중학교" | "고등학교" | "") => {
  setSchoolTypeFilter(schoolType);
  if (schoolType) {
    setFormData((prev) => ({ ...prev, school: "" }));
  }
}, []);
```

#### 1.3 컴포넌트 분리로 리렌더링 최소화

```typescript
// 각 탭을 별도 컴포넌트로 분리
const BasicInfoTab = memo(({ formData, onChange, schoolTypeFilter, onSchoolTypeChange }) => {
  // ...
});

const ExamInfoTab = memo(({ formData, onChange, autoCalculate, onAutoCalculateChange }) => {
  // ...
});

const CareerInfoTab = memo(({ formData, onChange }) => {
  // ...
});
```

---

### 2. 코드 품질 개선 (우선순위: ★★★★☆)

#### 2.1 유틸리티 함수 분리

```typescript
// lib/utils/studentFormUtils.ts
export function detectSchoolType(
  school: string | null | undefined
): "중학교" | "고등학교" | "" {
  if (!school || typeof school !== "string") return "";
  if (school.includes("중") || school.includes("중학교")) return "중학교";
  if (school.includes("고") || school.includes("고등학교")) return "고등학교";
  return "";
}

export function parseGradeNumber(
  grade: string | number | null | undefined
): string {
  if (!grade) return "";
  if (typeof grade === "number") return grade.toString();
  if (typeof grade === "string") {
    const match = grade.match(/\d+/);
    return match ? match[0] : grade;
  }
  return "";
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  return phone;
}
```

#### 2.2 타입 안전성 개선

```typescript
// 타입 정의 강화
type Gender = "남" | "여";
type CurriculumRevision = "2009 개정" | "2015 개정" | "2022 개정";
type CareerField = 
  | "인문계열" | "사회계열" | "자연계열" | "공학계열" 
  | "의약계열" | "예체능계열" | "교육계열" | "농업계열" 
  | "해양계열" | "기타";

type FormData = {
  name: string;
  school: string;
  grade: string;
  birth_date: string;
  gender: Gender | "";
  phone: string;
  mother_phone: string;
  father_phone: string;
  exam_year: string;
  curriculum_revision: CurriculumRevision | "";
  desired_university_1: string;
  desired_university_2: string;
  desired_university_3: string;
  desired_career_field: CareerField | "";
};
```

#### 2.3 커스텀 훅으로 로직 분리

```typescript
// hooks/useStudentForm.ts
export function useStudentForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      setHasChanges(true);
      return updated;
    });
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "이름을 입력해주세요";
    }
    
    if (formData.phone && !/^01[0-9]-\d{4}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = "올바른 전화번호 형식이 아닙니다";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  return {
    formData,
    updateField,
    hasChanges,
    errors,
    validateForm,
    resetChanges: () => setHasChanges(false),
  };
}
```

---

### 3. UX 개선 (우선순위: ★★★★☆)

#### 3.1 변경사항 추적 및 저장 전 확인

```typescript
const [hasChanges, setHasChanges] = useState(false);
const initialFormDataRef = useRef<FormData>(formData);

useEffect(() => {
  const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
  setHasChanges(hasChanged);
}, [formData]);

// 페이지 이탈 시 확인
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [hasChanges]);
```

#### 3.2 연락처 자동 포맷팅

```typescript
const handlePhoneChange = useCallback((field: "phone" | "mother_phone" | "father_phone") => 
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    let formatted = value;
    
    if (value.length <= 3) {
      formatted = value;
    } else if (value.length <= 7) {
      formatted = `${value.slice(0, 3)}-${value.slice(3)}`;
    } else if (value.length <= 11) {
      formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
    } else {
      formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
    }
    
    setFormData((prev) => ({ ...prev, [field]: formatted }));
  },
  []
);
```

#### 3.3 로딩 상태 개선 (스켈레톤 UI)

```typescript
// components/ui/SkeletonForm.tsx
export function SkeletonForm() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 bg-gray-200 rounded-lg" />
      ))}
    </div>
  );
}

// 사용
if (loading) {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <SkeletonForm />
      </div>
    </div>
  );
}
```

#### 3.4 폼 유효성 검증 강화

```typescript
const validateField = useCallback((field: keyof FormData, value: string) => {
  switch (field) {
    case "name":
      if (!value.trim()) return "이름을 입력해주세요";
      if (value.length < 2) return "이름은 2자 이상 입력해주세요";
      break;
    case "phone":
    case "mother_phone":
    case "father_phone":
      if (value && !/^01[0-9]-\d{4}-\d{4}$/.test(value)) {
        return "올바른 전화번호 형식이 아닙니다 (010-1234-5678)";
      }
      break;
    case "birth_date":
      if (!value) return "생년월일을 선택해주세요";
      const birthYear = new Date(value).getFullYear();
      if (birthYear < 2000 || birthYear > 2015) {
        return "올바른 생년월일을 선택해주세요";
      }
      break;
  }
  return "";
}, []);
```

---

### 4. 접근성 개선 (우선순위: ★★★☆☆)

#### 4.1 ARIA 레이블 추가

```typescript
<input
  type="text"
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
  aria-label="이름"
  aria-required="true"
  aria-invalid={errors.name ? "true" : "false"}
  aria-describedby={errors.name ? "name-error" : undefined}
/>
{errors.name && (
  <p id="name-error" className="text-sm text-red-500" role="alert">
    {errors.name}
  </p>
)}
```

#### 4.2 키보드 네비게이션 개선

```typescript
// 탭 키보드 네비게이션
const handleTabKeyDown = (e: React.KeyboardEvent, tabId: Tab) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setActiveTab(tabId);
  }
};
```

---

### 5. 코드 구조 개선 (우선순위: ★★★☆☆)

#### 5.1 탭별 컴포넌트 분리

```typescript
// app/(student)/settings/_components/BasicInfoTab.tsx
export const BasicInfoTab = memo(({ 
  formData, 
  onChange, 
  schoolTypeFilter, 
  onSchoolTypeChange,
  errors 
}: BasicInfoTabProps) => {
  // 기본 정보 탭 로직
});

// app/(student)/settings/_components/ExamInfoTab.tsx
export const ExamInfoTab = memo(({ 
  formData, 
  onChange, 
  autoCalculate,
  onAutoCalculateChange,
  errors 
}: ExamInfoTabProps) => {
  // 입시 정보 탭 로직
});

// app/(student)/settings/_components/CareerInfoTab.tsx
export const CareerInfoTab = memo(({ 
  formData, 
  onChange,
  errors 
}: CareerInfoTabProps) => {
  // 진로 정보 탭 로직
});
```

#### 5.2 폼 상태 관리 커스텀 훅

```typescript
// hooks/useStudentSettings.ts
export function useStudentSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  
  const form = useStudentForm();
  
  // 데이터 로드
  const loadStudent = useCallback(async () => {
    // ...
  }, []);
  
  // 저장
  const saveStudent = useCallback(async () => {
    // ...
  }, [form.formData]);
  
  return {
    loading,
    saving,
    student,
    toast,
    form,
    loadStudent,
    saveStudent,
    setToast,
  };
}
```

---

## 📋 구현 우선순위

### Phase 1: 즉시 적용 (1-2일)
1. ✅ 유틸리티 함수 분리 (학교 타입 감지, 학년 변환)
2. ✅ useMemo로 계산 값 메모이제이션
3. ✅ useCallback으로 핸들러 메모이제이션
4. ✅ 연락처 자동 포맷팅

### Phase 2: 단기 개선 (3-5일)
1. ✅ 타입 안전성 개선 (as any 제거)
2. ✅ 변경사항 추적 및 저장 전 확인
3. ✅ 폼 유효성 검증 강화
4. ✅ 로딩 상태 개선 (스켈레톤 UI)

### Phase 3: 중기 개선 (1-2주)
1. ✅ 컴포넌트 분리 (탭별 컴포넌트)
2. ✅ 커스텀 훅으로 로직 분리
3. ✅ 접근성 개선 (ARIA, 키보드 네비게이션)

---

## 📊 예상 효과

### 성능 개선
- **리렌더링 감소**: 30-40% 감소 예상
- **초기 로딩 시간**: 스켈레톤 UI로 인한 체감 속도 개선
- **메모리 사용**: 메모이제이션으로 불필요한 객체 생성 감소

### 코드 품질
- **중복 코드 제거**: 약 200줄 감소 예상
- **타입 안전성**: as any 사용 0개로 감소
- **유지보수성**: 컴포넌트 분리로 테스트 용이성 향상

### UX 개선
- **사용자 실수 방지**: 변경사항 추적 및 확인
- **입력 편의성**: 연락처 자동 포맷팅
- **피드백 개선**: 실시간 유효성 검증 및 에러 표시

---

## 🔧 추가 제안

### 1. React Query 도입
```typescript
// 서버 상태 관리 개선
const { data: student, isLoading } = useQuery({
  queryKey: ["student", "current"],
  queryFn: getCurrentStudent,
});

const mutation = useMutation({
  mutationFn: updateStudentProfile,
  onSuccess: () => {
    queryClient.invalidateQueries(["student", "current"]);
  },
});
```

### 2. 폼 라이브러리 도입
```typescript
// React Hook Form + Zod
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const studentSchema = z.object({
  name: z.string().min(2, "이름은 2자 이상 입력해주세요"),
  phone: z.string().regex(/^01[0-9]-\d{4}-\d{4}$/, "올바른 전화번호 형식이 아닙니다"),
  // ...
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(studentSchema),
});
```

### 3. 에러 바운더리 추가
```typescript
// components/ErrorBoundary.tsx
export class SettingsErrorBoundary extends React.Component {
  // 에러 처리 로직
}
```

---

## 📝 체크리스트

### 성능 최적화
- [ ] useMemo로 계산 값 메모이제이션
- [ ] useCallback으로 핸들러 메모이제이션
- [ ] React.memo로 컴포넌트 최적화
- [ ] 불필요한 리렌더링 제거

### 코드 품질
- [ ] 유틸리티 함수 분리
- [ ] 타입 안전성 개선
- [ ] 중복 코드 제거
- [ ] 커스텀 훅으로 로직 분리

### UX 개선
- [ ] 변경사항 추적
- [ ] 연락처 자동 포맷팅
- [ ] 폼 유효성 검증
- [ ] 로딩 상태 개선
- [ ] 에러 메시지 개선

### 접근성
- [ ] ARIA 레이블 추가
- [ ] 키보드 네비게이션 개선
- [ ] 포커스 관리

---

**작성일**: 2025-01-27  
**작성자**: AI Assistant  
**버전**: 1.0

