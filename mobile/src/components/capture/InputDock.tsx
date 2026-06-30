import { Pressable, StyleSheet, Text, View } from "react-native";

import { MicIcon, SendIcon } from "../icons";
import { QuickIntentChips } from "./QuickIntentChips";
import { captureData } from "../../data/capture";
import { color, font, glow } from "../../theme/tokens";

/**
 * Input dock (spec §5.6) — bottom of the sheet: quick-intent chips + a text
 * field ("Log anything…") with a blue caret, a mic button (taps into the voice
 * Listening state), and a blue send button. Static placeholder field — real
 * keyboard input is wired when the agent pipeline lands; the mic is the live
 * affordance here.
 */
type InputDockProps = {
  onMic?: () => void;
  onSend?: () => void;
  onIntent?: (intent: string) => void;
};

export function InputDock({ onMic, onSend, onIntent }: InputDockProps) {
  return (
    <View style={styles.dock}>
      <QuickIntentChips intents={captureData.quickIntents} onIntent={onIntent} />
      <View style={styles.field}>
        <Text style={styles.placeholder}>{captureData.placeholder}</Text>
        <View style={styles.caret} />
        <Pressable onPress={onMic} hitSlop={8} style={styles.micBtn}>
          <MicIcon size={20} color={color.fg3} strokeWidth={1.8} />
        </Pressable>
        <Pressable style={[styles.send, glow(color.blue, 16, 0.32)]} onPress={onSend}>
          <SendIcon size={17} color={color.bg} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingLeft: 16,
    paddingRight: 9,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: color.line2,
    borderRadius: 18,
    backgroundColor: "rgba(20,23,28,0.6)",
  },
  placeholder: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 14,
    color: color.fg4,
  },
  caret: {
    width: 1.5,
    height: 16,
    backgroundColor: color.blue,
    marginRight: -7,
  },
  micBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: color.blue,
    alignItems: "center",
    justifyContent: "center",
  },
});
