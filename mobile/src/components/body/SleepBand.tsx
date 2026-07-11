import { StyleSheet, Text, View } from "react-native";

import { formatSleepHero, minutesToHm, sleepColor } from "../../data/body";
import { time12 } from "../../lib/format";
import type { UseSleepDetailResult } from "../../lib/queries";
import { useTheme } from "../../theme/ThemeContext";
import { Band } from "../spec/Band";
import { Skeleton } from "../spec/Skeleton";
import { BandMessage } from "./BandMessage";
import { SleepStageBar } from "./SleepStageBar";

type SleepBandProps = {
  sleep: UseSleepDetailResult;
  /** Σ max(0, 7.5h − sleep) over the last 7 local days, minutes — from the
   * colocated `useBodyHistory`. 0 while that hook is still loading/erroring,
   * which is fine: the line is omitted at 0 anyway (spec: "omit when 0"). */
  sleepDebtMin: number;
  index?: number;
};

/**
 * SLEEP · LAST NIGHT band (design README §Body) — window, hero h:mm (state
 * colored per `sleepColor`), quality %, stage bar, and the new SLEEP DEBT
 * line. Owns its own loading/error/empty branches since it depends on
 * `useSleepDetail` independently of the rest of the screen.
 */
export function SleepBand({ sleep, sleepDebtMin, index = 0 }: SleepBandProps) {
  const { c, t } = useTheme();

  if (sleep.loading) {
    return (
      <Band variant="plain" index={index}>
        <Text style={t.sectionHeader}>SLEEP · LAST NIGHT</Text>
        <View style={styles.skeletonHero}>
          <Skeleton width={110} height={30} radius={4} />
        </View>
        <View style={styles.skeletonBar}>
          <Skeleton width="100%" height={6} radius={3} />
        </View>
      </Band>
    );
  }

  if (sleep.error) {
    return (
      <Band variant="plain" index={index}>
        <Text style={t.sectionHeader}>SLEEP · LAST NIGHT</Text>
        <BandMessage kind="error" onRetry={sleep.refetch} />
      </Band>
    );
  }

  const s = sleep.data;
  if (!s || s.sleepHours == null) {
    return (
      <Band variant="plain" index={index}>
        <Text style={t.sectionHeader}>SLEEP · LAST NIGHT</Text>
        <BandMessage kind="empty" text="No sleep data yet" />
      </Band>
    );
  }

  const window = s.sleepStart && s.sleepEnd ? `${time12(s.sleepStart)} → ${time12(s.sleepEnd)}` : null;
  const quality = s.sleepScore != null ? `${Math.round(s.sleepScore)}% QUALITY` : "— QUALITY";
  const hasStages = s.deepMin != null && s.remMin != null && s.lightMin != null;

  return (
    <Band variant="plain" index={index}>
      <View style={styles.rowBetween}>
        <Text style={t.sectionHeader}>SLEEP · LAST NIGHT</Text>
        {window ? <Text style={t.ledgerTime}>{window}</Text> : null}
      </View>
      <View style={styles.heroRow}>
        <Text style={[t.heroValue, { color: sleepColor(c, s.sleepHours) }]}>{formatSleepHero(s.sleepHours)}</Text>
        <Text style={t.bandSub}>{quality}</Text>
      </View>
      {hasStages ? <SleepStageBar deepMin={s.deepMin!} remMin={s.remMin!} lightMin={s.lightMin!} /> : null}
      {sleepDebtMin > 0 ? (
        <Text style={[t.bandSub, styles.debt]}>SLEEP DEBT · {minutesToHm(sleepDebtMin)}</Text>
      ) : null}
    </Band>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 12,
  },
  debt: {
    marginTop: 8,
  },
  skeletonHero: {
    marginTop: 12,
  },
  skeletonBar: {
    marginTop: 14,
  },
});
