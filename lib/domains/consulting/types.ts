export type SessionType =
  | "정기상담"
  | "학부모상담"
  | "진로상담"
  | "성적상담"
  | "긴급상담"
  | "기타";

export const SESSION_TYPES: SessionType[] = [
  "정기상담",
  "학부모상담",
  "진로상담",
  "성적상담",
  "긴급상담",
  "기타",
];

export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  정기상담: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  학부모상담:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  진로상담:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  성적상담:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  긴급상담: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  기타: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
};
