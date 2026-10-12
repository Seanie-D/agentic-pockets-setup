// The tutorial's reward, drawn from the lead citizen's shapes (shared/reward.ts) with plain views, so it draws the same on
// desktop, browser and phone. Ink is the theme's foreground; a blob's fill is the citizen's pick, else none.
import type { PluginTheme } from "@getpaseo/plugin";
import { Text, View } from "react-native";
import { DRAW_H, DRAW_W, type Drawing, type Shape } from "../shared/reward";

function Mark({ s, ink }: { s: Shape; ink: string }) {
  const at = (left: number, top: number) => ({ position: "absolute" as const, left, top });
  switch (s.t) {
    case "blob":
      return <View style={[at(s.x - s.w / 2, s.y - s.h / 2), { width: s.w, height: s.h, borderRadius: Math.max(s.w, s.h), borderWidth: 2.5, borderColor: ink,
        backgroundColor: s.fill ?? "transparent", transform: [{ rotate: `${s.tilt ?? 0}deg` }] }]} />;
    case "smile":
      return <View style={[at(s.x - s.r, s.y), { width: s.r * 2, height: s.r, borderBottomLeftRadius: s.r, borderBottomRightRadius: s.r, borderWidth: 2.5, borderTopWidth: 0, borderColor: ink }]} />;
    case "dot": { const r = s.r ?? 3; return <View style={[at(s.x - r, s.y - r), { width: r * 2, height: r * 2, borderRadius: r, backgroundColor: ink }]} />; }
    case "line": {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); const w = s.w ?? 2.5;
      return <View style={[at((s.x1 + s.x2) / 2 - len / 2, (s.y1 + s.y2) / 2 - w / 2), { width: len, height: w, borderRadius: w, backgroundColor: ink,
        transform: [{ rotate: `${Math.atan2(s.y2 - s.y1, s.x2 - s.x1)}rad` }] }]} />;
    }
    case "text":
      return <Text style={[at(s.x, s.y), { color: ink, fontSize: s.size ?? 16, fontStyle: "italic" }]}>{s.text}</Text>;
  }
}

export function DrawingView({ drawing, theme, width = DRAW_W }: { drawing: Drawing; theme: PluginTheme; width?: number }) {
  const k = Math.min(1, width / DRAW_W);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ width: DRAW_W * k, height: DRAW_H * k, overflow: "hidden", borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }}>
        <View style={{ width: DRAW_W, height: DRAW_H, transform: [{ scale: k }], transformOrigin: "top left" }}>
          {drawing.shapes.map((s, i) => <Mark key={i} s={s} ink={theme.colors.foreground} />)}
        </View>
      </View>
      <Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 22 }}>{drawing.line}</Text>
    </View>
  );
}
