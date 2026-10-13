import type { PluginClientContext, PluginPopoverProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SetupScreen } from "./client/setup";
import { tutorialReadRpc, welcomeReadRpc } from "./shared/contracts";
import { takeOver } from "./shared/welcome";
import { REWARD_KIND, rewardRowSchema } from "./shared/reward";
import { DrawingView } from "./client/drawing";
import { WELCOME_KIND, welcomeBody, welcomeRowSchema, welcomeTitle } from "./shared/desk-welcome";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { onPoint, takePoint } from "./shared/pointer";

// No install hook opens a screen, so this item takes the screen over when it first renders (ticket 009): once, while
// this computer has not seen the welcome. The app's globalThis survives a plugin reload, so a reload does not reopen it.
const g = globalThis as { __agenticPocketsWelcomeOpened?: boolean };

// "Set up later" shows where setup lives (ticket 18): the row anchors a pop-up to itself, in the house pop-up's
// look, and a circle pulses round it until the user presses the row or the pop-up's button, or 20 s pass.
function PointerPopover({ theme, close, done }: PluginPopoverProps & { done: () => void }) {
  const c = theme.colors;
  return (
    <View style={{ gap: 10, padding: 14, maxWidth: 260, borderRadius: 12, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface1 }}>
      <Text style={{ color: c.foreground, fontSize: 15, lineHeight: 21 }}>Setup lives here. Press it whenever you want to start.</Text>
      <Pressable accessibilityRole="button" onPress={() => { done(); close(); }}
        style={{ alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.accent }}>
        <Text style={{ color: c.accentForeground, fontSize: 14, fontWeight: "600" }}>Got it</Text>
      </Pressable>
    </View>
  );
}

function Ring({ theme, on, children }: { theme: PluginSidebarItemProps["theme"]; on: boolean; children: ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, pulse]);
  if (!on) return <>{children}</>;
  return (
    <View>
      {children}
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: -2, bottom: -2, left: -2, right: -2, borderRadius: 10, borderWidth: 2,
        borderColor: theme.colors.accent, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }} />
    </View>
  );
}

function SetupItem({ theme, currentScreen, openScreen, openPopover }: PluginSidebarItemProps) {
  const [ring, setRing] = useState(false);
  useEffect(() => {
    const point = () => {
      if (!takePoint()) return;
      setRing(true);
      openPopover((p) => <PointerPopover {...p} done={() => setRing(false)} />);
    };
    point();
    return onPoint(point);
  }, [openPopover]);
  useEffect(() => {
    if (!ring) return;
    const timer = setTimeout(() => setRing(false), 20_000);
    return () => clearTimeout(timer);
  }, [ring]);
  const readWelcome = useRpc(welcomeReadRpc);
  const welcome = useQuery({ queryKey: ["setup.welcome.read"], queryFn: () => readWelcome({}) });
  useEffect(() => {
    if (!takeOver({ seen: welcome.data?.seen, openedThisSession: g.__agenticPocketsWelcomeOpened === true })) return;
    g.__agenticPocketsWelcomeOpened = true;
    openScreen({ screenId: "setup" });
  }, [welcome.data?.seen, openScreen]);
  // The label changes once the tutorial is complete (ticket 009); the item stays as the way into help.
  const readTutorial = useRpc(tutorialReadRpc);
  const tutorial = useQuery({ queryKey: ["setup.tutorial.read"], queryFn: () => readTutorial({}), refetchInterval: 60_000 });
  return (
    <Ring theme={theme} on={ring}>
      <SidebarRow icon="Sparkles" label={tutorial.data?.label} active={currentScreen?.screenId === "setup"} onPress={() => { setRing(false); openScreen({ screenId: "setup" }); }} />
    </Ring>
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "setup", title: "Agentic Pockets Setup", Component: SetupScreen });
  client.addSidebarHeaderItem({ id: "setup", title: "Agentic Pockets Setup", Component: SetupItem });
  // The tutorial's reward in the lead citizen's chat (ticket 009): its drawing, put there by the daemon half.
  client.addTimelineRenderer({ kind: REWARD_KIND, version: 1, schema: rewardRowSchema,
    Component: ({ item, theme, layout }) => <DrawingView drawing={item.data} theme={theme} width={layout.compact ? 300 : 320} /> });
  // The welcome at the top of the first desk's chat (shown only when setup put it there; see shared/desk-welcome.ts).
  client.addTimelineRenderer({ kind: WELCOME_KIND, version: 1, schema: welcomeRowSchema,
    Component: ({ item, theme }) => (
      <View style={{ gap: 6, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.accent, backgroundColor: theme.colors.surface1 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600" }}>{welcomeTitle}</Text>
        <Text style={{ color: theme.colors.foreground, fontSize: 15, lineHeight: 22 }}>{welcomeBody(item.data.citizen)}</Text>
      </View>
    ) });
  return () => {};
}
