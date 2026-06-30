import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { SectionEnter } from "../components/SectionEnter";
import { SectionHeader } from "../components/SectionHeader";
import { AccountRow } from "../components/money/AccountRow";
import { AllocationBar } from "../components/money/AllocationBar";
import { AreaTrendChart } from "../components/money/AreaTrendChart";
import { RangePills } from "../components/money/RangePills";
import { TriUp } from "../components/money/icons";
import { moneyData } from "../data/money";
import { color, glow, space, type } from "../theme/tokens";

/**
 * Money (spec §5.3) — net worth → trend → allocation → accounts. Same editorial
 * language as Home/Body: serif title, mono data, color-as-meaning (green up,
 * muted down — never red). Content only; App owns AmbientBackground + BottomNav.
 */
export function MoneyScreen() {
  const { netWorth, allocation, accounts, title, eyebrow, trend, ranges, activeRange } = moneyData;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader recoveryPct={moneyData.recoveryPct} tone={color.yellow} />

      <SectionEnter index={0}>
        <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
        <Text style={type.screenTitle}>
          {title.lead} <Text style={type.screenTitleItalic}>{title.emphasis}</Text>
        </Text>
      </SectionEnter>

      <SectionEnter index={1}>
        <View style={styles.metaRow}>
          <Text style={type.sectionMeta}>{netWorth.meta}</Text>
          <View style={[styles.liveDot, glow(color.green, 6, 0.6)]} />
        </View>
        <Text style={[type.valueXL, styles.netValue]}>{netWorth.value}</Text>
        <View style={styles.deltaRow}>
          <TriUp size={8} color={color.green} />
          <Text style={styles.deltaText}>{netWorth.delta}</Text>
        </View>
        <AreaTrendChart series={trend} />
        <RangePills ranges={ranges} initial={activeRange} />
      </SectionEnter>

      <SectionEnter index={2}>
        <SectionHeader title="Allocation" meta={allocation.meta} />
        <AllocationBar classes={allocation.classes} />
      </SectionEnter>

      <SectionEnter index={3}>
        <SectionHeader title="Accounts" meta={accounts.meta} />
        {accounts.rows.map((account, i) => (
          <AccountRow key={account.name} account={account} last={i === accounts.rows.length - 1} />
        ))}
      </SectionEnter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  eyebrow: {
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 22,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.green,
  },
  netValue: {
    marginTop: 8,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
  },
  deltaText: {
    fontFamily: type.valueM.fontFamily,
    fontSize: 11,
    color: color.green,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
});
