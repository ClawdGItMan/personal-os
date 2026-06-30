import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { color, glow } from "../../theme/tokens";

const W = 300;
const H = 118;
const TOP = 16;
const BOTTOM = 96;

type AreaTrendChartProps = {
  /** Net-worth series normalized 0–1 (1 = highest point), left→right. */
  series: number[];
};

function points(series: number[]): { x: number; y: number }[] {
  const last = series.length - 1 || 1;
  return series.map((v, i) => ({
    x: (i / last) * W,
    y: BOTTOM - v * (BOTTOM - TOP),
  }));
}

/**
 * Money net-worth area chart (spec §4 · §5.3): faint .05 gridlines, 2px green
 * stroke, green→transparent vertical fill, soft glowing end dot. viewBox scales
 * to the column width; web-safe (pure react-native-svg, no native-only APIs).
 */
export function AreaTrendChart({ series }: AreaTrendChartProps) {
  const pts = points(series);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fill = `${line} L${W},${H} L0,${H} Z`;
  const end = pts[pts.length - 1];

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="moneyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.green} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color.green} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Line x1="0" y1={40} x2={W} y2={40} stroke={color.fg1} strokeOpacity={0.05} strokeWidth={1} />
        <Line x1="0" y1={80} x2={W} y2={80} stroke={color.fg1} strokeOpacity={0.05} strokeWidth={1} />
        <Path d={fill} fill="url(#moneyFill)" />
        <Path d={line} fill="none" stroke={color.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={end.x} cy={end.y} r={3.2} fill={color.green} />
      </Svg>
      {/* Soft glow behind the end dot — RN shadow can't live on an SVG node on web. */}
      <View style={[styles.dotGlow, glow(color.green, 7, 0.6), { left: `${(end.x / W) * 100}%`, top: end.y }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  dotGlow: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
    backgroundColor: color.green,
  },
});
