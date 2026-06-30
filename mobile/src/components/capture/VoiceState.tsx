import { Pressable, StyleSheet, Text, View } from "react-native";

import { MicOrb } from "./MicOrb";
import { Waveform } from "./Waveform";
import { captureData } from "../../data/capture";
import { color, font } from "../../theme/tokens";

/**
 * Voice / dictation Listening state (spec §5.6 · §6.2). Pulsing mic orb +
 * animated waveform + "Listening…" + a live transcript (committed text fg2,
 * in-flight text fg4 + a blue caret). The dock is Cancel · Stop · Keyboard:
 * Stop returns to the conversation, Cancel/Keyboard dismiss the voice state.
 */
type VoiceStateProps = {
  onStop?: () => void;
  onCancel?: () => void;
  onKeyboard?: () => void;
};

export function VoiceState({ onStop, onCancel, onKeyboard }: VoiceStateProps) {
  const { status, committed, pending, cancel, keyboard } = captureData.voice;
  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <MicOrb />
        <Waveform />
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.transcript}>
          {committed}
          <Text style={styles.pending}>{pending}</Text>
          <Text style={styles.caret}>|</Text>
        </Text>
      </View>

      <View style={styles.dock}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.side}>{cancel}</Text>
        </Pressable>
        <Pressable style={styles.stop} onPress={onStop}>
          <View style={styles.stopGlyph} />
        </Pressable>
        <Pressable onPress={onKeyboard} hitSlop={10}>
          <Text style={styles.side}>{keyboard}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  status: {
    fontFamily: font.monoBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: color.blue,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  transcript: {
    fontFamily: font.sans,
    fontSize: 16,
    lineHeight: 22,
    color: color.fg2,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  pending: {
    color: color.fg4,
  },
  caret: {
    color: color.blue,
    fontFamily: font.sansSemi,
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
  },
  side: {
    fontFamily: font.monoBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: color.fg4,
    textTransform: "uppercase",
  },
  stop: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(58,112,168,0.14)",
    borderWidth: 1.5,
    borderColor: color.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  stopGlyph: {
    width: 19,
    height: 19,
    borderRadius: 5,
    backgroundColor: color.blue,
  },
});
