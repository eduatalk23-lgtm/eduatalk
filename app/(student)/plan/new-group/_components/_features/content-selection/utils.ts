
export const getContentTitleFromMaster = (
  contents: {
    books: Array<{ id: string; title: string }>;
    lectures: Array<{ id: string; title: string }>;
  },
  contentType: "book" | "lecture",
  contentId: string
): string => {
  if (contentType === "book") {
    const content = contents.books.find((c) => c.id === contentId);
    return content?.title || "알 수 없음";
  } else {
    const content = contents.lectures.find((c) => c.id === contentId);
    return content?.title || "알 수 없음";
  }
};

export const getContentSubtitleFromMaster = (
  contents: {
    books: Array<{ id: string; subtitle?: string | null }>;
    lectures: Array<{ id: string; subtitle?: string | null }>;
  },
  contentType: "book" | "lecture",
  contentId: string
): string | null => {
  if (contentType === "book") {
    const content = contents.books.find((c) => c.id === contentId);
    return content?.subtitle || null;
  } else {
    const content = contents.lectures.find((c) => c.id === contentId);
    return content?.subtitle || null;
  }
};
