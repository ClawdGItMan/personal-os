import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";

import type { HealthHistoryPoint } from "../../lib/queries";
import { sliceLastNDays } from "../../lib/queries";
import { layout } from "../../theme/layout";
import { useTheme } from "../../theme/ThemeContext";
import type { RangeDays } from "../spec/RangeToggle";
import { RangeToggle } from "../spec/RangeToggle";
import { Skeleton } from "../spec/Skeleton";
import { Sparkline } from "../spec/Sparkline";

type WeightTrendBandProps = {
  /** `useHealthHistory(90)`'s points — wide enough to slice any of 7/30/90. */
  points: readonly HealthHistoryPoint[];
  loading: boolean;
};

/**
 * WEIGHT stat's inline expand (task C4) — tapping the stat cell
 * (`VitalsGrid`, BodyScreen) mounts this band under the vitals grid via a
 * Reanimated layout transition (see BodyScreen's `LinearTransition`/
 * `FadeIn`/`FadeOut` wrapper). Own 7D/30D/90D `RangeToggle` (default 30D,
 * matching the WEIGHT stat's existing "±X · 30D" delta window); a min/max
 * line reads off the same window as the sparkline. Sparse/empty windows (<2
 * points) render a "NOT ENOUGH DATA" line instead of a broken chart.
 */
export function WeightTrendBand({ points, loading }: WeightTrendBandProps) {
  const { c, t } = useTheme();
  const [range, setRange] = useState<RangeDays>(30);
  const [chartWidth, setChartWidth] = useState(0);

  const weightValues = sliceLastNDays(points, range)
    .map((p) => p.weight)
    .filter((w): w is number => w != null);
  const hasEnoughData = weightValues.length >= 2;
  const min = hasEnoughData ? Math.min(...weightValues) : null;
  const max = hasEnoughData ? Math.max(...weightValues) : null;

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, { borderColor: c.hairSection }]}>
      <View style={styles.headerRow}>
        <Text style={t.bandSub}>{`WEIGHT · ${range}D`}</Text>
        <RangeToggle value={range} onChange={setRange} />
      </View>
      {loading ? (
        <View style={styles.chartArea} onLayout={onChartLayout}>
          <Skeleton width="100%" height={40} radius={4} />
        </View>
      ) : !hasEnoughData ? (
        <Text style={[t.bandSub, styles.notEnoughData]}>{`NOT ENOUGH DATA · ${range}D`}</Text>
      ) : (
        <View style={styles.chartArea} onLayout={onChartLayout}>
          {chartWidth > 0 ? <Sparkline points={weightValues} width={chartWidth} height={40} /> : null}
          <View style={styles.minMaxRow}>
            <Text style={t.statSub}>{`MIN ${min!.toFixed(1)}`}</Text>
            <Text style={t.statSub}>{`MAX ${max!.toFixed(1)}`}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingTop: 14,
    paddingHorizontal: layout.gutter,
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartArea: {
    marginTop: 12,
  },
  notEnoughData: {
    marginTop: 12,
  },
  minMaxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
});
