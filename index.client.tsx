import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { SetupScreen } from "./client/setup";

function SetupItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return <SidebarRow icon="Sparkles" active={currentScreen?.screenId === "setup"} onPress={() => openScreen({ screenId: "setup" })} />;
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "setup", title: "Agentic Pockets setup", Component: SetupScreen });
  client.addSidebarHeaderItem({ id: "setup", title: "Agentic Pockets setup", Component: SetupItem });
  return () => {};
}
