# 학교 관리 CRUD 및 페이지 이동 UI 점검 결과

**점검 일자**: 2025-02-08

## 현재 구현 상태

### ✅ 완료된 기능

#### 1. CRUD 기능
- **Create (생성)**: `/admin/schools/new` - `SchoolForm` 컴포넌트
- **Read (조회)**: `/admin/schools` - 목록 페이지 (검색, 필터링 지원)
- **Update (수정)**: `/admin/schools/[id]/edit` - `SchoolEditForm` 컴포넌트
- **Delete (삭제)**: `SchoolEditForm` 내 삭제 버튼

#### 2. 페이지 이동
- 목록 → 등록: ✅ "학교 등록" 버튼
- 목록 → 수정: ✅ 테이블의 "수정" 링크
- 등록 → 목록: ✅ 성공 시 자동 이동, 취소 버튼
- 수정 → 목록: ✅ 성공 시 자동 이동, 취소 버튼
- 삭제 → 목록: ✅ 성공 시 자동 이동

#### 3. 입력 필드
- 기본 필드: 학교명, 학교 타입, 지역, 표시 순서
- 학교 코드: ✅ 추가됨
- 주소 필드: 기본주소, 우편번호, 시/군/구, 상세주소, 읍/면/동, 전화번호
- 타입별 필드:
  - 고등학교: 유형 (일반고/특목고/자사고/특성화고)
  - 대학교: 유형 (4년제/2년제), 설립 유형 (국립/사립), 캠퍼스명

#### 4. 검색 및 필터링
- 학교 타입 필터: ✅
- 지역 필터: ✅
- 학교명 검색: ✅
- 초기화 버튼: ✅

## 개선 필요 사항

### 1. 알림 시스템 개선
**현재**: `alert()` 사용  
**개선**: Toast 알림으로 변경

**영향 파일**:
- `app/(admin)/admin/schools/new/SchoolForm.tsx`
- `app/(admin)/admin/schools/[id]/edit/SchoolEditForm.tsx`

### 2. 목록 페이지 정보 보강
**현재**: 기본 정보만 표시  
**개선**: 학교 코드 및 타입별 속성 표시

**추가할 컬럼**:
- 학교 코드
- 고등학교 유형 (고등학교인 경우)
- 대학교 유형/설립 유형 (대학교인 경우)

### 3. 삭제 확인 다이얼로그 개선 (선택사항)
**현재**: 기본 `confirm()` 사용  
**개선**: Dialog 컴포넌트 사용 (더 나은 UX)

## 권장 개선 작업

### 우선순위 1: Toast 알림 적용
- 사용자 경험 개선
- 다른 관리자 페이지와 일관성 유지

### 우선순위 2: 목록 페이지 정보 보강
- 학교 코드 표시로 식별 용이
- 타입별 속성으로 정보 파악 용이

### 우선순위 3: 삭제 확인 다이얼로그 개선
- 선택사항이지만 UX 개선 가능

## 파일 구조

```
app/(admin)/admin/schools/
├── page.tsx                    # 목록 페이지
├── new/
│   ├── page.tsx               # 등록 페이지
│   └── SchoolForm.tsx        # 등록 폼 컴포넌트
└── [id]/
    └── edit/
        ├── page.tsx          # 수정 페이지
        └── SchoolEditForm.tsx # 수정 폼 컴포넌트
```

## 액션 함수

**파일**: `app/(admin)/actions/schoolActions.ts`
- `createSchool()`: 학교 생성
- `updateSchool()`: 학교 수정
- `deleteSchool()`: 학교 삭제

## 데이터 레이어

**파일**: `lib/data/schools.ts`
- `getSchools()`: 학교 목록 조회
- `getSchoolById()`: 학교 상세 조회
- `getSchoolByCode()`: 학교 코드로 조회
- `getSchoolByName()`: 학교명으로 조회
- `getRegions()`: 지역 목록 조회
- `getRegionsByParent()`: 하위 지역 조회
- `getRegionsByLevel()`: 레벨별 지역 조회
- `getRegionHierarchy()`: 지역 위계 구조 조회

## 권한 체크

- **생성/수정/삭제**: `admin` 또는 `consultant` 역할만 가능
- **조회**: 모든 사용자 가능

## 다음 단계

1. Toast 알림 적용
2. 목록 페이지 정보 보강
3. (선택) 삭제 확인 다이얼로그 개선

