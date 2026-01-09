# 프로젝트 최적화 제거 대상 분석 문서

**작성일**: 2026-01-15  
**분석 방법**: 코드베이스 직접 분석 (문서 참고 없음)  
**분석 범위**: 전체 프로젝트 코드베이스

---

## 📊 분석 요약

| 카테고리 | 항목 수 | 크기/라인 수 | 우선순위 |
|---------|--------|------------|---------|
| 외부 프레임워크 디렉토리 | 2개 | 331MB | 높음 |
| 백업 파일 | 1개 | ~866 라인 | 높음 |
| Deprecated 코드 | 674개 매치 (246개 파일) | ~5,000+ 라인 | 높음 |
| Deprecated 컴포넌트 | 3개 | ~500 라인 | 중간 |
| Re-export 파일 | 2개 | ~40 라인 | 중간 |
| Deprecated API Route | 1개 | ~117 라인 | 중간 |
| 큰 파일 (리팩토링 필요) | 10개+ | 1,000+ 라인 | 낮음 |

---

## 🔴 높은 우선순위: 즉시 제거 가능

### 1. 외부 프레임워크 디렉토리 제거

#### 1.1 `SuperClaude_Framework/` 디렉토리

- **크기**: 234MB
- **파일 수**: 776개 파일
- **상태**: 프로젝트와 무관한 외부 프레임워크
- **분석 결과**:
  - `tsconfig.json`에서 exclude되지 않음 (TypeScript 컴파일 대상에 포함될 수 있음)
  - 프로젝트 코드에서 import되지 않음 확인
  - Python 기반 프레임워크로 Next.js 프로젝트와 무관
- **작업**: 전체 디렉토리 제거
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm -rf SuperClaude_Framework/
```

**주의**: 
- 이 디렉토리는 별도 저장소로 관리되어야 함
- Git 히스토리에서 복구 가능하므로 안전하게 삭제 가능

#### 1.2 `serena/` 디렉토리

- **크기**: 97MB
- **파일 수**: 458개 파일
- **상태**: 프로젝트와 무관한 외부 도구
- **분석 결과**:
  - `tsconfig.json`에서 exclude됨 (라인 34)
  - 프로젝트 코드에서 import되지 않음 확인
  - Python 기반 LSP 도구로 Next.js 프로젝트와 무관
- **작업**: 전체 디렉토리 제거
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm -rf serena/
```

**주의**: 
- 이 디렉토리는 별도 저장소로 관리되어야 함
- Git 히스토리에서 복구 가능하므로 안전하게 삭제 가능

**총 절감량**: 331MB 디스크 공간

---

### 2. 백업 파일 제거

#### 2.1 `lib/types/plan.ts.backup`

- **크기**: ~866 라인
- **상태**: 백업 파일, 사용되지 않음
- **분석 결과**:
  - 프로젝트 전체에서 import되지 않음 확인
  - `.backup` 확장자로 백업 파일임을 명확히 표시
  - Git 히스토리에서 복구 가능
