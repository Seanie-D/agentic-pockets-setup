// The setup screen (ticket 004 Resolution, steps 2–5): your tools, your invite, who you start with, then your first citizen.
// Plain words, the safe choice first, one step on screen at a time.
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { connectRpc, finishRpc, installRpc, installToolsRpc, modeSetRpc, profileSignInRpc, profileStatusRpc, status, welcomeDismissRpc, welcomeReadRpc } from "../shared/contracts";
import { DEFAULT_MODE, type Mode } from "../shared/mode";
import { ModeChoice } from "./mode";
import { LeftAlone, Welcome } from "./welcome";
import { TutorialView } from "./tutorial";
import { PACKS, emptyPick, toggle, view, type Pick } from "../shared/picker";
import { openExternal } from "./web";

const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };
const label = (n: string) => NAMES[n] ?? n;
const ULTRON_LINE = "The Orchestrator, a catch-all agent that can coordinate efforts to your other Pocket Citizens or be your funnel for everything. One-size-fits-all, a more dialed-in Claude type experience that remembers who you are and what you need.";
const HELP: Record<string, string> = {
  node: "https://nodejs.org/en/download", git: "https://git-scm.com/downloads",
  claude: "https://docs.claude.com/en/docs/claude-code/setup", paseo: "https://paseo.sh",
};

