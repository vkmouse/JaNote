import type { AssetRecord } from "../types";

export interface AssetDailyGroup {
  date: string;
  dateDisplay: string;
  records: AssetRecord[];
}

const WEEK_DAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function groupRecordsByDate(records: AssetRecord[]): AssetDailyGroup[] {
  const sorted = [...records].sort(
    (a, b) => b.date - a.date || b.created_at - a.created_at,
  );

  const groups = new Map<number, AssetDailyGroup>();
  for (const r of sorted) {
    if (!groups.has(r.date)) {
      const d = new Date(r.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      groups.set(r.date, {
        date: `${y}-${m}-${day}`,
        dateDisplay: `${y}/${m}/${day} ${WEEK_DAYS[d.getDay()]}`,
        records: [],
      });
    }
    groups.get(r.date)!.records.push(r);
  }
  return Array.from(groups.values());
}
