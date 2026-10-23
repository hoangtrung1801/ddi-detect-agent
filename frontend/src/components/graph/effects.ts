/**
 * The database has no severity, only the interaction sentence. These buckets group the sentence
 * templates it uses so the graph can colour edges by what the interaction does. First match wins.
 */
export interface Effect {
  id: string;
  label: string;
  color: string;
  test: RegExp;
}

export const EFFECTS: Effect[] = [
  { id: "adverse", label: "Tăng nguy cơ tác dụng phụ", color: "#E5484D", test: /risk or severity|adverse|toxic/i },
  { id: "metabolism", label: "Thay đổi chuyển hoá", color: "#3E8EF7", test: /metabolism/i },
  { id: "level", label: "Thay đổi nồng độ / thải trừ", color: "#A86FDF", test: /serum concentration|excretion|absorption|bioavailability|protein binding/i },
  { id: "weaker", label: "Giảm hiệu quả", color: "#2BB3A3", test: /decrease .*(efficacy|activities|effect)/i },
  { id: "stronger", label: "Tăng tác dụng", color: "#F2A33A", test: /increase .*(activities|effect)/i },
  { id: "other", label: "Khác", color: "#8A96A1", test: /./ },
];

export function effectOf(condition: string): Effect {
  return EFFECTS.find((e) => e.test.test(condition)) ?? EFFECTS[EFFECTS.length - 1]!;
}
