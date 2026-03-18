export const WEEK_DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function formatRecurrence(
  type: "MONTHLY" | "WEEKLY",
  days: number[],
): string {
  if (days.length === 0) return "每月1日";
  const day = days[0]!;
  if (type === "MONTHLY") {
    return `每月${day}日`;
  }
  return `每週${WEEK_DAY_LABELS[day] ?? "一"}`;
}

export function parseRecurrenceDays(daysStr: string): number[] {
  try {
    const parsed = JSON.parse(daysStr);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [1];
  } catch {
    return [1];
  }
}
