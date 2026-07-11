import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionBar } from "../components/ActionBar";
import { AIRecommendationsEmpty, AIRecommendationsPanel } from "../components/AIRecommendationsPanel";
import { SectionHeader } from "../components/SectionHeader";
import { DetailFactsRow } from "../components/detail/DetailFactsRow";
import { DetailHeader } from "../components/detail/DetailHeader";
import { detailContent } from "../data/detail";
import { FadeUp } from "../motion/FadeUp";
import type { DetailItem } from "../navigation/NavContext";
import { useNav } from "../navigation/NavContext";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typeRoles";

/**
 * Detail page (spec §5.5) — one shared template, content flexes by `item.kind`.
 * A pushed full-screen overlay that sits *under* the global TabBar (App
 * layers it before the nav), so the tab bar stays visible with Focus active.
 * Back chevron → close() returns to Focus. The headline comes from the tapped
 * row (`item.title`); the rich body is pulled from our own mock keyed by kind.
 * Toggle AGENT_ON to preview the §6.3 "agent off" empty Recommended state.
 * Entrance choreography uses the shared FadeUp (motion/FadeUp), matching every
 * other screen — the old per-screen SectionEnter helper is retired.
 */
const AGENT_ON = true;

export function DetailScreen({ item }: { item: DetailItem }) {
  const { c } = useTheme();
  const { close } = useNav();
  // Mock content only exists for event/task; 'workout' renders the event
  // template until the live Detail rewrite (task B8) replaces this file.
  const content = detailContent[item.kind === "task" ? "task" : "event"];
  const isEvent = item.kind === "event";

  return (
    <View style={[styles.host, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DetailHeader onBack={close} />

        <FadeUp index={0}>
          <View style={styles.eyebrow}>
            <View
              style={
                isEvent
                  ? [styles.dotEvent, { backgroundColor: c.accent }]
                  : [styles.dotTask, { borderColor: c.ink50 }]
              }
            />
            <Text style={[styles.eyebrowType, { color: c.accent }]}>{content.eyebrowType}</Text>
            <Text style={[styles.eyebrowSource, { color: c.ink38 }]}>· {content.eyebrowSource}</Text>
          </View>
          <Text style={[styles.title, { color: c.ink }]}>
            {content.title.lead}
            <Text style={[styles.titleEmphasis, { color: c.ink }]}>{content.title.emphasis}</Text>
          </Text>
        </FadeUp>

        <FadeUp index={1}>
          <View style={[styles.facts, { borderColor: c.hairSection }]}>
            {content.facts.map((fact) => (
              <DetailFactsRow key={fact.label} fact={fact} />
            ))}
          </View>
        </FadeUp>

        <FadeUp index={2}>
          <SectionHeader title="About" meta={content.aboutMeta} />
          <Text style={[styles.about, { color: c.ink72 }]}>{content.about}</Text>
        </FadeUp>

        <FadeUp index={3}>
          {AGENT_ON ? (
            <AIRecommendationsPanel recommendations={content.recommendations} />
          ) : (
            <AIRecommendationsEmpty />
          )}
        </FadeUp>

        <FadeUp index={4}>
          <ActionBar actions={content.actions.map((label, i) => ({ label, primary: i === 0 }))} />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "web" ? 28 : 62,
    paddingBottom: 110,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  dotEvent: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  dotTask: {
    width: DOT,
    height: DOT,
    borderRadius: 2,
    borderWidth: 1.4,
  },
  eyebrowType: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  eyebrowSource: {
    fontFamily: fonts.mono600,
    fontSize: 9,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.sans600,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    marginTop: 9,
  },
  titleEmphasis: {
    fontFamily: fonts.sans700,
  },
  facts: {
    marginTop: 20,
    borderTopWidth: 1,
  },
  about: {
    fontFamily: fonts.sans400,
    fontSize: 13.5,
    lineHeight: 22,
  },
});
