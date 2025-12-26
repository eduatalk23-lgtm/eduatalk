import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getBooks,
  getLectures,
  getCustomContents,
} from "@/lib/data/studentContents";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "book";

    let contents: Array<{
      id: string;
      name: string;
      type: "book" | "lecture" | "custom";
      totalUnits?: number;
      subject?: string;
      subjectCategory?: string;
    }> = [];

    if (type === "book") {
      const books = await getBooks(user.userId, user.tenantId);
      contents = books.map((book) => ({
        id: book.id,
        name: book.title,
        type: "book" as const,
        totalUnits: book.total_pages ?? undefined,
        subject: book.subject ?? undefined,
        subjectCategory: book.subject_category ?? undefined,
      }));
    } else if (type === "lecture") {
      const lectures = await getLectures(user.userId, user.tenantId);
      contents = lectures.map((lecture) => ({
        id: lecture.id,
        name: lecture.title,
        type: "lecture" as const,
        totalUnits: lecture.total_episodes ?? undefined,
        subject: lecture.subject ?? undefined,
        subjectCategory: lecture.subject_category ?? undefined,
      }));
    } else if (type === "custom") {
      const customContents = await getCustomContents(
        user.userId,
        user.tenantId
      );
      contents = customContents.map((content) => ({
        id: content.id,
        name: content.title,
        type: "custom" as const,
        totalUnits: content.total_page_or_time ?? undefined,
        subject: content.subject ?? undefined,
        subjectCategory: undefined,
      }));
    }

    return NextResponse.json(contents);
  } catch (error) {
    console.error("Error fetching contents:", error);
    return NextResponse.json(
      { error: "Failed to fetch contents" },
      { status: 500 }
    );
  }
}
