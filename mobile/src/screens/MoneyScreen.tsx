import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { BandHeader } from "../components/money/BandHeader";
import { MoneyLedgerRow } from "../components/money/MoneyLedgerRow";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { Sparkline } from "../components/spec/Sparkline";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import { moneyData } from "../data/money";
import { useFillAnim } from "../motion/useFillAnim";
import { layout } from "../theme/layout";
import { useTheme } from "../theme/ThemeContext";

/**
 * Money (design README §Money, spec 7b) — net worth hero → accounts →
 * May burn → recent ledger. 100% mock (Plaid deferred, owner Max); content
 * only, the shared themed shell + TabBar are owned by App.
 */
export function MoneyScreen() {
  const { c, t } = useTheme();
  const { eyebrow, title, status, netWorth, accounts, burn, ledger } = moneyData;
  const burnFill = useFillAnim(burn.pct);

  const accountItems: StatItem[] = accounts.map((a) => ({
    label: a.label,
    value: a.value,
    sub: a.sub,
    valueColor: a.valueNegative ? c.red : undefined,
    subColor: a.subAccent ? c.accent : undefined,
  }));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader />

      <View style={styles.eyebrowWrap}>
        <Eyebrow left={eyebrow.left} right={eyebrow.right} />
      </View>
      <View style={styles.titleWrap}>
        <TitleBlock title={title} status={status} />
      </View>

      <View style={styles.bandsWrap}>
        <Band variant="plain" index={0}>
          <BandHeader left={netWorth.label} right={netWorth.period} />
          <View style={styles.netRow}>
            <View>
              <Text style={[t.heroValue, styles.netValue, { color: c.accent }]}>{netWorth.value}</Text>
              <Text style={[t.bandSub, styles.netSub, { color: c.accent }]}>{netWorth.sub}</Text>
            </View>
            <Sparkline width={118} height={34} />
          </View>
        </Band>

        <StatGrid items={accountItems} index={1} />

        <Band variant="plain" index={2}>
          <BandHeader left={burn.label} right={burn.status} rightColor={c.accent} />
          <View style={styles.burnRow}>
            <Text style={t.statValue}>
              {burn.spent} <Text style={[t.bandSub, styles.burnOf]}>{burn.ofBudget}</Text>
            </Text>
            <Text style={t.bandSub}>{burn.left}</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: c.dayTrack }]}>
            <Animated.View style={[styles.barFill, { backgroundColor: c.accent }, burnFill]} />
          </View>
        </Band>

        <Band variant="plain" index={3}>
          <BandHeader left={ledger.label} right={ledger.period} />
          {ledger.items.map((item) => (
            <MoneyLedgerRow key={`${item.time}-${item.title}`} item={item} />
          ))}
        </Band>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  eyebrowWrap: {
    marginTop: 26,
  },
  titleWrap: {
    marginTop: 20,
  },
  bandsWrap: {
    marginTop: 20,
  },
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },
  netValue: {
    marginBottom: 9,
  },
  netSub: {
    letterSpacing: 0.2,
  },
  burnRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 11,
    marginBottom: 12,
  },
  burnOf: {
    letterSpacing: 0.2,
  },
  barTrack: {
    height: 3,
    borderRadius: layout.radius.pill,
  },
  barFill: {
    height: 3,
    borderRadius: layout.radius.pill,
  },
});
