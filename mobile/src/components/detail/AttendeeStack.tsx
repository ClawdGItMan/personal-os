import { StyleSheet, Text, View } from "react-native";

import type { Attendee } from "../../data/detail";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

/**
 * Overlapping circular initial avatars for the Detail "With" fact (spec §5.5 /
 * mockup `.dt-ppl`). Each chip is a surface circle with a hairline ring; the
 * trailing "+N" overflow chip is just another entry whose `initials` start with
 * "+". Defined locally — these avatars are Detail-specific (rule 4).
 */
export function AttendeeStack({ attendees }: { attendees: Attendee[] }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {attendees.map((person, i) => (
        <View
          key={`${person.initials}-${i}`}
          style={[styles.avatar, { backgroundColor: c.surface, borderColor: c.hairSection }, i === 0 && styles.first]}
        >
          <Text style={[styles.initials, { color: c.ink72 }]}>{person.initials}</Text>
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
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  first: {
    marginLeft: 0,
  },
  initials: {
    fontFamily: fonts.mono500,
    fontSize: 8,
  },
});
