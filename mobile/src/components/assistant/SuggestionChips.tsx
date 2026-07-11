import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";

type SuggestionChipsProps = {
  items: string[];
  onSelect: (label: string) => void;
};

/** Suggestion chips (design README §Assistant sheet) — outlined pills, 11.5/500. */
export function SuggestionChips({ items, onSelect }: SuggestionChipsProps) {
  const { c, t } = useTheme();
  return (
    <View style={styles.row}>
      {items.map((label) => (
        <Pressable key={label} onPress={() => onSelect(label)} style={[styles.chip, { borderColor: c.hairSection }]}>
          <Text style={t.chip}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
