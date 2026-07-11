import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { captureData } from "../../data/capture";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { ConfirmationCard } from "./ConfirmationCard";
import { SystemNotice } from "./SystemNotice";
import type { CaptureEntry } from "./useCaptureSession";

/**
 * The Capture conversation (spec §5.6): this session's exchanges only (the
 * server persists full history — Capture is ephemeral UI by design). Before
 * the first message, a minimal hint replaces the old mock conversation. Each
 * entry renders by kind: a right-aligned user utterance, a left-aligned
 * streaming agent reply, a real ConfirmationCard per tool result, or a
 * SystemNotice for the not-configured/offline/error states.
 */
function Utterance({ time, text, dim, ink }: { time: string; text: string; dim: string; ink: string }) {
  return (
    <Fragment>
      <Text style={[styles.youEyebrow, { color: dim }]}>{`You · ${time}`}</Text>
      <Text style={[styles.utterance, { color: ink }]}>{text}</Text>
    </Fragment>
  );
}

function AgentReply({ time, text, dim, ink }: { time: string; text: string; dim: string; ink: string }) {
  return (
    <Fragment>
      <Text style={[styles.agentEyebrow, { color: dim }]}>{`Agent · ${time}`}</Text>
      <Text style={[styles.agentText, { color: ink }]}>{text}</Text>
    </Fragment>
  );
}

type ConversationProps = {
  entries: CaptureEntry[];
  onUndo: (entryId: string) => void;
  onRetry: () => void;
};

export function Conversation({ entries, onUndo, onRetry }: ConversationProps) {
  const { c } = useTheme();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {entries.length === 0 ? <Text style={[styles.intro, { color: c.ink50 }]}>{captureData.intro}</Text> : null}

      {entries.map((entry) => {
        switch (entry.kind) {
          case "user":
            return (
              <View key={entry.id} style={styles.exchange}>
                <Utterance time={entry.time} text={entry.text} dim={c.ink38} ink={c.ink} />
              </View>
            );
          case "assistant":
            return (
              <View key={entry.id} style={styles.exchange}>
                <AgentReply time={entry.time} text={entry.text} dim={c.ink38} ink={c.ink72} />
              </View>
            );
          case "confirmation":
            return (
              <View key={entry.id} style={styles.exchange}>
                <ConfirmationCard confirmation={entry.confirmation} onUndo={() => onUndo(entry.id)} />
              </View>
            );
          case "notice":
            return (
              <View key={entry.id} style={styles.exchange}>
                <SystemNotice
                  tone={entry.tone}
                  title={entry.title}
                  message={entry.message}
                  onRetry={entry.retryable ? onRetry : undefined}
                />
              </View>
            );
          default:
            return null;
        }
      })}
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
  agentEyebrow: {
    fontFamily: fonts.mono600,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  agentText: {
    fontFamily: fonts.sans500,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
    marginTop: 6,
  },
});
