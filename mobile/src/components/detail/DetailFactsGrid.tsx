import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import type { Fact } from "./DetailFactsRow";

/**
 * 2-col facts grid — Detail's workout template (task B8, NEW: no locked
 * mockup exists for this kind). Workouts carry more facts than the row list
 * comfortably fits full-width, so this reuses DetailFactsRow's exact type
 * roles (mono micro-label / Manrope value) in a column-hairline layout
 * modeled on `components/spec/StatGrid.tsx`'s divider treatment.
 */
export function DetailFactsGrid({ facts }: { facts: Fact[] }) {
  const { c } = useTheme();
  const rows: Fact[][] = [];
  for (let i = 0; i < facts.length; i += 2) rows.push(facts.slice(i, i + 2));

  return (
    <View style={[styles.grid, { borderColor: c.hairSection }]}>
      {rows.map((pair, ri) => (
        <View
          key={pair[0]?.label ?? ri}
          style={[styles.row, ri < rows.length - 1 && { borderBottomWidth: 1, borderColor: c.hairRow }]}
        >
          {pair.map((fact, ci) => (
            <View
              key={fact.label}
              style={[styles.cell, ci === 1 && { borderLeftWidth: 1, borderLeftColor: c.hairCol, paddingLeft: 14 }]}
            >
              <Text style={[styles.label, { color: c.ink50 }]}>{fact.label}</Text>
              <Text style={[styles.value, { color: fact.muted ? c.ink50 : c.ink }]}>{fact.value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginTop: 20,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    paddingVertical: 13,
    paddingRight: 12,
  },
  label: {
    fontFamily: fonts.mono500,
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fonts.sans600,
    fontSize: 13,
    marginTop: 6,
  },
});
