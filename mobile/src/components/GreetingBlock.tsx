import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { color, font, type } from "../theme/tokens";

type GreetingBlockProps = {
  eyebrow: string;
  lead: string;
  name: string;
  whisper: string;
  /** 0–1, how much of the day has elapsed — fills the hairline. */
  dayProgress: number;
};

function DayProgress({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.dayline}>
      <Svg width="100%" height={5}>
        <Defs>
          <LinearGradient id="dayFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color.blue} stopOpacity={0} />
            <Stop offset="1" stopColor={color.blue} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y={1.5} width="100%" height={2} rx={1} fill={color.line1} />
        <Rect x="0" y={1.5} width={`${pct}%`} height={2} rx={1} fill="url(#dayFill)" />
        <Circle cx={`${pct}%`} cy={2.5} r={2.5} fill={color.blue} />
      </Svg>
    </View>
  );
}

/** Home's opening read: eyebrow → serif greeting (italic name) → agent whisper → day hairline. */
export function GreetingBlock({ eyebrow, lead, name, whisper, dayProgress }: GreetingBlockProps) {
  return (
    <View>
      <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
      <Text style={type.greeting}>
        {lead}
        {"\n"}
        <Text style={styles.name}>{name}</Text>
      </Text>
      <Text style={[type.whisper, styles.whisperText]}>{whisper}</Text>
      <DayProgress progress={dayProgress} />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginBottom: 8,
  },
  name: {
    fontFamily: font.serifItalic,
  },
  whisperText: {
    marginTop: 12,
  },
  dayline: {
    marginTop: 16,
  },
});
