/**
 * Supabase 클라이언트 선택 유틸리티
 * RLS 우회가 필요한 작업을 위한 공통 함수 제공
 * 
 * @deprecated 이 파일의 함수들은 lib/supabase/clientSelector.ts로 이동되었습니다.
 * 새로운 코드는 lib/supabase/clientSelector.ts를 사용하세요.
 */

// 재export를 통해 기존 import 경로 유지
export {
  getSupabaseClientForRLSBypass,
  getSupabaseClientForStudentOperation,
  getClientForRLSBypass,
} from "@/lib/supabase/clientSelector";

