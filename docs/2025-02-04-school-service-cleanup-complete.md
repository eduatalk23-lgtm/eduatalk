# School Service Deprecated 함수 정리 완료

**작성일**: 2025-02-04  
**작업 상태**: ✅ 완료

---

## 📋 작업 개요

`lib/domains/school/actions.ts`에서 deprecated 함수 호출을 제거하고, 직접 에러를 반환하도록 개선했습니다. `lib/domains/school/service.ts`의 deprecated 함수는 하위 호환성을 위해 유지했습니다.

---

## ✅ 완료된 작업

### lib/domains/school/actions.ts 개선

#### 1. createSchoolAction 개선 ✅
- **변경 전**: `service.createSchool()` 호출
- **변경 후**: 직접 에러 반환
- **효과**: 불필요한 함수 호출 제거, 명확한 에러 메시지

#### 2. updateSchoolAction 개선 ✅
- **변경 전**: `service.updateSchool()` 호출
- **변경 후**: 직접 에러 반환
- **효과**: 불필요한 함수 호출 제거, 명확한 에러 메시지

#### 3. deleteSchoolAction 개선 ✅
- **변경 전**: `service.deleteSchool()` 호출
- **변경 후**: 직접 에러 반환
- **효과**: 불필요한 함수 호출 제거, 명확한 에러 메시지

#### 4. autoRegisterSchoolAction 개선 ✅
- **변경 전**: `service.autoRegisterSchool()` 호출
- **변경 후**: `service.getSchoolByName()` 직접 호출 + `toSchoolSimple()` 변환
- **효과**: 기존 학교 검색 기능 유지, 불필요한 함수 호출 제거

---

## 📊 개선 통계

### 함수 호출 제거

| 함수 | 변경 전 | 변경 후 | 개선 효과 |
|------|---------|---------|----------|
| `createSchoolAction` | `service.createSchool()` 호출 | 직접 에러 반환 | 불필요한 호출 제거 |
| `updateSchoolAction` | `service.updateSchool()` 호출 | 직접 에러 반환 | 불필요한 호출 제거 |
| `deleteSchoolAction` | `service.deleteSchool()` 호출 | 직접 에러 반환 | 불필요한 호출 제거 |
| `autoRegisterSchoolAction` | `service.autoRegisterSchool()` 호출 | `service.getSchoolByName()` 직접 호출 | 불필요한 호출 제거 |

### checkDuplicateSchool 확인

- **사용처**: 없음
- **조치**: `lib/domains/school/service.ts`에 deprecated 함수로 유지 (하위 호환성)

---

## 🔍 개선 내용 상세

### createSchoolAction

**변경 전**:
```typescript
// Service 호출 (deprecated: 읽기 전용)
const result = await service.createSchool();

// Cache 무효화
if (result.success) {
  revalidatePath("/admin/schools");
}

return result;
```

**변경 후**:
```typescript
// 읽기 전용 테이블이므로 생성 불가
console.warn("[school/actions] createSchoolAction은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
return {
  success: false,
  error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
};
```

### updateSchoolAction

**변경 전**:
```typescript
// Service 호출 (deprecated: 읽기 전용)
const result = await service.updateSchool();

// Cache 무효화
if (result.success) {
  revalidatePath("/admin/schools");
  revalidatePath(`/admin/schools/${validation.data.id}`);
}

return result;
```

**변경 후**:
```typescript
// 읽기 전용 테이블이므로 수정 불가
console.warn("[school/actions] updateSchoolAction은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
return {
  success: false,
  error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
};
```

### deleteSchoolAction

**변경 전**:
```typescript
// Service 호출 (deprecated: 읽기 전용)
const result = await service.deleteSchool();

// Cache 무효화
if (result.success) {
  revalidatePath("/admin/schools");
}

return result;
```

**변경 후**:
```typescript
// 읽기 전용 테이블이므로 삭제 불가
console.warn("[school/actions] deleteSchoolAction은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
return {
  success: false,
  error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
};
```

### autoRegisterSchoolAction

**변경 전**:
```typescript
export async function autoRegisterSchoolAction(
  name: string,
  type: SchoolType,
  region?: string | null
): Promise<SchoolSimple | null> {
  // deprecated: 읽기 전용
  return service.autoRegisterSchool();
}
```

**변경 후**:
```typescript
export async function autoRegisterSchoolAction(
  name: string,
  type: SchoolType,
  region?: string | null
): Promise<SchoolSimple | null> {
  // 읽기 전용 테이블이므로 자동 등록 불가
  console.warn("[school/actions] autoRegisterSchoolAction은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
  
  // 기존 학교 검색만 수행 (하위 호환성)
  const existing = await service.getSchoolByName(name, type);
  if (existing) {
    return toSchoolSimple(existing);
  }
  
  // 등록 불가 - 읽기 전용
  return null;
}
```

---

## 🎯 주요 개선사항

### 1. 불필요한 함수 호출 제거
- deprecated 함수 호출 제거
- 직접 에러 반환으로 간소화
- 성능 개선 (불필요한 함수 호출 제거)

### 2. 코드 명확성 향상
- 에러 메시지 명확화
- 로직 단순화
- 의도 명확화

### 3. 하위 호환성 유지
- `lib/domains/school/service.ts`의 deprecated 함수는 유지
- 기존 API 인터페이스 유지
- `autoRegisterSchoolAction`은 기존 학교 검색 기능 유지

---

## 📝 변경된 파일 목록

### 수정된 파일
- `lib/domains/school/actions.ts` - deprecated 함수 호출 제거, 직접 에러 반환

### 유지된 파일
- `lib/domains/school/service.ts` - deprecated 함수 유지 (하위 호환성)

---

## 🔗 관련 문서

- [Repomix 개선 진행 상태 점검](./2025-02-04-repomix-improvement-status-check.md)
- [다음 단계 제안 업데이트](./2025-02-04-next-steps-updated.md)

---

## ✅ 완료 체크리스트

- [x] createSchoolAction 개선
- [x] updateSchoolAction 개선
- [x] deleteSchoolAction 개선
- [x] autoRegisterSchoolAction 개선
- [x] checkDuplicateSchool 사용처 확인 (사용처 없음)
- [x] 타입 import 추가 (toSchoolSimple)
- [x] 린트 에러 확인 및 수정
- [x] 개선 작업 문서화
- [x] Git 커밋 준비

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

