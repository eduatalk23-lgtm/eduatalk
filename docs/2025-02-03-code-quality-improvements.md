# 코드 품질 개선 작업

**작업 일자**: 2025-02-03  
**작업 내용**: N+1 쿼리 최적화, 타입 안전성 강화, 단위 테스트 작성

## 작업 개요

이전 리팩토링 작업을 통해 구조적인 개선이 이루어진 후, 코드의 완성도를 높이기 위해 다음 3가지 영역에 집중하여 개선 작업을 수행했습니다.

## 1. N+1 쿼리 최적화 및 성능 개선

### 1.1 `getPendingLinkRequests` 함수 최적화

**대상 파일**: `app/(admin)/actions/parentStudentLinkActions.ts`

**문제점**:
- 학부모 email 조회 로직이 TODO로 남아있어 실제로 email을 조회하지 못함
- 개별 조회 방식으로 N+1 문제 발생 가능성

**해결 방법**:
- `getAuthUserMetadata` 함수를 사용하여 배치로 email 조회
- Admin Client를 사용하여 auth.users 테이블에서 일괄 조회

**변경 사항**:
```typescript
// 이전: TODO 주석만 남아있음
// TODO: email 조회 로직 추가 필요 (auth.users는 PostgREST로 직접 조회 불가)

// 이후: 배치 조회로 개선
const { getAuthUserMetadata } = await import("@/lib/utils/authUserMetadata");
const adminClient = createSupabaseAdminClient();
const userMetadata = await getAuthUserMetadata(adminClient, parentIds);

userMetadata.forEach((metadata, userId) => {
  parentEmailsMap.set(userId, metadata.email);
});
```

**성능 개선 효과**:
- N개의 학부모에 대해 N번의 개별 조회 → 1번의 배치 조회로 변경
- 쿼리 수 감소로 응답 시간 단축

### 1.2 `AdminStudentsPage` 확인

**대상 파일**: `app/(admin)/admin/students/page.tsx`

**확인 결과**:
- 이미 배치 쿼리를 사용하고 있음 (`getStudentSchoolsBatch`, `getStudentPhonesBatch`, `getStudentGendersBatch`, `getAuthUserMetadata`)
- `Promise.all`을 사용하여 병렬 처리 최적화 완료
- N+1 문제 없음

## 2. 타입 안전성 강화 (`any` 제거)

### 2.1 `useCreateStudentForm.ts` 타입 안전성 개선

**대상 파일**: `app/(admin)/admin/students/_hooks/useCreateStudentForm.ts`

**문제점**:
- `resolver: zodResolver(createStudentFormSchema) as any`로 강제 형변환 사용
- Zod 스키마와 TypeScript 인터페이스 간 불일치 가능성

**해결 방법**:
1. Zod 스키마에서 추론한 타입(`CreateStudentFormSchema`) 사용
2. `as any` 제거
3. `CreateStudentFormData` 타입을 Zod 스키마 타입으로 재정의

**변경 사항**:
```typescript
// 이전
const form = useForm<CreateStudentFormData>({
  resolver: zodResolver(createStudentFormSchema) as any,
  defaultValues,
  // ...
});

// 이후
const form = useForm<CreateStudentFormSchema>({
  resolver: zodResolver(createStudentFormSchema),
  defaultValues,
  // ...
});
```

**타입 정의 변경**:
```typescript
// app/(admin)/admin/students/_types/createStudentTypes.ts
import type { CreateStudentFormSchema } from "@/lib/validation/createStudentFormSchema";

/**
 * @deprecated CreateStudentFormSchema를 직접 사용하세요.
 * 하위 호환성을 위해 유지되지만, Zod 스키마에서 추론한 타입을 사용하는 것이 권장됩니다.
 */
export type CreateStudentFormData = CreateStudentFormSchema;
```

**효과**:
- 타입 안전성 향상
- Zod 스키마와 TypeScript 타입의 일관성 보장
- 컴파일 타임 타입 체크 강화

## 3. 분리된 비즈니스 로직 단위 테스트 작성

### 3.1 `contentService.test.ts` 작성

