import { StyleSheet, View } from "react-native";

import { Band } from "../spec/Band";
import { Skeleton } from "../spec/Skeleton";
import { useTheme } from "../../theme/ThemeContext";
import { layout } from "../../theme/layout";
import { BandHeader } from "./BandHeader";
import { monthAbbrev } from "./format";

/**
 * Band-shaped loading placeholders for MoneyScreen — one per band, at the
 * same FadeUp `index` the live band uses, so the load choreography (design
 * README §Motion) doesn't shift when data arrives and skeletons are swapped
 * for real content. Band labels are static copy (no data needed), so they
 * render immediately; only the numeric/content areas pulse.
 */
export function NetWorthSkeleton() {
  return (
    <Band variant="plain" index={0}>
      <BandHeader left="NET WORTH" right="30D" />
      <View style={styles.netRow}>
        <View>
          <Skeleton width={140} height={28} radius={6} />
          <View style={styles.gapSmall} />
          <Skeleton width={170} height={10} radius={4} />
        </View>
        <Skeleton width={118} height={34} radius={6} />
      </View>
    </Band>
  );
}

export function AccountsSkeleton() {
  const { c } = useTheme();
  return (
    <Band variant="plain" index={1}>
      <View style={styles.cols}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.col, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairCol, paddingLeft: 14 }]}>
            <Skeleton width={38} height={8} radius={3} />
            <View style={styles.gapSmall} />
            <Skeleton width={60} height={18} radius={4} />
            <View style={styles.gapTiny} />
            <Skeleton width={48} height={8} radius={3} />
          </View>
        ))}
      </View>
    </Band>
  );
}

export function BurnSkeleton() {
  return (
    <Band variant="plain" index={2}>
      <BandHeader left={`${monthAbbrev()} BURN`} right="—" />
      <View style={styles.burnRow}>
        <Skeleton width={120} height={20} radius={4} />
        <Skeleton width={70} height={10} radius={4} />
      </View>
      <Skeleton width="100%" height={3} radius={layout.radius.pill} />
    </Band>
  );
}

export function LedgerSkeleton() {
  return (
    <Band variant="plain" index={3}>
      <BandHeader left="RECENT" right="TODAY · YDA" />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.ledgerRow}>
          <Skeleton width={40} height={10} radius={3} />
          <Skeleton width={140} height={12} radius={3} />
          <Skeleton width={54} height={12} radius={3} />
        </View>
      ))}
    </Band>
  );
}

const styles = StyleSheet.create({
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },
  cols: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  col: {
    flex: 1,
    paddingRight: 12,
  },
  burnRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 11,
    marginBottom: 12,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  gapSmall: {
    height: 9,
  },
  gapTiny: {
    height: 6,
  },
});
