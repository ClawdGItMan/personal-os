import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { Pressed } from "../spec/Pressed";

/**
 * System notice (spec §5.6 states: AssistantNotConfigured / offline /
 * mid-stream error). Same hairline-card chrome as a ConfirmationCard, tinted
 * by tone instead of the accent — `notice` reads neutral (config/connectivity),
 * `error` reads in the palette's `red` role. An optional retry chip re-runs
 * the last failed send.
 */
type SystemNoticeProps = {
  tone: "notice" | "error";
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function SystemNotice({ tone, title, message, onRetry }: SystemNoticeProps) {
  const { c } = useTheme();
  const tint = tone === "error" ? c.red : c.ink50;

  return (
    <View style={[styles.card, { borderColor: c.hairRow, backgroundColor: c.surface }]}>
      {title ? <Text style={[styles.title, { color: tint }]}>{title}</Text> : null}
      <Text style={[styles.message, { color: c.ink72 }]}>{message}</Text>
      {onRetry ? (
        <Pressed style={[styles.chip, { borderColor: c.hairSection }]} onPress={onRetry} hitSlop={6}>
          <Text style={[styles.chipLabel, { color: c.ink50 }]}>Retry</Text>
        </Pressed>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginTop: 13,
  },
  title: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  message: {
    fontFamily: fonts.sans400,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 6,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 9,
    marginTop: 11,
  },
  chipLabel: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
});
