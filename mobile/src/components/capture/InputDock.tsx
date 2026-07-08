import { Pressable, StyleSheet, Text, View } from "react-native";

import { captureData } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { MicIcon, SendIcon } from "../icons";
import { QuickIntentChips } from "./QuickIntentChips";

/**
 * Input dock (spec §5.6) — bottom of the sheet: quick-intent chips + a text
 * field ("Log anything…") with an accent caret, a mic button (taps into the
 * voice Listening state), and an accent send button. Static placeholder field
 * — real keyboard input is wired when the agent pipeline lands; the mic is the
 * live affordance here.
 */
type InputDockProps = {
  onMic?: () => void;
  onSend?: () => void;
  onIntent?: (intent: string) => void;
};

export function InputDock({ onMic, onSend, onIntent }: InputDockProps) {
  const { c } = useTheme();
  return (
    <View style={styles.dock}>
      <QuickIntentChips intents={captureData.quickIntents} onIntent={onIntent} />
      <View style={[styles.field, { borderColor: c.hairSection, backgroundColor: c.surface }]}>
        <Text style={[styles.placeholder, { color: c.ink38 }]}>{captureData.placeholder}</Text>
        <View style={[styles.caret, { backgroundColor: c.accent }]} />
        <Pressable onPress={onMic} hitSlop={8} style={styles.micBtn}>
          <MicIcon size={20} color={c.ink50} strokeWidth={1.8} />
        </Pressable>
        <Pressable style={[styles.send, { backgroundColor: c.accent }]} onPress={onSend}>
          <SendIcon size={17} color={c.onAccent} strokeWidth={2.2} />
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
    borderRadius: 18,
  },
  placeholder: {
    flex: 1,
    fontFamily: fonts.sans500,
    fontSize: 14,
  },
  caret: {
    width: 1.5,
    height: 16,
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
    alignItems: "center",
    justifyContent: "center",
  },
});
