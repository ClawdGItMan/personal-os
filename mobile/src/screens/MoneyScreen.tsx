import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useState } from "react";

import { AccountEditorSheet } from "../components/money/AccountEditorSheet";
import { BandHeader } from "../components/money/BandHeader";
import { CountUpText } from "../components/money/CountUpText";
import { formatCompact, formatCompactMagnitude, monthAbbrev, runwayLabel } from "../components/money/format";
import { MoneyLedgerRow } from "../components/money/MoneyLedgerRow";
import { FormError, SheetPrimaryButton, SheetTextField } from "../components/money/MoneyFormControls";
import { AccountsSkeleton, BurnSkeleton, LedgerSkeleton, NetWorthSkeleton } from "../components/money/MoneySkeletons";
import { TransactionSheet } from "../components/money/TransactionSheet";
import { Band } from "../components/spec/Band";
import { Eyebrow } from "../components/spec/Eyebrow";
import { ScreenHeader } from "../components/spec/ScreenHeader";
import { Sparkline } from "../components/spec/Sparkline";
import { StatGrid } from "../components/spec/StatGrid";
import type { StatItem } from "../components/spec/StatGrid";
import { TitleBlock } from "../components/spec/TitleBlock";
import type { StatusSegment } from "../components/spec/TitleBlock";
import { eyebrowDate } from "../lib/format";
import type { MoneyTransaction, NetWorthPoint } from "../lib/queries";
import { useMoney } from "../lib/queries";
import { useFillAnim } from "../motion/useFillAnim";
import { layout } from "../theme/layout";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

/** Local sheet state — LOCAL to MoneyScreen (not NavContext), per the design
 * brief: these are simple slide-ups owned entirely by this screen. */
type SheetState =
  | null
  | { kind: "accounts"; initialAdding: boolean }
  | { kind: "transaction"; transaction: MoneyTransaction | null }; // null transaction = add mode

const LOADING_STATUS: StatusSegment[] = ["Loading your accounts…"];
const ERROR_STATUS: StatusSegment[] = ["Couldn't load your money data."];

/** "N ACCOUNT(S)" — real per-group account counts, used instead of the mock's
 * fabricated "+1.2% · 30D" performance figure (no reliable per-group history
 * to compute that from). */
function accountCountLabel(n: number): string {
  return `${n} ${n === 1 ? "ACCOUNT" : "ACCOUNTS"}`;
}

/** Net-worth hero status line — defensive: only claims a trend/pace when the
 * underlying data actually supports it (mock-data policy: never fabricate). */
function buildStatus(series: NetWorthPoint[], monthBurn: number, budgetAmount: number | null): StatusSegment[] {
  const trend =
    series.length < 2
      ? null
      : series[series.length - 1].value > series[0].value
        ? "climbing"
        : series[series.length - 1].value < series[0].value
          ? "dipping"
          : "steady";
  const pace = budgetAmount == null || budgetAmount === 0 ? null : monthBurn <= budgetAmount ? "on pace" : "over budget";

  if (trend && pace) return ["Net worth's ", { b: trend }, " and spend is ", { b: pace }, "."];
  if (trend) return ["Net worth's ", { b: trend }, " this month."];
  if (pace) return ["This month's spend is ", { b: pace }, "."];
  return ["Add accounts to see your full picture."];
}

/** Hero sub line — "+$X LATEST · +Y% 30D" built only from points that exist
 * ("LATEST" not "TODAY": a sparse snapshot history means the newest point
 * isn't guaranteed to be today, see useMoney.ts's netWorthSeries30d note). */