export function SetupScreen({ theme, layout, navigation }: PluginScreenProps) {
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
  const doTools = useMutation({ mutationFn: useRpc(installToolsRpc), onSuccess: () => st.refetch() });
  const doConnect = useMutation({ mutationFn: useRpc(connectRpc), onSuccess: () => st.refetch() });
  const doInstall = useMutation({ mutationFn: useRpc(installRpc), onSuccess: () => st.refetch() });
  const doFinish = useMutation({ mutationFn: useRpc(finishRpc), onSuccess: () => st.refetch() });
  const [code, setCode] = useState("");
  const [userName, setUserName] = useState("");
  const [pick, setPick] = useState<Pick>(emptyPick());
  const [accounts, setAccounts] = useState<Record<string, string>>({});
  const [extrasOff, setExtrasOff] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const doMode = useMutation({ mutationFn: useRpc(modeSetRpc), onSuccess: () => st.refetch() });
  // The clean profile (ticket 004): offered only when the user has Claude hooks of their own; default no.
  const [cleanProfile, setCleanProfile] = useState(false);
  const readProfile = useRpc(profileStatusRpc);
  const profile = useQuery({ queryKey: ["setup.profile.status"], queryFn: () => readProfile({}), enabled: cleanProfile,
    refetchInterval: (q) => (q.state.data?.signedIn ? false : 3_000) });
  const signIn = useMutation({ mutationFn: useRpc(profileSignInRpc) });
  const needsSignIn = cleanProfile && profile.data?.signedIn !== true;

  // The welcome comes first on a computer that has not seen it (ticket 009); either button marks it seen for good.
  const readWelcome = useRpc(welcomeReadRpc);
  const welcome = useQuery({ queryKey: ["setup.welcome.read"], queryFn: () => readWelcome({}) });
  const dismiss = useMutation({ mutationFn: useRpc(welcomeDismissRpc), onSuccess: () => welcome.refetch() });
  const [left, setLeft] = useState(false);
  if (left) return <LeftAlone s={s} />;
  if (welcome.data?.seen === false) return <Welcome s={s} onGo={() => dismiss.mutate({})} onLeave={() => { setLeft(true); dismiss.mutate({}); }} />;

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
          {t.state !== "ok" && doTools.data && <Pressable accessibilityRole="link" style={s.quiet} onPress={() => openExternal(HELP[t.name] ?? "https://paseo.sh")}><Text style={s.quietText}>How to get it</Text></Pressable>}
        </View>
      ))}
      {doTools.data?.tools.filter((t) => t.message).map((t) => <Text key={`m-${t.name}`} style={s.bad}>{t.name}: {t.message}</Text>)}
      {!toolsOk && <View style={s.row}>
        <Pressable accessibilityRole="button" style={[s.button, doTools.isPending && s.locked]} disabled={doTools.isPending} onPress={() => doTools.mutate({})}>
          <Text style={s.buttonText}>{doTools.isPending ? "Installing… this can take a few minutes" : "Install or update"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.quiet} onPress={() => st.refetch()}><Text style={s.quietText}>Check again</Text></Pressable>
      </View>}
      {!toolsOk && !doTools.data && <Text style={s.muted}>Tools you already have stay as they are. An old one is updated, a missing one is installed. Your other projects are not touched.</Text>}

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
        <Text style={s.h2}>3. Your name</Text>
        <Text style={s.muted}>Your citizens call you by this name, and the house rules use it.</Text>
        <TextInput accessibilityLabel="Your name" style={s.input} value={userName} onChangeText={setUserName} autoCorrect={false} placeholder="Your first name" placeholderTextColor={c.foregroundMuted} />

        <Text style={s.h2}>4. Who would you like to start with?</Text>
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
        {d.packs.some((p) => p.name === "Jarvis") && <Text style={s.muted}>Jarvis, the house manager, comes with every house.</Text>}

        <Text style={s.h2}>5. How your citizens run</Text>
        <Text style={s.muted}>You can change this after setup. Once your first citizen is up, you can ask it about this choice.</Text>
        <ModeChoice s={s} mode={mode} onPick={setMode} askable={false} />

        {d.extras.length > 0 && <>
          <Text style={s.h2}>6. Extras already on this computer</Text>
          <Text style={s.muted}>These extras reach every project on this computer, your new house too. Keep them, or switch one off for your house only. Nothing is deleted, and your other projects keep them.</Text>
          {d.extras.map((e) => {
            const off = extrasOff.includes(e.id);
            return (
              <View key={e.id} style={s.row}>
                <Text style={s.p}>{e.kind}: {e.name}</Text>
                {e.switchable ? (
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: !off }} style={[s.quiet, off && s.picked]} onPress={() => setExtrasOff(off ? extrasOff.filter((x) => x !== e.id) : [...extrasOff, e.id])}>
                    <Text style={s.quietText}>{off ? "Off for my house" : "Keep"}</Text>
                  </Pressable>
                ) : <Text style={s.muted}>{e.kind === "paseo" ? "Set in Paseo for every project" : "Cannot be switched off for one project"}</Text>}
              </View>
            );
          })}
        </>}

        {d.extras.some((e) => e.kind === "hook") && <>
          <Text style={s.p}>You have Claude hooks of your own. A hook runs in every project, and it cannot be switched off for one. Your house can use its own Claude profile, without your hooks. You sign in to Claude once more for it.</Text>
          <View style={s.row}>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: cleanProfile }} style={[s.quiet, cleanProfile && s.picked]} onPress={() => setCleanProfile(!cleanProfile)}>
              <Text style={s.quietText}>{cleanProfile ? "Clean profile for my house" : "Keep my hooks in my house"}</Text>
            </Pressable>
          </View>
          {cleanProfile && (profile.data?.signedIn
            ? <Text style={s.good}>Signed in. Your house uses its own Claude profile.</Text>
            : <>
              <Pressable accessibilityRole="button" style={[s.quiet, { alignSelf: "flex-start" }]} disabled={signIn.isPending} onPress={() => signIn.mutate({})}><Text style={s.quietText}>Sign in to Claude for your house</Text></Pressable>
              {signIn.data && <Text style={signIn.data.started ? s.muted : s.bad}>{signIn.data.message}</Text>}
            </>)}
        </>}

        <Pressable accessibilityRole="button" style={[s.button, (!v.citizens.length || !userName.trim() || doInstall.isPending || needsSignIn) && s.locked]} disabled={!v.citizens.length || !userName.trim() || doInstall.isPending || needsSignIn}
          onPress={() => doInstall.mutate({ userName: userName.trim(), citizens: v.citizens, accounts: Object.fromEntries(v.citizens.map((n) => [n, accountOf(n)])), extrasOff, cleanProfile, mode })}>
          <Text style={s.buttonText}>{doInstall.isPending ? "Setting up…" : v.citizens.length ? `Start with ${v.citizens.map(label).join(", ")}` : "Pick someone to start with"}</Text>
        </Pressable>
        {doInstall.data && !doInstall.data.ok && <Text style={s.bad}>{doInstall.data.message}</Text>}
      </>}

      {installed && !d.setupDone && <>
        <Text style={s.h2}>Your house is ready</Text>
        {doInstall.data?.steps.map((x) => <Text key={x} style={s.muted}>✓ {x}</Text>)}
        <Text style={s.p}>{label(doInstall.data?.firstDesk?.citizen ?? "")} has said hello in their workspace. Open it from the sidebar on the left.</Text>
        <Text style={s.h2}>How your citizens run</Text>
        <ModeChoice s={s} mode={d.mode} onPick={(m) => doMode.mutate({ mode: m })} busy={doMode.isPending} askable navigation={navigation} />
        <Pressable accessibilityRole="button" style={s.button} onPress={() => doFinish.mutate({})}><Text style={s.buttonText}>Finish setup</Text></Pressable>
      </>}
      {d.setupDone && <Text style={s.good}>Setup is finished. Your citizens live in the sidebar. Go to them through their workspace any time.</Text>}
      {d.setupDone && <>
        <Text style={s.h2}>How your citizens run</Text>
        <ModeChoice s={s} mode={d.mode} onPick={(m) => doMode.mutate({ mode: m })} busy={doMode.isPending} askable navigation={navigation} />
      </>}
      {d.setupDone && <TutorialView s={s} theme={theme} compact={layout.compact} navigation={navigation} />}
    </View></ScrollView>
  );
}
