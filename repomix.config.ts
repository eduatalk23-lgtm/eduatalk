import type { RepomixConfig } from "repomix";

const config: RepomixConfig = {
  include: [
    // Chat 도메인 핵심 로직
    "lib/domains/chat/**",
    
    // Chat UI 컴포넌트
    "components/chat/**",
    
    // Chat 페이지 (학생용)
    "app/(student)/chat/**",
    
    // Chat 페이지 (관리자용)
    "app/(admin)/admin/chat/**",
    
    // Chat 실시간 기능
    "lib/realtime/useChat*.ts",
    "lib/realtime/useChatPresence.ts",
    "lib/realtime/useChatRealtime.ts",
    
    // Chat 관련 액션 (app/actions에 있다면)
    "app/actions/**/chat*.ts",
    
    // Chat 관련 API 라우트
    "app/api/**/chat*.ts",
  ],
  exclude: [
    "node_modules/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/__tests__/**",
    "**/__mocks__/**",
    ".next/**",
    "dist/**",
    "build/**",
  ],
  output: "chat-domain.repomix.xml",
};

export default config;

