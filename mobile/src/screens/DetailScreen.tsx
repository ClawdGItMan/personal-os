import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionBar } from "../components/ActionBar";
import { AIRecommendationsEmpty, AIRecommendationsPanel } from "../components/AIRecommendationsPanel";
import { SectionEnter } from "../components/SectionEnter";
import { SectionHeader } from "../components/SectionHeader";
import { DetailFactsRow } from "../components/detail/DetailFactsRow";
import { DetailHeader } from "../components/detail/DetailHeader";
import { detailContent } from "../data/detail";
import type { DetailItem } from "../navigation/NavContext";
import { useNav } from "../navigation/NavContext";
import { color, font, space, type } from "../theme/tokens";

/**
 * Detail page (spec §5.5) — one shared template, content flexes by `item.kind`.
 * A pushed full-screen overlay that sits *under* the global BottomNav (App
 * layers it before the nav), so the tab bar stays visible with Focus active.
 * Back chevron → close() returns to Focus. The headline comes from the tapped
 * row (`item.title`); the rich body is pulled from our own mock keyed by kind.
 * Toggle AGENT_ON to preview the §6.3 "agent off" empty Recommended state.
 */
const AGENT_ON = true;

export function DetailScreen({ item }: { item: DetailItem }) {
  const { close } = useNav();
  const content = detailContent[item.kind];
  const isEvent = item.kind === "event";

  return (
    <View style={styles.host}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DetailHeader onBack={close} />

        <SectionEnter index={0}>
          <View style={styles.eyebrow}>
            <View style={isEvent ? styles.dotEvent : styles.dotTask} />
            <Text style={styles.eyebrowType}>{content.eyebrowType}</Text>
            <Text style={styles.eyebrowSource}>· {content.eyebrowSource}</Text>
          </View>
          <Text style={styles.title}>
            {content.title.lead}
            <Text style={type.screenTitleItalic}>{content.title.emphasis}</Text>
          </Text>
        </SectionEnter>

        <SectionEnter index={1}>
          <View style={styles.facts}>
            {content.facts.map((fact) => (
              <DetailFactsRow key={fact.label} fact={fact} />
            ))}
          </View>
        </SectionEnter>

        <SectionEnter index={2}>
          <SectionHeader title="About" meta={content.aboutMeta} />
          <Text style={styles.about}>{content.about}</Text>
        </SectionEnter>

        <SectionEnter index={3}>
          {AGENT_ON ? (
            <AIRecommendationsPanel recommendations={content.recommendations} />
          ) : (
            <AIRecommendationsEmpty />
          )}
        </SectionEnter>

        <SectionEnter index={4}>
          <ActionBar actions={content.actions.map((label, i) => ({ label, primary: i === 0 }))} />
        </SectionEnter>
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
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: space.gutter,
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
    backgroundColor: color.blue,
  },
  dotTask: {
    width: DOT,
    height: DOT,
    borderRadius: 2,
    borderWidth: 1.4,
    borderColor: color.fg3,
  },
  eyebrowType: {
    ...type.eyebrow,
    color: color.blue,
  },
  eyebrowSource: {
    ...type.eyebrow,
    color: color.fg4,
  },
  title: {
    ...type.screenTitle,
    marginTop: 9,
  },
  facts: {
    marginTop: 20,
    borderTopWidth: 1,
    borderColor: color.line1,
  },
  about: {
    fontFamily: font.sans,
    fontSize: 13.5,
    lineHeight: 22,
    color: color.fg2,
  },
});
