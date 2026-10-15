import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { helpButtonRpc } from "../shared/contracts";

// The Setup / Help button in each citizen's workspace (the owner, 2026-10-15: setup must be reachable with the sidebar
// off). The server names the workspaces and the word (shared/help-button.ts); a press opens the setup screen. Checked
// every minute, so a citizen added later gets one, and the word turns to Help when the tutorial is complete.
let word: "Setup" | "Help" = "Setup";

export function addHelpButtons(client: PluginClientContext): () => void {
  const buttons = new Map<string, PluginButtonRegistration>();
  // A sync still waiting on the server when the plugin reloads must add nothing after: its buttons would outlive it.
  let dead = false, busy = false;
  const sync = async () => {
    if (busy || dead) return;
    busy = true;
    try {
      const { workspaceIds, label } = await client.rpc(helpButtonRpc, {});
      if (dead) return;
      const changed = label !== word;
      word = label;
      for (const id of workspaceIds) {
        const had = buttons.get(id);
        if (had) { if (changed) had.update({ label, title: `Agentic Pockets ${label}`, icon: "Sparkles" }); continue; }
        try {
          buttons.set(id, client.addHeaderButton({
            id: "setup-help",
            workspaceId: id,
            button: { title: `Agentic Pockets ${label}`, label, icon: "Sparkles", behavior: { kind: "action", onPress: () => client.openScreen({ screenId: "setup" }) } },
          }));
        } catch (e) { console.warn(`[agentic-pockets-setup] no ${label} button on ${id}:`, e); }
      }
      for (const [id, b] of buttons) if (!workspaceIds.includes(id)) { b.remove(); buttons.delete(id); }
    } finally { busy = false; }
  };
  void sync().catch(() => { /* the next minute tries again */ });
  const timer = setInterval(() => { void sync().catch(() => {}); }, 60_000);
  return () => { dead = true; clearInterval(timer); buttons.forEach((b) => b.remove()); buttons.clear(); };
}
