import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import type { StatusSegment } from "../../data/assistant";

type BriefingProps = {
  headline: string;
  body: StatusSegment[];
};

/**
 * Briefing (design README §Assistant sheet): "You're on pace, Max." 16/600 +
 * a one-line cross-domain synthesis at 13/1.5. Bold segments (e.g. "green")
 * render at full ink, mirroring components/spec/TitleBlock's status-segment
 * convention.
 */
export function Briefing({ headline, body }: BriefingProps) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={[styles.headline, { color: c.ink }]}>{headline}</Text>
      <Text style={[styles.body, { color: c.ink64 }]}>
        {body.map((seg, i) =>
          typeof seg === "string" ? (
            seg
          ) : (
            <Text key={i} style={{ fontFamily: fonts.sans600, color: c.ink }}>
              {seg.b}
            </Text>
          ),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fonts.sans600,
    fontSize: 16,
    letterSpacing: -0.32,
  },
  body: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    lineHeight: 19.5,
    marginTop: 6,
  },
});
