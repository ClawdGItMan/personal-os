import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { color, font, type } from "../theme/tokens";

const AVATAR = 32;
const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

type AppHeaderProps = {
  /** Recovery % drives the avatar status ring sweep (Fable pass). */
  recoveryPct: number;
  /** Brand-dot color cueing the active screen (spec §4). Defaults to blue (Home). */
  tone?: string;
};

export function AppHeader({ recoveryPct, tone = color.blue }: AppHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={[styles.brandDot, { backgroundColor: tone, shadowColor: tone }]} />
        <Text style={type.brand}>MAX OS</Text>
      </View>

      <View style={styles.avatar}>
        <Svg width={AVATAR} height={AVATAR} style={StyleSheet.absoluteFill}>
          <Circle cx={AVATAR / 2} cy={AVATAR / 2} r={RING_R} stroke={color.line2} strokeWidth={2} fill="none" />
          <Circle
            cx={AVATAR / 2}
            cy={AVATAR / 2}
            r={RING_R}
            stroke={color.green}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_C * recoveryPct} ${RING_C}`}
            transform={`rotate(-90 ${AVATAR / 2} ${AVATAR / 2})`}
          />
        </Svg>
        <View style={styles.face}>
          <Text style={styles.initials}>MA</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 7,
    shadowOpacity: 0.7,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: AVATAR - 6,
    height: AVATAR - 6,
    borderRadius: (AVATAR - 6) / 2,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: font.monoSemi,
    fontSize: 10,
    color: color.fg2,
  },
});
