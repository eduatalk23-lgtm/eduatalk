"use client";

import { useState, useCallback } from "react";
import { getMasterBooksListAction } from "@/lib/domains/content";

/**
 * 마스터 교재 목록 새로고침을 위한 커스텀 훅
 * 
 * @param initialBooks 초기 교재 목록
 * @returns { masterBooks, refreshMasterBooks } 교재 목록과 새로고침 함수
 */
export function useMasterBooksRefresh(
  initialBooks: Array<{ id: string; title: string }>
) {
  const [masterBooks, setMasterBooks] = useState<Array<{ id: string; title: string }>>(initialBooks);
  
  const refreshMasterBooks = useCallback(async () => {
    try {
      const books = await getMasterBooksListAction();
      setMasterBooks(books);
      return books;
    } catch (error) {
      console.error("교재 목록 새로고침 실패:", error);
      // 에러 발생 시 기존 목록 유지
      return masterBooks;
    }
  }, [masterBooks]);
  
  return { masterBooks, refreshMasterBooks };
}

