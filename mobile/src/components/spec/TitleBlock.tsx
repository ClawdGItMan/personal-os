import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";
import { layout } from "../../theme/layout";

export type StatusSegment = string | { b: string };

type TitleBlockProps = {
  /** Screen title, e.g. "Good afternoon, Max." or "Body". */
  title: string;
  /** Status line segments — `{b}` segments render bold Manrope 600 at full ink. */
  status: StatusSegment[];
};

/**
 * Title block (design README §Spacing: 16/600 title + 13/1.5 status at
 * ink .64–.66, max-width 300). Bold segments carry the state emphasis, e.g.
 * "Recovery's **green** … until the **Sequoia call**."
 */
export function TitleBlock({ title, status }: TitleBlockProps) {
  const { c, t } = useTheme();
  return (
    <View style={styles.block}>
      <Text style={t.screenTitle}>{title}</Text>
      <Text style={[t.statusLine, styles.status]}>
        {status.map((seg, i) =>
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
  block: {
    paddingHorizontal: layout.gutter,
  },
  status: {
    marginTop: 7,
    maxWidth: 300,
  },
});
