import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { captureData } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { ConfirmationCard } from "./ConfirmationCard";
import { PermissionCard } from "./PermissionCard";

/**
 * The Capture conversation (spec §5.6): an agent intro, then each exchange as
 * a right-aligned user-utterance bubble (Manrope clean, with a "YOU · time"
 * mono eyebrow) followed by the agent's hairline card — a ConfirmationCard for
 * parsed entries, then the PermissionCard write-back gate. Cards, not chat
 * bubbles.
 */
function Utterance({ time, text, dim, ink }: { time: string; text: string; dim: string; ink: string }) {
  return (
    <Fragment>
      <Text style={[styles.youEyebrow, { color: dim }]}>{`You · ${time}`}</Text>
      <Text style={[styles.utterance, { color: ink }]}>{text}</Text>
    </Fragment>
  );
}

export function Conversation() {
  const { c } = useTheme();
  const { intro, exchanges, permission } = captureData;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.intro, { color: c.ink50 }]}>{intro}</Text>

      {exchanges.map((exchange) => (
        <View key={exchange.id} style={styles.exchange}>
          <Utterance time={exchange.time} text={exchange.utterance} dim={c.ink38} ink={c.ink} />
          <ConfirmationCard exchange={exchange} />
        </View>
      ))}

      <View style={styles.exchange}>
        <Utterance time={permission.time} text={permission.utterance} dim={c.ink38} ink={c.ink} />
        <PermissionCard permission={permission} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  intro: {
    fontFamily: fonts.sans500,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 16,
    marginBottom: 4,
  },
  exchange: {
    marginTop: 18,
  },
  youEyebrow: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    textAlign: "right",
  },
  utterance: {
    fontFamily: fonts.sans600,
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.16,
    textAlign: "right",
    marginTop: 6,
  },
});
