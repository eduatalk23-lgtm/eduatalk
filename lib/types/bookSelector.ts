/**
 * 교재 선택 컴포넌트 관련 타입 정의
 */

export type BookCreateResult =
  | { success: true; bookId: string }
  | { success: false; error: string; bookId: null };

export type BookItem = {
  id: string;
  title: string;
};

export type BookCreateAction = (
  formData: FormData
) => Promise<BookCreateResult>;

