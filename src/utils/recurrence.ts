export const WEEK_DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function formatRecurrence(
  type: "MONTHLY" | "WEEKLY",
  day: number,
): string {
  if (type === "MONTHLY") {
    return `每月${day}日`;
  }
  return `每週${WEEK_DAY_LABELS[day] ?? "一"}`;
}
