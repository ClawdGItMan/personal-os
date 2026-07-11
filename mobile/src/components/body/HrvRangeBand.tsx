import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { HealthHistoryPoint } from "../../lib/queries";
import { sliceLastNDays } from "../../lib/queries";
import { useTheme } from "../../theme/ThemeContext";
import { HrvBars } from "../spec/HrvBars";
import type { RangeDays } from "../spec/RangeToggle";
import { RangeToggle } from "../spec/RangeToggle";
import { Skeleton } from "../spec/Skeleton";
import { Sparkline } from "../spec/Sparkline";

const MIN_BAR_PT = 10;
const MAX_BAR_PT = 26;

/** Raw HRV ms values → bar heights in the same 10–26pt range as `HrvBars`'
 * locked mock shape, min-max normalized within the visible window (same
 * technique `Sparkline` uses internally for its own points). */
function scaleBarHeights(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => MIN_BAR_PT + ((v - min) / span) * (MAX_BAR_PT - MIN_BAR_PT));
}

type HrvRangeBandProps = {
  /** `useHealthHistory(90)`'s points — wide enough to slice any of 7/30/90. */
  points: readonly HealthHistoryPoint[];
  loading: boolean;
  /** Today's HRV reading (from `useHealthToday`, honest — `null` when
   * absent, no mock fallback), independent of the range window, shown as the
   * "current" half of the sub line. */
  currentHrv: number | null;
  /** Today's resting heart rate (from `useHealthToday`, honest — `null`
   * when absent), shown in the 7D sub line only, matching Home's exact
   * "{hrv} MS · REST {rhr}" format (`HomeScreen.tsx`'s `HrvBars` usage). */
  rhr: number | null;
};

/**
 * RECOVERY band's HRV mini-chart (task C4) — gains a 7D/30D/90D
 * `RangeToggle`. 7D keeps the locked `HrvBars` look; 30D/90D switch to a
 * `Sparkline` draw since a 30/90-bar mini chart doesn't fit the band width.
 * Sub line parity with Home: at 7D it reads "{current} MS · REST {rhr}" (the
 * exact format Home's own 7D `HrvBars` uses); at 30D/90D — where there's no
 * single "today" rest reading for the wider window — it falls back to
 * "{current} MS · AVG {window avg}". Sparse/empty windows (<2 points), or a
 * missing current/rest reading for today, render "" (no fake number) instead
 * of the fabricated line; sparse/empty windows additionally render a
 * "NOT ENOUGH DATA" line instead of a broken chart.
 */
export function HrvRangeBand({ points, loading, currentHrv, rhr }: HrvRangeBandProps) {
  const { t } = useTheme();
  const [range, setRange] = useState<RangeDays>(7);

  const hrvValues = sliceLastNDays(points, range)
    .map((p) => p.hrv)
    .filter((v): v is number => v != null);
  const hasEnoughData = hrvValues.length >= 2;
  const windowAvg = hasEnoughData ? Math.round(hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length) : null;
  const sub =
    range === 7
      ? currentHrv != null && rhr != null
        ? `${currentHrv} MS · REST ${rhr}`
        : ""
      : currentHrv != null && windowAvg != null
        ? `${currentHrv} MS · AVG ${windowAvg}`
        : "";

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={t.bandSub}>{`HRV · ${range}D`}</Text>
        <RangeToggle value={range} onChange={setRange} />
      </View>
      {loading ? (
        <View style={styles.skeletonRow}>
          <Skeleton width={64} height={26} radius={4} />
        </View>
      ) : !hasEnoughData ? (
        <Text style={[t.bandSub, styles.notEnoughData]}>{`NOT ENOUGH DATA · ${range}D`}</Text>
      ) : range === 7 ? (
        <HrvBars heights={scaleBarHeights(hrvValues)} sub={sub} />
      ) : (
        <View style={styles.sparklineWrap}>
          <Sparkline points={hrvValues} width={118} height={34} />
          <Text style={[t.statSub, styles.sparklineSub]}>{sub}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonRow: {
    alignItems: "flex-end",
  },
  notEnoughData: {
    marginTop: 2,
  },
  sparklineWrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  sparklineSub: {
    textAlign: "right",
  },
});
