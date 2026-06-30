import { StyleSheet, Text, View } from "react-native";

import type { Attendee } from "../../data/detail";
import { color, font } from "../../theme/tokens";

/**
 * Overlapping circular initial avatars for the Detail "With" fact (spec §5.5 /
 * mockup `.dt-ppl`). Each chip is a surface circle with a hairline ring; the
 * trailing "+N" overflow chip is just another entry whose `initials` start with
 * "+". Defined locally — these avatars are Detail-specific (rule 4).
 */
export function AttendeeStack({ attendees }: { attendees: Attendee[] }) {
  return (
    <View style={styles.row}>
      {attendees.map((person, i) => (
        <View key={`${person.initials}-${i}`} style={[styles.avatar, i === 0 && styles.first]}>
          <Text style={styles.initials}>{person.initials}</Text>
        </View>
      ))}
    </View>
  );
}

const SIZE = 23;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginLeft: -6,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line2,
    alignItems: "center",
    justifyContent: "center",
  },
  first: {
    marginLeft: 0,
  },
  initials: {
    fontFamily: font.monoSemi,
    fontSize: 8,
    color: color.fg2,
  },
});
