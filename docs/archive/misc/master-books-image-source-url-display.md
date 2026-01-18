# master_books 교재 이미지 및 출처 URL 표시 구현

## 작업 개요

master_books 테이블의 `cover_image_url`과 `source_url` 필드를 교재 관리 영역(목록 및 상세 페이지)에 표시하도록 구현했습니다.

## 구현 내용

### 1. 컴포넌트 수정

#### 1.1 ContentHeader 컴포넌트 (`app/(student)/contents/_components/ContentHeader.tsx`)
- `coverImageUrl` prop 추가
- 이미지가 있는 경우 상단에 표지 이미지 표시
- Next.js Image 컴포넌트 사용으로 최적화
- 반응형 크기 적용 (모바일: 128px, 데스크톱: 160px)

#### 1.2 ContentDetailTable 컴포넌트 (`app/(student)/contents/_components/ContentDetailTable.tsx`)
- `isUrl` prop 추가하여 URL 값인 경우 링크로 표시
- 자동 URL 감지 기능 추가 (http:// 또는 https://로 시작하는 경우)
- 새 탭에서 열리도록 `target="_blank"` 및 `rel="noopener noreferrer"` 적용

### 2. 교재 목록 페이지 수정

#### 2.1 관리자 교재 목록 (`app/(admin)/admin/master-books/page.tsx`)
- 교재 카드 상단에 `cover_image_url` 이미지 표시
- 이미지가 있는 경우에만 표시
- 반응형 이미지 크기 적용

#### 2.2 학생 교재 목록 (`app/(student)/contents/master-books/page.tsx`)
- 교재 카드 상단에 `cover_image_url` 이미지 표시
- 이미지가 있는 경우에만 표시
- 반응형 이미지 크기 적용

### 3. 교재 상세 페이지 수정

#### 3.1 관리자 교재 상세 (`app/(admin)/admin/master-books/[id]/page.tsx`)
- `ContentHeader`에 `coverImageUrl` prop 전달
- `ContentDetailTable`에 "출처 URL" 행 추가 (`isUrl: true` 설정)

#### 3.2 학생 교재 상세 (`app/(student)/contents/master-books/[id]/page.tsx`)
- `ContentHeader`에 `coverImageUrl` prop 전달
- `ContentDetailTable`에 "출처 URL" 행 추가 (`isUrl: true` 설정)

### 4. Next.js 이미지 설정 (`next.config.ts`)
- 외부 이미지 도메인 허용을 위한 주석 추가
- 실제 사용 시 `remotePatterns` 설정 필요 (주석 참고)

## 주요 변경 파일

1. `app/(student)/contents/_components/ContentHeader.tsx` - 이미지 표시 지원 추가
2. `app/(student)/contents/_components/ContentDetailTable.tsx` - URL 링크 표시 지원 추가
3. `app/(admin)/admin/master-books/page.tsx` - 관리자 목록에 이미지 추가
4. `app/(student)/contents/master-books/page.tsx` - 학생 목록에 이미지 추가
5. `app/(admin)/admin/master-books/[id]/page.tsx` - 관리자 상세에 이미지 및 source_url 추가
6. `app/(student)/contents/master-books/[id]/page.tsx` - 학생 상세에 이미지 및 source_url 추가
7. `next.config.ts` - 외부 이미지 도메인 설정 주석 추가

## 구현 세부사항

### 이미지 표시 규칙
- `cover_image_url`이 있는 경우에만 이미지 표시
- Next.js Image 컴포넌트 사용으로 자동 최적화 (AVIF, WebP 포맷 지원)
- 반응형 이미지 크기 적용
- 이미지 로드 실패 시 기본 스타일 유지

### source_url 표시 규칙
- `source_url`이 있는 경우에만 표시
- URL인 경우 클릭 가능한 링크로 표시
- 새 탭에서 열리도록 `target="_blank"` 적용
- 보안을 위해 `rel="noopener noreferrer"` 적용
- 긴 URL의 경우 `break-all` 클래스로 줄바꿈 처리

## 외부 이미지 도메인 설정

외부 이미지를 사용하는 경우 `next.config.ts`의 `images.remotePatterns` 설정이 필요합니다.

```typescript
images: {
  // ... 기존 설정
  remotePatterns: [
    {
      protocol: "https",
      hostname: "example.com",
    },
  ],
}
```

모든 도메인을 허용하려면 (보안상 권장하지 않음):

```typescript
remotePatterns: [
  {
    protocol: "https",
    hostname: "**",
  },
  {
    protocol: "http",
    hostname: "**",
  },
],
```

## 테스트 확인 사항

1. 교재 목록에서 이미지가 정상적으로 표시되는지 확인
2. 교재 상세에서 이미지가 정상적으로 표시되는지 확인
3. source_url이 링크로 표시되고 클릭 시 새 탭에서 열리는지 확인
4. 이미지가 없는 교재의 경우 이미지 영역이 표시되지 않는지 확인
5. source_url이 없는 교재의 경우 "출처 URL" 행이 표시되지 않는지 확인

## 참고사항

- 이미지 최적화는 Next.js Image 컴포넌트가 자동으로 처리합니다
- 외부 이미지 도메인은 실제 사용 환경에 맞게 `next.config.ts`에서 설정해야 합니다
- 이미지 로드 실패 시 기본 스타일이 유지되며, 에러는 콘솔에 표시됩니다

