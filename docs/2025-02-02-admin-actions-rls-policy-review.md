# 관리자 영역 RLS 정책 문제 검토

## 📋 검토 개요

관리자 영역의 기능들이 RLS 정책으로 차단되는 문제를 검토하고 해결 방안을 제시합니다.

## 🔍 문제 분석

### 발견된 문제

1. **캠프 템플릿 삭제** - 이미 수정 완료
   - 삭제된 행이 0개로 확인됨
   - Admin Client로 재시도 로직 추가 완료

2. **다른 관리자 기능들**
   - 학생 삭제, 학부모-학생 연결 삭제, 과목 삭제 등
   - 대부분 Server Client만 사용하여 RLS 정책으로 차단될 가능성

### RLS 정책 문제가 발생하는 이유

1. **관리자 권한 확인은 되지만 RLS 정책이 적용됨**
   - `requireAdminOrConsultant()`로 권한은 확인
   - 하지만 Supabase RLS는 데이터베이스 레벨에서 적용
   - 애플리케이션 레벨 권한 확인과 RLS 정책이 별개로 작동

2. **테넌트 간 데이터 접근**
   - 관리자가 다른 테넌트의 데이터를 수정해야 하는 경우
   - RLS 정책이 테넌트를 제한할 수 있음

3. **DELETE 작업의 특수성**
   - DELETE 작업은 특히 RLS 정책이 엄격하게 적용됨
   - 삭제된 행이 0개여도 에러가 발생하지 않을 수 있음

## 📊 주요 관리자 액션 분석

### DELETE 작업이 있는 액션들

| 액션 파일 | DELETE 작업 수 | 현재 클라이언트 | Admin Client 필요 여부 |
|----------|---------------|---------------|---------------------|
| `campTemplateActions.ts` | 1 | Server → Admin (재시도) | ✅ 수정 완료 |
| `studentManagementActions.ts` | 7+ | Server | ⚠️ 수정 필요 |
| `parentStudentLinkActions.ts` | 3 | Server | ⚠️ 수정 필요 |
| `subjectActions.ts` | 3 | Admin (일부) | ⚠️ 일부 수정 필요 |
| `attendanceActions.ts` | 0 | - | - |
| `tenantBlockSets.ts` | 1 | Server | ⚠️ 수정 필요 |
| `consultingNoteActions.ts` | 1 | Server | ⚠️ 수정 필요 |

### UPDATE 작업이 있는 액션들

| 액션 파일 | UPDATE 작업 수 | 현재 클라이언트 | Admin Client 필요 여부 |
|----------|---------------|---------------|---------------------|
| `studentManagementActions.ts` | 4+ | Server | ⚠️ 수정 필요 |
| `parentStudentLinkActions.ts` | 2 | Server | ⚠️ 수정 필요 |
| `subjectActions.ts` | 3 | Admin (일부) | ⚠️ 일부 수정 필요 |
| `attendanceActions.ts` | 1 | Server | ⚠️ 수정 필요 |

## ✅ 해결 방안

### 패턴 1: Admin Client 자동 재시도 (권장)

캠프 템플릿 삭제에서 사용한 패턴을 다른 DELETE 작업에도 적용:

```typescript
// 1. 먼저 Server Client로 시도
const supabase = await createSupabaseServerClient();
const { data: deletedRows, error } = await supabase
  .from("table_name")
  .delete()
  .eq("id", id)
  .select();

let deletedSuccessfully = false;

if (error) {
  console.warn("Server Client 삭제 실패, Admin Client로 재시도:", error);
} else if (deletedRows && deletedRows.length > 0) {
  deletedSuccessfully = true;
} else {
  console.warn("삭제된 행이 없음, Admin Client로 재시도");
}

// 2. 실패 시 Admin Client로 재시도
if (!deletedSuccessfully) {
  const adminSupabase = createSupabaseAdminClient();
  const { data: adminDeletedRows, error: adminError } = await adminSupabase
    .from("table_name")
    .delete()
    .eq("id", id)
    .select();

  if (adminError || !adminDeletedRows || adminDeletedRows.length === 0) {
    throw new AppError("삭제에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
  }
}
```

### 패턴 2: 직접 Admin Client 사용 (특수한 경우)

전역 관리 작업이나 테넌트 간 데이터 접근이 필요한 경우:

```typescript
// 전역 관리 작업이므로 Admin Client 직접 사용
const supabaseAdmin = createSupabaseAdminClient();
const { error } = await supabaseAdmin
  .from("table_name")
  .delete()
  .eq("id", id);
```

## 📝 수정이 필요한 주요 액션

### 1. studentManagementActions.ts

**수정 필요 작업**:
- `deleteStudent()` - 여러 DELETE 작업
- `toggleStudentStatus()` - UPDATE 작업
- `updateStudentClass()` - UPDATE 작업
- `updateStudentInfo()` - UPDATE 작업

**우선순위**: 높음 (학생 관리 핵심 기능)

### 2. parentStudentLinkActions.ts

**수정 필요 작업**:
- `removeParentLink()` - DELETE 작업
- `rejectLinkRequest()` - DELETE 작업
- `updateParentRelation()` - UPDATE 작업
- `approveLinkRequest()` - UPDATE 작업

**우선순위**: 중간

### 3. subjectActions.ts

**수정 필요 작업**:
- `deleteSubject()` - DELETE 작업 (일부는 이미 Admin Client 사용)
- `updateSubject()` - UPDATE 작업 (일부는 이미 Admin Client 사용)

**우선순위**: 중간

### 4. tenantBlockSets.ts

**수정 필요 작업**:
- 블록 세트 삭제 - DELETE 작업

**우선순위**: 낮음

### 5. consultingNoteActions.ts

**수정 필요 작업**:
- `deleteConsultingNote()` - DELETE 작업

**우선순위**: 낮음

## 🎯 권장 수정 순서

1. **1단계**: 학생 관리 핵심 기능 (`studentManagementActions.ts`)
   - 학생 삭제
   - 학생 상태 변경
   - 학생 정보 수정

2. **2단계**: 학부모-학생 연결 관리 (`parentStudentLinkActions.ts`)
   - 연결 삭제
   - 연결 승인/거부

3. **3단계**: 과목 관리 (`subjectActions.ts`)
   - 과목 삭제
   - 과목 수정

4. **4단계**: 기타 기능들
   - 블록 세트 삭제
   - 상담 노트 삭제

## 📚 참고 사항

### RLS 정책 확인 방법

1. Supabase Dashboard에서 RLS 정책 확인
2. 마이그레이션 파일에서 RLS 정책 확인
3. 실제 삭제/수정 작업 시 삭제된 행 수 확인

### Admin Client 사용 시 주의사항

1. **보안**: Admin Client는 RLS를 우회하므로 신중하게 사용
2. **권한 확인**: Admin Client 사용 전에 애플리케이션 레벨 권한 확인 필수
3. **로깅**: Admin Client 사용 시 로그 기록 필수
4. **에러 처리**: Admin Client 사용 실패 시 명확한 에러 메시지

### 성능 고려사항

- Admin Client는 Service Role Key를 사용하므로 보안상 주의 필요
- 가능하면 Server Client를 먼저 시도하고, 실패 시에만 Admin Client 사용
- 불필요한 Admin Client 사용은 피해야 함

## 🔄 다음 단계

1. 우선순위에 따라 주요 액션들 수정
2. 각 수정 후 테스트 진행
3. RLS 정책 문제가 지속되는 경우 마이그레이션으로 정책 수정 검토