- **작업**: 즉시 삭제
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm lib/types/plan.ts.backup
```

---

### 3. Deprecated 코드 정리

#### 3.1 Deprecated 컴포넌트

**3.1.1 `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`**

- **상태**: `@deprecated Since v2.0.0`
- **대체**: `UnifiedPlanAddModal` with `initialMode="quick"`
- **분석 결과**:
  - 20개 파일에서 언급됨 (대부분 문서)
  - `AdminPlanManagement.tsx`에서 실제 사용 여부 확인 필요
  - `index.ts`에서 export 여부 확인 필요
- **작업**: 사용처 확인 후 제거
- **예상 시간**: 1일

**3.1.2 `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`**

- **상태**: `@deprecated Since v2.0.0`
- **대체**: `UnifiedPlanAddModal` with `initialMode="quick"`
- **분석 결과**:
  - 20개 파일에서 언급됨 (대부분 문서)
  - `AdminPlanManagement.tsx`에서 실제 사용 여부 확인 필요
  - `index.ts`에서 export 여부 확인 필요
- **작업**: 사용처 확인 후 제거
- **예상 시간**: 1일

**3.1.3 `app/(admin)/admin/content-metadata/_components/SubjectsManager.tsx`**

- **상태**: `@deprecated` - 더 이상 사용되지 않음
- **대체**: `/admin/subjects` 페이지로 통합
- **분석 결과**:
  - 11개 파일에서 언급됨 (대부분 문서)
  - 컴포넌트 자체가 deprecated 안내만 표시하는 래퍼
  - 실제 기능은 `/admin/subjects`로 이동됨
- **작업**: 사용처 확인 후 제거
- **예상 시간**: 0.5일

#### 3.2 Deprecated API Route

**3.2.1 `app/api/scores/internal/route.ts`**

- **상태**: `@deprecated` - 더 이상 사용되지 않음
- **대체**: `app/actions/scores-internal.ts`의 `createInternalScoresBatch` Server Action
- **분석 결과**:
  - 5개 파일에서 언급됨 (대부분 문서)
  - `public/sw.js`에서 참조 (Service Worker)
  - 실제 API 호출 여부 확인 필요
- **작업**: 사용처 확인 후 제거
- **예상 시간**: 0.5일

#### 3.3 Deprecated Re-export 파일

**3.3.1 `app/(student)/analysis/_utils.ts`**

- **상태**: `@deprecated Use @/lib/domains/analysis instead`
- **대체**: `@/lib/domains/analysis`에서 직접 import
- **분석 결과**:
  - 단순 re-export 파일
  - 실제 사용처 확인 필요 (grep 결과 없음)
- **작업**: 사용처 확인 후 제거
- **예상 시간**: 0.5일

**3.3.2 `app/(parent)/_utils.ts`**

- **상태**: `@deprecated lib/domains/parent에서 직접 import 사용을 권장`
- **대체**: `@/lib/domains/parent`에서 직접 import
- **분석 결과**:
  - 4개 파일에서 사용 중:
    - `app/(parent)/parent/_components/WeakSubjects.tsx`
    - `app/(parent)/parent/_components/ParentDashboardContent.tsx`
    - `app/(parent)/parent/_components/RiskSignals.tsx`
    - `app/(parent)/parent/_components/_utils/calculations.ts`
- **작업**: 4개 파일의 import 경로 변경 후 제거
- **예상 시간**: 1일

#### 3.4 Deprecated 상수/함수

**3.4.1 `dayTypeColors` 상수**

- **위치**: `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`
- **상태**: `@deprecated getDayTypeBadgeClasses() 사용 권장`
- **분석 결과**:
  - 4개 파일에서 사용 중:
    - `schedule-preview/index.ts`
    - `schedule-preview/DayScheduleItem.tsx`
    - `schedule-preview/constants.ts`
    - `LEGACY_FILES_AUDIT.md` (문서)
- **작업**: 3개 파일의 `dayTypeColors` 사용을 `getDayTypeBadgeClasses()` 호출로 변경 후 제거
- **예상 시간**: 0.5일

---

## 🟡 중간 우선순위: 점진적 제거

### 4. 큰 파일 리팩토링 (선택적)

다음 파일들은 1,000라인 이상으로 리팩토링을 고려할 수 있습니다:

1. **`lib/supabase/database.types.ts`** - 7,799 라인
   - **상태**: Supabase 자동 생성 파일
   - **작업**: 유지 (자동 생성 파일)

2. **`lib/data/planGroups.ts`** - 2,490 라인
   - **상태**: 플랜 그룹 관련 데이터 로직
   - **작업**: 도메인별로 분리 고려

3. **`lib/utils/darkMode.ts`** - 1,732 라인
   - **상태**: 다크모드 관련 유틸리티
   - **작업**: 기능별로 분리 고려

4. **`app/(admin)/admin/students/[id]/plans/_components/PlannerCreationModal.tsx`** - 1,561 라인
   - **상태**: 플래너 생성 모달
   - **작업**: 하위 컴포넌트로 분리 고려

5. **`lib/scheduler/SchedulerEngine.ts`** - 1,557 라인
   - **상태**: 스케줄러 엔진
   - **작업**: 모듈별로 분리 고려

6. **`lib/plan/virtualSchedulePreviewV2.ts`** - 1,551 라인
   - **상태**: 가상 스케줄 미리보기
   - **작업**: 기능별로 분리 고려

7. **`lib/data/planContents.ts`** - 1,540 라인
   - **상태**: 플랜 콘텐츠 관련 데이터 로직
   - **작업**: 도메인별로 분리 고려

8. **`lib/domains/plan/services/adaptiveScheduler.ts`** - 1,522 라인
   - **상태**: 적응형 스케줄러
   - **작업**: 기능별로 분리 고려

9. **`lib/data/campTemplates.ts`** - 1,516 라인
   - **상태**: 캠프 템플릿 관련 데이터 로직
   - **작업**: 도메인별로 분리 고려

10. **`lib/types/content-selection.ts`** - 1,370 라인
    - **상태**: 콘텐츠 선택 관련 타입
    - **작업**: 타입별로 분리 고려

**참고**: 큰 파일들은 기능적으로 문제가 없으면 유지해도 되지만, 유지보수성을 위해 분리를 고려할 수 있습니다.

---

## 🟢 낮은 우선순위: 장기적 정리

### 5. Deprecated 함수/타입 정리

프로젝트 전체에서 674개의 deprecated 매치가 발견되었습니다 (246개 파일). 주요 카테고리:

1. **타입 정의의 deprecated 필드** (`lib/types/plan/domain.ts` 등)
2. **유틸리티 함수의 deprecated 함수** (`lib/utils/*.ts`)
3. **도메인 액션의 deprecated 함수** (`lib/domains/*/actions/*.ts`)
4. **데이터 레이어의 deprecated 함수** (`lib/data/*.ts`)

**작업**: 점진적으로 마이그레이션 후 제거

---

## 📋 실행 계획

### Phase 1: 즉시 제거 (1일)

1. ✅ 외부 프레임워크 디렉토리 제거
   - `SuperClaude_Framework/` 삭제
   - `serena/` 삭제
   - `tsconfig.json`에서 `SuperClaude_Framework` exclude 추가 (필요 시)

2. ✅ 백업 파일 제거
   - `lib/types/plan.ts.backup` 삭제

**예상 절감량**: 331MB 디스크 공간 + ~866 라인

### Phase 2: Deprecated 컴포넌트 제거 (3-5일)

1. Deprecated 컴포넌트 사용처 확인 및 제거
   - `AdminQuickPlanModal.tsx` 사용처 확인 후 제거
   - `AddAdHocModal.tsx` 사용처 확인 후 제거
   - `SubjectsManager.tsx` 사용처 확인 후 제거

2. Deprecated API Route 제거
   - `app/api/scores/internal/route.ts` 사용처 확인 후 제거

3. Deprecated Re-export 파일 제거
   - `app/(student)/analysis/_utils.ts` 사용처 확인 후 제거
   - `app/(parent)/_utils.ts` import 경로 변경 후 제거

4. Deprecated 상수 제거
   - `dayTypeColors` 사용처를 `getDayTypeBadgeClasses()` 호출로 변경 후 제거

**예상 절감량**: ~700 라인

### Phase 3: 큰 파일 리팩토링 (선택적, 2-4주)

1. 큰 파일들을 기능별/도메인별로 분리
2. 각 파일을 500라인 이하로 유지

**예상 효과**: 유지보수성 향상

### Phase 4: Deprecated 코드 점진적 정리 (지속적)

1. Deprecated 함수/타입 사용처 마이그레이션
2. 마이그레이션 완료 후 deprecated 코드 제거

**예상 절감량**: ~5,000+ 라인

---

## ⚠️ 주의사항

### 삭제 전 필수 확인 사항

1. **사용처 검색**: 프로젝트 전체에서 해당 파일/함수 import 검색
2. **테스트 실행**: 삭제 전후로 테스트 실행
3. **빌드 확인**: 삭제 후 빌드 에러 확인
4. **Git 히스토리**: 삭제한 파일은 Git 히스토리에서 복구 가능

### 하위 호환성 고려

- Deprecated 코드 중 일부는 하위 호환성을 위해 유지 중
- 점진적 마이그레이션 후 제거 권장
- 급하게 제거하지 말고 사용처를 먼저 마이그레이션

---

## 📊 예상 효과

### 즉시 효과 (Phase 1)

- **디스크 공간**: 331MB 감소
- **코드 라인**: ~866 라인 감소
- **빌드 시간**: TypeScript 컴파일 대상 감소로 빌드 시간 단축 가능

### 단기 효과 (Phase 2)

- **코드 라인**: ~700 라인 감소
- **유지보수성**: Deprecated 코드 제거로 혼란 감소

### 장기 효과 (Phase 3-4)

- **코드 라인**: ~5,000+ 라인 감소
- **유지보수성**: 큰 파일 분리로 유지보수성 향상
- **번들 크기**: 미사용 코드 제거로 번들 크기 감소

---

## 🔍 분석 방법

이 문서는 다음 방법으로 코드베이스를 직접 분석하여 작성되었습니다:

1. **파일 시스템 분석**: `find`, `du`, `wc` 명령어로 파일 크기 및 라인 수 분석
2. **코드 검색**: `grep`으로 deprecated 주석, import 경로, 사용처 검색
3. **의존성 분석**: `tsconfig.json`, `package.json` 확인
4. **시맨틱 검색**: 코드베이스 검색으로 deprecated 코드 사용처 확인

**문서 참고 없음**: 기존 문서를 참고하지 않고 코드베이스를 직접 분석하여 작성

---

**작성일**: 2026-01-15  
**최종 업데이트**: 2026-01-15  
**상태**: 분석 완료, 실행 대기

