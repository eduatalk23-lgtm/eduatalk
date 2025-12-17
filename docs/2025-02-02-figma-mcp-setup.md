# Figma MCP 서버 설정 가이드

## 작업 일시
2025년 2월 2일

## 작업 내용

### 1. Figma MCP 서버 설정

Context7 MCP를 활용하여 Figma MCP 서버의 모범 사례를 검색하고 적용했습니다.

#### 사용한 라이브러리
- **Framelink MCP for Figma** (`/glips/figma-context-mcp`)
  - Figma API를 통해 디자인 데이터에 접근
  - AI 코딩 에이전트가 Figma 디자인을 정확하게 구현할 수 있도록 지원
  - Code Snippets: 40개
  - Source Reputation: High
  - Benchmark Score: 65.4

#### 설정 파일 위치
```
~/.config/cursor/mcp.json
```

#### 설정 내용
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": [
        "-y",
        "figma-developer-mcp",
        "--figma-api-key=YOUR_FIGMA_PERSONAL_ACCESS_TOKEN",
        "--stdio"
      ],
      "env": {
        "OUTPUT_FORMAT": "json"
      }
    }
  }
}
```

### 2. 설정 옵션 설명

#### command
- `npx`: Node.js 패키지 실행 도구
- `-y`: 자동으로 패키지 설치 승인

#### args
- `figma-developer-mcp`: Figma MCP 서버 패키지명
- `--figma-api-key`: Figma 액세스 토큰 (환경 변수로도 설정 가능)
- `--stdio`: 표준 입출력을 통한 통신 모드 (MCP 클라이언트용)

#### env
- `OUTPUT_FORMAT`: 출력 형식 (`json` 또는 `yaml`)

### 3. Figma 액세스 토큰 발급 방법

1. Figma 계정 설정으로 이동
2. Settings → Personal Access Tokens
3. "Create new token" 클릭
4. 토큰 이름 입력 및 생성
5. 생성된 토큰을 복사하여 설정 파일에 추가

### 4. 대안 설정 방법

#### 환경 변수 사용
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": {
        "FIGMA_API_KEY": "YOUR_FIGMA_PERSONAL_ACCESS_TOKEN",
        "OUTPUT_FORMAT": "json"
      }
    }
  }
}
```

#### OAuth 토큰 사용
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": {
        "FIGMA_OAUTH_TOKEN": "your_oauth_token",
        "OUTPUT_FORMAT": "json",
        "SKIP_IMAGE_DOWNLOADS": "false"
      }
    }
  }
}
```

### 5. 사용 가능한 기능

Figma MCP 서버를 통해 다음 기능을 사용할 수 있습니다:

1. **디자인 파일 읽기**
   - Figma 파일 구조 분석
   - 컴포넌트 및 레이어 정보 추출
   - 스타일 및 디자인 토큰 추출

2. **디자인 데이터 변환**
   - Figma 디자인을 코드로 변환
   - 디자인 토큰을 CSS/Tailwind 클래스로 변환
   - 컴포넌트 구조 추출

3. **이미지 및 에셋 내보내기**
   - 이미지 자동 다운로드
   - SVG 내보내기
   - 다양한 해상도 지원

### 6. 참고 자료

- [Framelink MCP for Figma GitHub](https://github.com/glips/figma-context-mcp)
- [Context7 - Figma Context MCP](https://context7.com/glips/figma-context-mcp)
- [Figma REST API 문서](https://www.figma.com/developers/api)

### 7. 다음 단계

1. Cursor 재시작하여 MCP 서버 연결 확인
2. Figma 파일 URL을 사용하여 디자인 데이터 가져오기 테스트
3. 디자인 토큰 추출 및 코드 생성 테스트

## 주의사항

- 액세스 토큰은 민감한 정보이므로 Git에 커밋하지 않도록 주의
- 토큰이 만료되면 새로 발급받아 업데이트 필요
- MCP 서버 연결 후 Cursor를 재시작해야 설정이 적용됨

