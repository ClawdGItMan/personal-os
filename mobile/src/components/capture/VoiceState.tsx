import { Pressable, StyleSheet, Text, View } from "react-native";

import { captureData } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { MicOrb } from "./MicOrb";
import { Waveform } from "./Waveform";

/**
 * Voice / dictation Listening state (spec §5.6 · §6.2). Pulsing mic orb +
 * animated waveform + "Listening…" + a live transcript (committed text at ink
 * .72, in-flight text at ink .38 + an accent caret). The dock is
 * Cancel · Stop · Keyboard: Stop returns to the conversation, Cancel/Keyboard
 * dismiss the voice state.
 */
type VoiceStateProps = {
  onStop?: () => void;
  onCancel?: () => void;
  onKeyboard?: () => void;
};

export function VoiceState({ onStop, onCancel, onKeyboard }: VoiceStateProps) {
  const { c, mode } = useTheme();
  const stopWash = mode === "light" ? "rgba(30,122,82,0.14)" : "rgba(108,171,134,0.14)";
  const { status, committed, pending, cancel, keyboard } = captureData.voice;
  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <MicOrb />
        <Waveform />
        <Text style={[styles.status, { color: c.accent }]}>{status}</Text>
        <Text style={[styles.transcript, { color: c.ink72 }]}>
          {committed}
          <Text style={{ color: c.ink38 }}>{pending}</Text>
          <Text style={[styles.caret, { color: c.accent }]}>|</Text>
        </Text>
      </View>

      <View style={styles.dock}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={[styles.side, { color: c.ink38 }]}>{cancel}</Text>
        </Pressable>
        <Pressable style={[styles.stop, { backgroundColor: stopWash, borderColor: c.accent }]} onPress={onStop}>
          <View style={[styles.stopGlyph, { backgroundColor: c.accent }]} />
        </Pressable>
        <Pressable onPress={onKeyboard} hitSlop={10}>
          <Text style={[styles.side, { color: c.ink38 }]}>{keyboard}</Text>
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
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  transcript: {
    fontFamily: fonts.sans500,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  caret: {
    fontFamily: fonts.sans600,
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
    fontFamily: fonts.mono600,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  stop: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stopGlyph: {
    width: 19,
    height: 19,
    borderRadius: 5,
  },
});
