// The setup screen (ticket 004 Resolution, steps 2–5): your tools, your invite, who you start with, then your first citizen.
// Plain words, the safe choice first, one step on screen at a time.
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { connectRpc, finishRpc, installRpc, status } from "../shared/contracts";
import { PACKS, emptyPick, toggle, view, type Pick } from "../shared/picker";
import { openExternal } from "./web";

const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };
const label = (n: string) => NAMES[n] ?? n;
const ULTRON_LINE = "The Orchestrator, a catch-all agent that can coordinate efforts to your other Pocket Citizens or be your funnel for everything. One-size-fits-all, a more dialed-in Claude type experience that remembers who you are and what you need.";
const HELP: Record<string, string> = {
  node: "https://nodejs.org/en/download", git: "https://git-scm.com/downloads",
  claude: "https://docs.claude.com/en/docs/claude-code/setup", paseo: "https://paseo.sh",
};

export function SetupScreen({ theme, layout }: PluginScreenProps) {
  const c = theme.colors;
  const s = useMemo(() => ({
    screen: { flex: 1, backgroundColor: c.surface0 },
    body: { padding: layout.compact ? 16 : 28, gap: 14, maxWidth: 680 },
    h1: { color: c.foreground, fontSize: layout.compact ? 22 : 26, fontWeight: "600" as const },
    h2: { color: c.foreground, fontSize: 17, fontWeight: "600" as const, marginTop: 8 },
    p: { color: c.foreground, fontSize: 15, lineHeight: 22 },
    muted: { color: c.foregroundMuted, fontSize: 14, lineHeight: 20 },
    card: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, gap: 6 },
    picked: { borderColor: c.accent, borderWidth: 2 },
    locked: { opacity: 0.6 },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, flexWrap: "wrap" as const },
    button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: c.accent, alignSelf: "flex-start" as const },
    buttonText: { color: c.accentForeground, fontSize: 15, fontWeight: "600" as const },
    quiet: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    quietText: { color: c.foreground, fontSize: 14 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, color: c.foreground, fontSize: 16 },
    bad: { color: c.statusDanger ?? c.foreground, fontSize: 14 },
    good: { color: c.statusSuccess ?? c.foreground, fontSize: 14 },
  }), [c, layout.compact]);

  const readStatus = useRpc(status);
  const st = useQuery({ queryKey: ["setup.status"], queryFn: () => readStatus({}) });
  const doConnect = useMutation({ mutationFn: useRpc(connectRpc), onSuccess: () => st.refetch() });
  const doInstall = useMutation({ mutationFn: useRpc(installRpc), onSuccess: () => st.refetch() });
  const doFinish = useMutation({ mutationFn: useRpc(finishRpc), onSuccess: () => st.refetch() });
  const [code, setCode] = useState("");
  const [pick, setPick] = useState<Pick>(emptyPick());
  const [accounts, setAccounts] = useState<Record<string, string>>({});

  const d = st.data;
  if (!d) return <View style={s.screen}><View style={s.body}><Text style={s.muted}>{st.isError ? `Setup could not read this computer: ${String(st.error)}` : "Looking at this computer…"}</Text></View></View>;
  const v = view(pick);
  const offered = d.packs.filter((p) => (PACKS as readonly string[]).includes(p.name));
  const ultronPack = d.packs.find((p) => p.name === "Ultron");
  const accountOf = (n: string) => accounts[n] ?? d.accounts[0] ?? "claude";
  const toolsOk = d.tools.every((t) => t.state === "ok");
  const installed = doInstall.data?.ok === true;

  return (
    <ScrollView style={s.screen}><View style={s.body}>
      <Text style={s.h1}>Set up your Agentic Pockets</Text>
      <Text style={s.muted}>A few steps. Nothing on this computer is deleted, and anything you add can be removed again later.</Text>

      <Text style={s.h2}>1. Your tools</Text>
      {d.tools.map((t) => (
        <View key={t.name} style={s.row}>
          <Text style={t.state === "ok" ? s.good : s.bad}>{t.state === "ok" ? "Ready" : t.state === "old" ? "Too old" : "Missing"}</Text>
          <Text style={s.p}>{t.name}{t.have ? ` ${t.have}` : ""}</Text>
          <Text style={s.muted}>{t.state === "ok" ? t.why : `needs ${t.need} or newer: ${t.why}`}</Text>
          {t.state !== "ok" && <Pressable accessibilityRole="link" style={s.quiet} onPress={() => openExternal(HELP[t.name] ?? "https://paseo.sh")}><Text style={s.quietText}>How to get it</Text></Pressable>}
        </View>
      ))}
      {!toolsOk && <Pressable accessibilityRole="button" style={s.quiet} onPress={() => st.refetch()}><Text style={s.quietText}>Check again</Text></Pressable>}

      <Text style={s.h2}>2. Your invite</Text>
      {d.connected ? <Text style={s.good}>Your house is connected.</Text> : (
        <View style={{ gap: 8 }}>
          <Text style={s.muted}>Paste the code from your invite page.</Text>
          <TextInput accessibilityLabel="Invite code" style={s.input} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="Invite code" placeholderTextColor={c.foregroundMuted} />
          <Pressable accessibilityRole="button" style={[s.button, (!toolsOk || code.trim().length < 8 || doConnect.isPending) && s.locked]} disabled={!toolsOk || code.trim().length < 8 || doConnect.isPending} onPress={() => doConnect.mutate({ code: code.trim() })}>
            <Text style={s.buttonText}>{doConnect.isPending ? "Connecting…" : "Connect my house"}</Text>
          </Pressable>
          {!toolsOk && <Text style={s.muted}>First get the tools above, then connect.</Text>}
          {doConnect.data && !doConnect.data.ok && <Text style={s.bad}>{doConnect.data.message}</Text>}
        </View>
      )}

      {d.connected && !installed && <>
        <Text style={s.h2}>3. Who would you like to start with?</Text>
        <Text style={s.muted}>Tick one to start simple. You can add more at any time.</Text>
        {offered.map((p) => {
          const on = pick.packs.includes(p.name);
          return (
            <Pressable key={p.name} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[s.card, on && s.picked]} onPress={() => setPick(toggle(pick, p.name))}>
              <Text style={s.p}>{on ? "☑" : "☐"}  {label(p.name)}</Text>
              <Text style={s.muted}>{p.hello.trim() || "A hello page is coming soon."}</Text>
              {on && d.accounts.length > 1 && (
                <View style={s.row}>{d.accounts.map((a) => (
                  <Pressable key={a} accessibilityRole="radio" accessibilityState={{ selected: accountOf(p.name) === a }} style={[s.quiet, accountOf(p.name) === a && s.picked]} onPress={() => setAccounts({ ...accounts, [p.name]: a })}>
                    <Text style={s.quietText}>{a}</Text>
                  </Pressable>))}</View>
              )}
            </Pressable>
          );
        })}
        {ultronPack && (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: v.ultron !== "free-off", disabled: v.ultron === "locked-on" }} style={[s.card, v.ultron !== "free-off" && s.picked, v.ultron === "locked-on" && s.locked]} onPress={() => setPick(toggle(pick, "Ultron"))}>
            <Text style={s.p}>{v.ultron !== "free-off" ? "☑" : "☐"}  Ultron{v.ultron === "locked-on" ? " (comes with two or more)" : ""}</Text>
            <Text style={s.muted}>{ultronPack.hello.trim() || ULTRON_LINE}</Text>
          </Pressable>
        )}

        {d.extras.length > 0 && <>
          <Text style={s.h2}>4. Extras already on this computer</Text>
          <Text style={s.muted}>These Claude Code extras reach every project on this computer, including your new house. They stay exactly as they are. If one gets in the way, ask your citizen about it.</Text>
          {d.extras.map((e) => <Text key={`${e.kind}:${e.name}`} style={s.muted}>• {e.kind}: {e.name}</Text>)}
        </>}

        <Pressable accessibilityRole="button" style={[s.button, (!v.citizens.length || doInstall.isPending) && s.locked]} disabled={!v.citizens.length || doInstall.isPending}
          onPress={() => doInstall.mutate({ citizens: v.citizens, accounts: Object.fromEntries(v.citizens.map((n) => [n, accountOf(n)])) })}>
          <Text style={s.buttonText}>{doInstall.isPending ? "Setting up…" : v.citizens.length ? `Start with ${v.citizens.map(label).join(", ")}` : "Pick someone to start with"}</Text>
        </Pressable>
        {doInstall.data && !doInstall.data.ok && <Text style={s.bad}>{doInstall.data.message}</Text>}
      </>}

      {installed && !d.setupDone && <>
        <Text style={s.h2}>Your house is ready</Text>
        {doInstall.data?.steps.map((x) => <Text key={x} style={s.muted}>✓ {x}</Text>)}
        <Text style={s.p}>{label(doInstall.data?.firstDesk?.citizen ?? "")} has said hello in their workspace. Open it from the sidebar on the left.</Text>
        <Pressable accessibilityRole="button" style={s.button} onPress={() => doFinish.mutate({})}><Text style={s.buttonText}>Finish setup</Text></Pressable>
      </>}
      {d.setupDone && <Text style={s.good}>Setup is finished. Your citizens live in the sidebar. Go to them through their workspace any time.</Text>}
    </View></ScrollView>
  );
}
