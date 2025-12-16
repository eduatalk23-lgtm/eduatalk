# 콘텐츠 메타데이터 탭 정리 및 코드 최적화

**작업일**: 2025-02-05  
**작업자**: AI Assistant

## 작업 개요

콘텐츠 메타데이터 관리 페이지의 하위 탭 메뉴를 정리하고, 중복 코드를 최적화하여 유지보수성을 향상시켰습니다.

## 주요 변경사항

### 1. Deprecated 탭 제거

**변경 파일**: `app/(admin)/admin/content-metadata/_components/ContentMetadataTabs.tsx`

- `hierarchy` 탭 제거 (기능이 `/admin/subjects`로 이동됨)
- 기본 탭을 `platforms`로 변경
- `CurriculumHierarchyManager` import 및 사용 제거

**변경 전**:
- 5개 탭: hierarchy, platforms, publishers, career-fields, difficulty-levels
- 기본 탭: hierarchy

**변경 후**:
- 4개 탭: platforms, publishers, career-fields, difficulty-levels
- 기본 탭: platforms

### 2. URL 쿼리 파라미터 기반 탭 관리

**변경 파일**: `app/(admin)/admin/content-metadata/_components/ContentMetadataTabs.tsx`

- `useSearchParams`와 `useRouter`를 사용하여 URL 쿼리 파라미터로 탭 상태 관리
- 직접 링크 접근 가능 (예: `/admin/content-metadata?tab=difficulty-levels`)
- 브라우저 뒤로가기/앞으로가기 지원

**구현 예시**:
```typescript
const activeTab = (searchParams.get("tab") as TabKey) || DEFAULT_TAB;

function handleTabChange(tab: TabKey) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", tab);
  router.push(`?${params.toString()}`, { scroll: false });
}
```

### 3. 공통 CRUD Manager 컴포넌트 생성

**새 파일**: `app/(admin)/admin/content-metadata/_components/BaseMetadataManager.tsx`

- 제네릭 타입을 사용한 재사용 가능한 컴포넌트
- 공통 CRUD 로직 추출 (loadItems, handleCreate, handleUpdate, handleDelete)
- Toast 알림 통합 (alert 대체)
- 일관된 UI 구조 제공

**인터페이스**:
```typescript
type BaseMetadataManagerProps<T extends BaseMetadataItem> = {
  title: string;
  fetchAction: () => Promise<T[]>;
  createAction: (name: string, displayOrder: number) => Promise<T>;
  updateAction: (id: string, data: Partial<T>) => Promise<T>;
  deleteAction: (id: string) => Promise<void>;
  namePlaceholder?: string;
  getInitialDisplayOrder?: (items: T[]) => number;
};
```

### 4. 기존 컴포넌트 리팩토링

#### PlatformsManager
**변경 파일**: `app/(admin)/admin/content-metadata/_components/PlatformsManager.tsx`

- 279줄 → 15줄로 감소 (약 95% 감소)
- BaseMetadataManager 사용

#### PublishersManager
**변경 파일**: `app/(admin)/admin/content-metadata/_components/PublishersManager.tsx`

- 280줄 → 15줄로 감소 (약 95% 감소)
- BaseMetadataManager 사용

#### CareerFieldsManager
**변경 파일**: `app/(admin)/admin/content-metadata/_components/CareerFieldsManager.tsx`

- 281줄 → 35줄로 감소 (약 88% 감소)
- BaseMetadataManager 사용
- createAction 반환 타입 차이를 처리하기 위한 래퍼 함수 추가

#### DifficultyLevelsManager
**변경 파일**: `app/(admin)/admin/content-metadata/_components/DifficultyLevelsManager.tsx`

- alert → Toast 알림으로 전환
- content_type 필터 기능 유지 (특수 기능이므로 BaseMetadataManager 미사용)
- 코드 정리 및 개선

### 5. Deprecated 경고 제거

**변경 파일**: `app/(admin)/admin/content-metadata/page.tsx`

- Deprecated 경고 제거
- 페이지 설명 업데이트

**변경 전**:
```
description="개정교육과정, 학년, 학기, 교과, 과목, 플랫폼, 출판사를 관리합니다."
```

**변경 후**:
```
description="플랫폼, 출판사, 진로 계열, 난이도를 관리합니다. 교과/과목 관리는 교과/과목 관리 페이지에서 진행해주세요."
```

## 코드 통계

### 코드 감소량

| 컴포넌트 | 변경 전 | 변경 후 | 감소율 |
|---------|--------|--------|--------|
| PlatformsManager | 279줄 | 15줄 | 95% |
| PublishersManager | 280줄 | 15줄 | 95% |
| CareerFieldsManager | 281줄 | 35줄 | 88% |
| DifficultyLevelsManager | 437줄 | 437줄 | 0% (Toast 전환만) |
| **BaseMetadataManager** | - | **200줄** | **신규** |
| **합계** | **1,277줄** | **702줄** | **45% 감소** |

### 중복 코드 제거

- 공통 상태 관리 로직: 4곳 → 1곳
- 공통 CRUD 로직: 4곳 → 1곳
- 공통 UI 구조: 4곳 → 1곳

## 개선 효과

### 1. 유지보수성 향상

- 공통 로직 변경 시 한 곳만 수정
- 새로운 메타데이터 타입 추가 시 빠른 구현 가능
- 일관된 UX 보장

### 2. 사용자 경험 개선

- Deprecated 혼란 제거
- URL 기반 탭 관리로 직접 링크 공유 가능
- Toast 알림으로 더 나은 피드백 제공

### 3. 코드 품질 향상

- 타입 안전성 보장 (제네릭 타입 사용)
- 중복 코드 제거
- 일관된 에러 처리

## 기술 스택

- **React**: useState, useEffect, 제네릭 타입
- **Next.js**: useSearchParams, useRouter (App Router)
- **Toast**: useToast 훅 사용
- **TypeScript**: 제네릭 타입으로 타입 안전성 보장

## 참고 자료

- React 탭 네비게이션 모범 사례 (Context7 검색 결과)
- Supabase 데이터베이스 스키마 확인 완료
- 현재 코드베이스 패턴 분석 완료

## 향후 개선 사항

1. **DifficultyLevelsManager**: content_type 필터 기능을 BaseMetadataManager에 옵션으로 추가 고려
2. **반응형 테이블**: 모바일 환경에서 카드 형태로 표시하는 기능 추가 고려
3. **설명 필드**: DifficultyLevelsManager의 description 필드 표시 개선

