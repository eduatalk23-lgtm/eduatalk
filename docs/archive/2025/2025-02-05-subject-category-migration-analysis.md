# subject_category → subject_group 마이그레이션 분석 및 권장사항

**작업 일시**: 2025-02-05  
**작업 범위**: `lib/data/contentMasters.ts`의 `subject_category` 사용 분석  
**목적**: 레거시 `subject_category` 스키마 사용 정리 및 `subject_group` 계층 구조 완전 채택

---

## 📋 현재 상태 분석

### `lib/data/contentMasters.ts`에서 `subject_category` 사용 현황

#### 1. **타입 정의 및 반환 타입** (라인 254, 428)
- `getMasterBookById` 함수의 반환 타입에 `subject_category?: string | null` 포함
- 하위 호환성을 위해 유지됨

#### 2. **데이터베이스 쿼리** (라인 287)
- `master_books` 테이블에서 `subject_category` 컬럼을 직접 SELECT
- Denormalized 값으로 저장되어 있음

#### 3. **데이터 매핑 로직** (라인 377-418)
```typescript
// 현재 로직: denormalized 값 우선, 없으면 JOIN 결과 사용
subject_category: bookData.subject_category || subjectGroup?.name || null,
```

**현재 접근 방식**:
- Denormalized `subject_category` 컬럼 값을 우선 사용
- 없으면 `subject_group_id`를 통해 JOIN한 `subject_groups.name`을 fallback으로 사용
- 성능 최적화를 위한 설계 (JOIN은 fallback으로만 활용)

#### 4. **CRUD 작업** (라인 1568, 1634, 1734, 1788)
- `createMasterBook`, `updateMasterBook`, `createMasterLecture`, `updateMasterLecture`에서 `subject_category` 필드 처리
- 데이터 생성/수정 시 `subject_category` 필드를 직접 설정

#### 5. **학생 콘텐츠 복사** (라인 701, 806)
- `copyMasterBookToStudent`, `copyMasterLectureToStudent`에서 `subject_category` 값을 학생 콘텐츠로 복사

---

## 🔍 문제점 및 개선 필요 사항

### 1. **Denormalized 값과 JOIN 값의 불일치 가능성**
- `subject_category` 컬럼 값과 `subject_groups.name` 값이 다를 수 있음
- 데이터 일관성 문제 발생 가능

### 2. **하위 호환성 유지로 인한 복잡성**
- 두 가지 데이터 소스를 모두 처리해야 함
- 코드 복잡도 증가

### 3. **마이그레이션 미완료**
- `subject_category` 컬럼이 여전히 사용 중
- 완전한 마이그레이션이 필요함

---

## ✅ 권장사항

### 단기 개선 (즉시 적용 가능)

#### 1. **JOIN 우선, Denormalized 값은 Fallback으로 변경**
```typescript
// 현재 (라인 418)
subject_category: bookData.subject_category || subjectGroup?.name || null,

// 권장
subject_category: subjectGroup?.name || bookData.subject_category || null,
```

**이유**:
- `subject_groups` 테이블이 정규화된 데이터 소스
- JOIN 결과가 더 정확하고 일관성 있음
- Denormalized 값은 하위 호환성을 위한 fallback으로만 사용

#### 2. **데이터 생성/수정 시 `subject_group_id` 우선 사용**
- `subject_group_id`를 통해 `subject_groups.name`을 자동으로 가져와서 `subject_category`에 설정
- 또는 `subject_category` 필드를 제거하고 JOIN만 사용

#### 3. **로그 및 주석 개선**
- 현재 로직의 의도를 명확히 문서화
- 마이그레이션 계획 명시

### 중기 개선 (점진적 마이그레이션)

#### 1. **`subject_category` 컬럼 제거 준비**
- 모든 코드에서 `subject_group_id`와 JOIN을 통한 `subject_groups.name` 사용으로 전환
- `subject_category` 컬럼은 읽기 전용으로 유지 (하위 호환성)

#### 2. **데이터 마이그레이션 스크립트 작성**
- 기존 `subject_category` 값을 `subject_groups.name`으로 업데이트
- 불일치 데이터 정리

#### 3. **타입 정의 정리**
- `subject_category` 필드를 optional로 유지하되, 사용을 점진적으로 줄임

### 장기 개선 (완전한 마이그레이션)

#### 1. **`subject_category` 컬럼 제거**
- 모든 코드에서 `subject_group_id`와 JOIN만 사용
- 데이터베이스 스키마에서 `subject_category` 컬럼 제거

#### 2. **타입 정의에서 `subject_category` 제거**
- 반환 타입에서 `subject_category` 필드 제거
- `subject_group_id`와 `subject_groups` JOIN 결과만 사용

---

## 📝 구체적인 코드 변경 제안

### 변경 1: `getMasterBookById` 함수 개선

```typescript
// 현재 (라인 418)
subject_category: bookData.subject_category || subjectGroup?.name || null,

// 권장 변경
subject_category: subjectGroup?.name || bookData.subject_category || null,
```

**이유**: JOIN 결과를 우선 사용하여 정규화된 데이터 소스 활용

### 변경 2: CRUD 함수에서 `subject_group_id` 우선 사용

```typescript
// createMasterBook, updateMasterBook에서
// subject_group_id가 있으면 자동으로 subject_groups.name을 가져와서 설정
if (data.subject_group_id && !data.subject_category) {
  const group = await getSubjectGroupById(data.subject_group_id);
  if (group) {
    data.subject_category = group.name;
  }
}
```

### 변경 3: 주석 추가

```typescript
/**
 * 교재 상세 조회
 * 
 * @note subject_category 필드:
 * - 하위 호환성을 위해 유지됨
 * - 우선순위: subject_groups.name (JOIN) > subject_category (denormalized)
 * - 향후 마이그레이션: subject_group_id와 JOIN만 사용 예정
 */
```

---

## 🚨 주의사항

### 1. **하위 호환성 유지**
- 기존 코드가 `subject_category` 필드를 사용할 수 있으므로 완전 제거 전까지 유지 필요
- 점진적 마이그레이션 필요

### 2. **성능 고려**
- JOIN을 우선 사용하면 쿼리 성능에 영향이 있을 수 있음
- 하지만 데이터 일관성과 정확성이 더 중요

### 3. **데이터 일관성**
- Denormalized 값과 JOIN 값이 다를 수 있으므로 데이터 검증 필요
- 마이그레이션 전 데이터 정리 작업 필요

---

## ✅ 체크리스트

- [x] `SubjectCategoriesManager.tsx` 리팩토링 완료
- [x] `contentMetadataActions.ts`에서 deprecated 액션 표시 완료
- [ ] `lib/data/contentMasters.ts`에서 JOIN 우선 사용으로 변경 (권장사항 제공)
- [ ] 데이터 마이그레이션 스크립트 작성 (향후 작업)
- [ ] `subject_category` 컬럼 제거 (장기 작업)

---

**작업 완료**: 2025-02-05  
**다음 단계**: `lib/data/contentMasters.ts`의 JOIN 우선 사용 변경 적용 (선택사항)

