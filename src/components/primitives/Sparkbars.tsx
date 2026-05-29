type SparkbarsProps = {
  data: number[];
  height?: number;
  /** Bars at index >= highlightFrom render in the accent color (e.g. the recent window). */
  highlightFrom?: number;
  color?: string;
};

/** CSS bar chart. Heights are normalized to the series max; decorative (aria-hidden). */
export function Sparkbars({ data, height = 56, highlightFrom, color = "var(--os-accent)" }: SparkbarsProps) {
  if (data.length === 0) return <div style={{ height }} />;
  const max = Math.max(...data, 0) || 1;
  const from = highlightFrom ?? data.length;
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} aria-hidden="true">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 min-h-[2px] rounded-[1px]"
          style={{
            height: `${Math.max(0, (v / max) * 100)}%`,
            backgroundColor: i >= from ? color : "var(--os-line-2)",
          }}
        />
      ))}
    </div>
  );
}