function buildNetWorthSub(series: NetWorthPoint[]): string | null {
  if (series.length === 0) return null;
  const parts: string[] = [];
  if (series.length >= 2) {
    const delta = series[series.length - 1].value - series[series.length - 2].value;
    parts.push(`${delta >= 0 ? "+" : "-"}${formatCompactMagnitude(delta)} LATEST`);
  }
  const first = series[0].value;
  if (series.length >= 2 && first !== 0) {
    const pct = ((series[series.length - 1].value - first) / Math.abs(first)) * 100;
    parts.push(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% 30D`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Money (design README §Money, spec 7b) — net worth hero → accounts → burn
 * vs budget → recent ledger, all live via `useMoney()`. Content only, the
 * shared themed shell + TabBar are owned by App.
 */
export function MoneyScreen() {
  const { c, t } = useTheme();
  const {
    accounts,
    netWorth,
    groups,
    netWorthSeries30d,
    monthBurn,
    budgetAmount,
    runwayMonths,
    recent,
    loading,
    error,
    refetch,
    addAccount,
    updateAccountValue,
    addTransaction,
    setBudget,
  } = useMoney();

  const [sheet, setSheet] = useState<SheetState>(null);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const over = budgetAmount != null && monthBurn > budgetAmount;
  const burnPct = budgetAmount ? Math.min(100, (monthBurn / budgetAmount) * 100) : 0;
  const burnFill = useFillAnim(burnPct);
  const remaining = budgetAmount != null ? budgetAmount - monthBurn : 0;

  const status = loading ? LOADING_STATUS : error ? ERROR_STATUS : buildStatus(netWorthSeries30d, monthBurn, budgetAmount);
  const netWorthSub = buildNetWorthSub(netWorthSeries30d);

  const cashCount = accounts.filter((a) => a.group === "cash").length;
  const investedCount = accounts.filter((a) => a.group === "invested").length;
  const debtCount = accounts.filter((a) => a.group === "debt").length;
  const accountItems: StatItem[] = [
    { label: "CASH", value: formatCompact(groups.cash), sub: accountCountLabel(cashCount) },
    { label: "INVESTED", value: formatCompact(groups.invested), sub: accountCountLabel(investedCount) },
    {
      label: "DEBT",
      value: formatCompact(groups.debt),
      sub: accountCountLabel(debtCount),
      valueColor: groups.debt < 0 ? c.red : undefined,
    },
  ];

  function startEditBudget() {
    setBudgetInput(budgetAmount != null ? String(budgetAmount) : "");
    setBudgetError(null);
    setBudgetEditing(true);
  }

  async function saveBudget() {
    const parsed = Number(budgetInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || savingBudget) return;
    setSavingBudget(true);
    setBudgetError(null);
    // setBudget (useMoney) THROWS on failure — catch here so a failed save
    // renders an inline error and keeps the editor open with the user's
    // input, instead of falling through to MoneyScreen's read-error retry
    // row (that row is READ-path only; see useMoney's write contract note).
    try {
      await setBudget(parsed);
      setBudgetEditing(false);
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Couldn't save budget");
    } finally {
      setSavingBudget(false);
    }
  }

  const budgetInputValid = Number.isFinite(Number(budgetInput)) && Number(budgetInput) > 0;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader />

        <View style={styles.eyebrowWrap}>
          <Eyebrow left={eyebrowDate(new Date())} right={runwayLabel(runwayMonths)} />
        </View>
        <View style={styles.titleWrap}>
          <TitleBlock title="Money" status={status} />
        </View>

        <View style={styles.bandsWrap}>
          {loading ? (
            <>
              <NetWorthSkeleton />
              <AccountsSkeleton />
              <BurnSkeleton />
              <LedgerSkeleton />
            </>
          ) : error ? (
            <Band variant="plain" index={0}>
              <Pressable
                onPress={() => {
                  void refetch();
                }}
                style={styles.retryRow}
              >
                <Text style={[styles.retryText, { color: c.red }]}>COULDN&apos;T LOAD — RETRY</Text>
              </Pressable>
            </Band>
          ) : (
            <>
              <Band variant="plain" index={0}>
                <BandHeader left="NET WORTH" right="30D" />
                <View style={styles.netRow}>
                  <View>
                    <CountUpText
                      target={netWorth}
                      format={formatCompact}
                      style={[t.heroValue, styles.netValue, { color: c.accent }]}
                    />
                    {netWorthSub ? (
                      <Text style={[t.bandSub, styles.netSub, { color: c.accent }]}>{netWorthSub}</Text>
                    ) : null}
                  </View>
                  {netWorthSeries30d.length >= 2 ? (
                    <Sparkline points={netWorthSeries30d.map((p) => p.value)} width={118} height={34} />
                  ) : null}
                </View>
              </Band>

              {accounts.length === 0 ? (
                <Pressable onPress={() => setSheet({ kind: "accounts", initialAdding: true })}>
                  <Band variant="plain" index={1}>
                    <View style={styles.emptyCta}>
                      <Text style={[styles.emptyCtaText, { color: c.accent }]}>+ Add your first account</Text>
                    </View>
                  </Band>
                </Pressable>
              ) : (
                <Pressable onPress={() => setSheet({ kind: "accounts", initialAdding: false })}>
                  <StatGrid items={accountItems} index={1} />
                </Pressable>
              )}

              <Band variant="plain" index={2}>
                {budgetEditing ? (
                  <View>
                    <BandHeader
                      left={`${monthAbbrev()} BURN`}
                      right={budgetAmount == null ? "SET BUDGET" : "EDIT BUDGET"}
                    />
                    <View style={styles.budgetEditField}>
                      <SheetTextField
                        value={budgetInput}
                        onChangeText={setBudgetInput}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        numeric
                        autoFocus
                      />
                    </View>
                    {budgetError ? (
                      <View style={styles.budgetEditError}>
                        <FormError>{budgetError}</FormError>
                      </View>
                    ) : null}
                    <View style={styles.budgetEditActions}>
                      <Pressable
                        onPress={() => {
                          setBudgetError(null);
                          setBudgetEditing(false);
                        }}
                        hitSlop={8}
                        style={styles.budgetCancel}
                      >
                        <Text style={[styles.budgetCancelText, { color: c.ink50 }]}>Cancel</Text>
                      </Pressable>
                      <View style={styles.budgetSaveWrap}>
                        <SheetPrimaryButton
                          label="Save"
                          onPress={saveBudget}
                          disabled={!budgetInputValid}
                          loading={savingBudget}
                        />
                      </View>
                    </View>
                  </View>
                ) : budgetAmount == null ? (
                  <Pressable onPress={startEditBudget}>
                    <BandHeader left={`${monthAbbrev()} BURN`} right="NO BUDGET" />
                    <Text style={[styles.burnCtaText, { color: c.accent }]}>Set a monthly budget</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={startEditBudget}>
                    <BandHeader
                      left={`${monthAbbrev()} BURN`}
                      right={over ? "OVER BUDGET" : "ON PACE"}
                      rightColor={over ? c.red : c.accent}
                    />
                    <View style={styles.burnRow}>
                      <Text style={t.statValue}>
                        {formatCompact(monthBurn)}{" "}
                        <Text style={[t.bandSub, styles.burnOf]}>OF {formatCompact(budgetAmount)}</Text>
                      </Text>
                      <Text style={[t.bandSub, over && { color: c.red }]}>
                        {over ? `${formatCompact(Math.abs(remaining))} OVER` : `${formatCompact(remaining)} LEFT`}
                      </Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: c.dayTrack }]}>
                      <Animated.View
                        style={[styles.barFill, { backgroundColor: over ? c.red : c.accent }, burnFill]}
                      />
                    </View>
                  </Pressable>
                )}
              </Band>

              <Band variant="plain" index={3}>
                <BandHeader left="RECENT" right="TODAY · YDA" onAdd={() => setSheet({ kind: "transaction", transaction: null })} />
                {recent.length === 0 ? (
                  <Text style={[styles.ledgerEmpty, { color: c.ink50 }]}>No transactions yet.</Text>
                ) : (
                  recent.map((tx) => (
                    <MoneyLedgerRow
                      key={tx.id}
                      transaction={tx}
                      onPress={() => setSheet({ kind: "transaction", transaction: tx })}
                    />
                  ))
                )}
              </Band>
            </>
          )}
        </View>
      </ScrollView>

      {sheet?.kind === "accounts" ? (
        <AccountEditorSheet
          accounts={accounts}
          onClose={() => setSheet(null)}
          onAddAccount={addAccount}
          onUpdateValue={updateAccountValue}
          initialAdding={sheet.initialAdding}
        />
      ) : null}

      {sheet?.kind === "transaction" ? (
        <TransactionSheet transaction={sheet.transaction} onClose={() => setSheet(null)} onAdd={addTransaction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  burnCtaText: {
    fontFamily: fonts.sans600,
    fontSize: 14,
    marginTop: 11,
    marginBottom: 4,
  },
  budgetEditField: {
    marginTop: 12,
  },
  budgetEditError: {
    marginTop: 10,
  },
  budgetEditActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 12,
  },
  budgetCancel: {
    paddingVertical: 8,
  },
  budgetCancelText: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  budgetSaveWrap: {
    width: 120,
  },
  emptyCta: {
    alignItems: "center",
    paddingVertical: 6,
  },
  emptyCtaText: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  ledgerEmpty: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    paddingVertical: 14,
  },
  retryRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: fonts.mono600,
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
});
