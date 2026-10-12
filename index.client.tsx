import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SetupScreen } from "./client/setup";
import { welcomeReadRpc } from "./shared/contracts";
import { takeOver } from "./shared/welcome";

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
  return <SidebarRow icon="Sparkles" active={currentScreen?.screenId === "setup"} onPress={() => openScreen({ screenId: "setup" })} />;
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "setup", title: "Agentic Pockets setup", Component: SetupScreen });
  client.addSidebarHeaderItem({ id: "setup", title: "Agentic Pockets setup", Component: SetupItem });
  return () => {};
}
