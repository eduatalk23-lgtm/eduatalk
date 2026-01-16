"use server";

import { getGeminiProvider } from "../providers/gemini";
import { logActionError } from "@/lib/utils/serverActionLogger";

export interface VirtualContentItem {
  title: string;
  author?: string;
  publisher?: string;
  contentType: "book" | "lecture";
  totalRange: number; // Total pages or lectures
  chapters: {
    title: string;
    startRange: number;
    endRange: number;
  }[];
  description?: string;
}

export interface SearchContentResult {
  success: boolean;
  data?: VirtualContentItem[];
  error?: string;
}

const SEARCH_SYSTEM_PROMPT = `
You are an expert curriculum analyzer. Your goal is to find accurate structure information for learning materials (books or lectures) based on the user's search query.

**Tools Available**:
- You have access to Google Search to find the "Table of Contents" (mokcha), "Lecture List", or "Index" of the requested material.

**Output Format**:
Return a JSON object with a 'results' array containing matches. Each match must follow this structure:
{
  "title": "Exact Title of Book/Lecture",
  "author": "Author Name (optional)",
  "publisher": "Publisher Name (optional)",
  "contentType": "book" | "lecture" (infer from context, default to book if ambiguous),
  "totalRange": number (total pages or total number of lectures),
  "chapters": [
    {
      "title": "Chapter Name",
      "startRange": number (start page or lecture number),
      "endRange": number (end page or lecture number)
    }
  ],
  "description": "Brief description of the material"
}

**Rules**:
1. If the Total Range is unknown, make a reasonable estimate based on standard books (e.g. 300 pages) or lectures (e.g. 20-30 lectures) and note it in description.
2. Ensure 'chapters' cover the entire range if possible.
3. If multiple editions exist (e.g. 2024, 2025), prefer the latest relevant one unless specified.
4. Response must be valid JSON only, no markdown.
`;

export async function searchExternalContentAction(
  query: string,
  subject?: string
): Promise<SearchContentResult> {
  if (!query || query.trim() === "") {
    return { success: false, error: "Search query is required." };
  }

  try {
    const provider = getGeminiProvider();
    
    // Construct a specific search prompt
    const userPrompt = `
    Search for the structure/table of contents for: "${query}"
    Subject Context: ${subject || "General Education"}
    
    Find the Table of Contents, Total Pages (for books) or Total Lectures (for online classes).
    Return the parsed structure in the specified JSON format.
    `;

    const response = await provider.createMessage({
      system: SEARCH_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2, // Low temperature for factual extraction
      maxTokens: 2000,
      grounding: { enabled: true, mode: "always" }, // Enable Web Search via Grounding
    });

    try {
      // Parse JSON from response
      const cleanJson = response.content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      
      if (!parsed.results || !Array.isArray(parsed.results)) {
        console.warn("Invalid structure returned from AI:", parsed);
        return { success: false, error: "Failed to parse content structure." };
      }

      return {
        success: true,
        data: parsed.results as VirtualContentItem[],
      };

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, response.content);
      return { success: false, error: "AI response was not valid JSON." };
    }

  } catch (error) {
    logActionError("searchExternalContentAction", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during search.",
    };
  }
}