**대상 파일**: `lib/domains/camp/services/contentService.test.ts`

**테스트 케이스**:
1. **`classifyExistingContents`**:
   - 기존 콘텐츠를 학생 콘텐츠와 추천 콘텐츠로 올바르게 분류
   - null/빈 배열 입력 처리
   - `is_auto_recommended` 및 `recommendation_source` 기반 분류

2. **`prepareContentsToSave`**:
   - 새로운 학생 콘텐츠가 있으면 기존 콘텐츠 대체
   - 새로운 추천 콘텐츠가 있으면 기존 콘텐츠 대체
   - wizardData에 콘텐츠가 없으면 기존 콘텐츠 보존
   - 학생 콘텐츠와 추천 콘텐츠 병합

3. **`validateAndResolveContent`**:
   - 학생 교재 존재 시 해당 ID 반환
   - 마스터 교재를 학생 교재로 복사
   - 커스텀 콘텐츠는 학생 ID로 직접 조회
   - 존재하지 않는 콘텐츠는 유효하지 않다고 판단

4. **`savePlanContents`**:
   - 빈 배열이면 저장하지 않음
   - 유효한 콘텐츠만 저장

**모킹 전략**:
- Supabase Client 모킹
- 외부 의존성(`@/lib/data/planGroups`, `@/lib/data/contentMasters`) 모킹
- DB 의존성 없이 로직 검증

### 3.2 `updateService.test.ts` 작성

**대상 파일**: `lib/domains/camp/services/updateService.test.ts`

**테스트 케이스**:
1. **`updatePlanGroupMetadata`**:
   - 플랜 그룹 메타데이터 올바르게 업데이트
   - `plan_purpose` 정규화 (수능 → 모의고사(수능))
   - 에러 발생 시 AppError throw

2. **`updatePlanExclusions`**:
   - 제외일이 undefined이면 아무것도 하지 않음
   - 제외일 배열이 비어있으면 삭제만 수행
   - 새로운 제외일 생성
   - 제외일 생성 실패 시 AppError throw

3. **`updateAcademySchedules`**:
   - 학원 일정이 undefined이면 아무것도 하지 않음
   - 중복되지 않은 새로운 학원 일정만 추가
   - 모든 학원 일정이 이미 존재하면 추가하지 않음
   - 학원 일정 생성 실패 시 AppError throw

**모킹 전략**:
- Supabase Client 모킹
- 외부 의존성(`@/lib/utils/schedulerOptionsMerge`, `@/lib/data/planGroups`) 모킹
- DB 의존성 없이 로직 검증

## 작업 결과

### 성능 개선
- ✅ N+1 쿼리 문제 해결 (`getPendingLinkRequests`)
- ✅ 배치 조회로 쿼리 수 감소

### 타입 안전성
- ✅ `any` 타입 제거
- ✅ Zod 스키마와 TypeScript 타입 일관성 보장
- ✅ 컴파일 타임 타입 체크 강화

### 테스트 커버리지
- ✅ `contentService.ts` 핵심 함수 테스트 작성
- ✅ `updateService.ts` 핵심 함수 테스트 작성
- ✅ 모킹을 통한 DB 의존성 제거

## 향후 개선 사항

1. **통합 테스트 추가**: 실제 DB를 사용하는 통합 테스트 고려
2. **성능 테스트**: 대량 데이터에 대한 성능 벤치마크
3. **타입 검증**: Zod 스키마와 TypeScript 타입 자동 동기화 검증

## 관련 파일

### 수정된 파일
- `app/(admin)/actions/parentStudentLinkActions.ts`
- `app/(admin)/admin/students/_hooks/useCreateStudentForm.ts`
- `app/(admin)/admin/students/_types/createStudentTypes.ts`

### 새로 생성된 파일
- `lib/domains/camp/services/contentService.test.ts`
- `lib/domains/camp/services/updateService.test.ts`

### 참고 파일
- `lib/utils/authUserMetadata.ts`
- `lib/validation/createStudentFormSchema.ts`
- `lib/domains/camp/services/contentService.ts`
- `lib/domains/camp/services/updateService.ts`

