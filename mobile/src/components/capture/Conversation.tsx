import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ConfirmationCard } from "./ConfirmationCard";
import { PermissionCard } from "./PermissionCard";
import { captureData } from "../../data/capture";
import { color, font } from "../../theme/tokens";

/**
 * The Capture conversation (spec §5.6): serif-italic agent intro, then each
 * exchange as a right-aligned user-utterance bubble (Manrope clean, with a
 * "YOU · time" mono eyebrow) followed by the agent's hairline card — a
 * ConfirmationCard for parsed entries, then the PermissionCard write-back gate.
 * Cards, not chat bubbles.
 */
function Utterance({ time, text }: { time: string; text: string }) {
  return (
    <Fragment>
      <Text style={styles.youEyebrow}>{`You · ${time}`}</Text>
      <Text style={styles.utterance}>{text}</Text>
    </Fragment>
  );
}

export function Conversation() {
  const { intro, exchanges, permission } = captureData;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{intro}</Text>

      {exchanges.map((exchange) => (
        <View key={exchange.id} style={styles.exchange}>
          <Utterance time={exchange.time} text={exchange.utterance} />
          <ConfirmationCard exchange={exchange} />
        </View>
      ))}

      <View style={styles.exchange}>
        <Utterance time={permission.time} text={permission.utterance} />
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
    fontFamily: font.serifItalic,
    fontSize: 17,
    lineHeight: 24,
    color: color.fg3,
    marginTop: 16,
    marginBottom: 4,
  },
  exchange: {
    marginTop: 18,
  },
  youEyebrow: {
    fontFamily: font.monoBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: color.fg4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  utterance: {
    fontFamily: font.sansSemi,
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: color.fg1,
    textAlign: "right",
    marginTop: 6,
  },
});
