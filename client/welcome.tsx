// The welcome take-over (ticket 009, asked 2026-10-12): the first thing a new user sees once the plugin is
// installed. The line rises in, then the two ways on: start setup, or the owner's exit, word for word.
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { LEAVE_ME_ALONE, LEFT_ALONE_LINE, WELCOME_LINE } from "../shared/welcome";

type S = Record<"screen" | "body" | "h1" | "muted" | "button" | "buttonText" | "quiet" | "quietText", object>;

export function Welcome({ s, onGo, onLeave }: { s: S; onGo: () => void; onLeave: () => void }) {
  const line = useRef(new Animated.Value(0)).current;
  const ways = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ease = { easing: Easing.out(Easing.cubic), useNativeDriver: false };
    Animated.sequence([Animated.timing(line, { toValue: 1, duration: 700, ...ease }), Animated.timing(ways, { toValue: 1, duration: 400, ...ease })]).start();
  }, [line, ways]);
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] });
  return (
    <View style={[s.screen, { justifyContent: "center" }]}><View style={[s.body, { alignSelf: "center", gap: 24 }]}>
      <Animated.View style={rise(line)}><Text style={[s.h1, { fontSize: 30, lineHeight: 38 }]}>{WELCOME_LINE}</Text></Animated.View>
      <Animated.View style={[rise(ways), { gap: 12 }]}>
        <Pressable accessibilityRole="button" style={s.button} onPress={onGo}><Text style={s.buttonText}>Let's go</Text></Pressable>
        <Pressable accessibilityRole="button" style={s.quiet} onPress={onLeave}><Text style={s.quietText}>{LEAVE_ME_ALONE}</Text></Pressable>
      </Animated.View>
    </View></View>
  );
}

// After "set up later" (ticket 18): the owner's line, and on a wide layout an arrow toward the sidebar, where the
// setup row points at itself (index.client.tsx). On a phone the sidebar is a drawer, so no arrow.
export function LeftAlone({ s, compact }: { s: S; compact: boolean }) {
  return (
    <View style={[s.screen, { justifyContent: "center" }]}><View style={[s.body, { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 16 }]}>
      {!compact && <Text accessible={false} style={[s.h1, { fontSize: 40, lineHeight: 44 }]}>←</Text>}
      <Text style={[s.h1, { flexShrink: 1 }]}>{LEFT_ALONE_LINE}</Text>
    </View></View>
  );
}
