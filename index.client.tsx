import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SetupScreen } from "./client/setup";
import { tutorialReadRpc, welcomeReadRpc } from "./shared/contracts";
import { takeOver } from "./shared/welcome";
import { REWARD_KIND, rewardRowSchema } from "./shared/reward";
import { DrawingView } from "./client/drawing";
import { WELCOME_KIND, welcomeBody, welcomeRowSchema, welcomeTitle } from "./shared/desk-welcome";
import { Text, View } from "react-native";

// No install hook opens a screen, so this item takes the screen over when it first renders (ticket 009): once, while
// this computer has not seen the welcome. The app's globalThis survives a plugin reload, so a reload does not reopen it.
const g = globalThis as { __agenticPocketsWelcomeOpened?: boolean };

function SetupItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
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
  return <SidebarRow icon="Sparkles" label={tutorial.data?.label} active={currentScreen?.screenId === "setup"} onPress={() => openScreen({ screenId: "setup" })} />;
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
