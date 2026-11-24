// "What to ask" (Andrew's idea, 2026-11-23; the owner's cards 2026-11-23 3:02 PM and 2026-11-24 1:57, 2:22 and 3:17 PM CST):
// each citizen the house has, with its own example questions and "Try it" on each; below, "Citizens you can add", with
// their questions and an Add button. "Try it" puts the question in that citizen's message box and sends nothing.
import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import * as PluginClient from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { tryItRpc, whatToAskRpc } from "../shared/contracts";
import type { AskCitizen } from "../shared/what-to-ask";

type S = Record<"h1" | "h2" | "p" | "muted" | "good" | "quiet" | "quietText" | "button" | "buttonText", object>;
type Composer = { setPrompt(text: string): void; focus(): Promise<void> };
// The app gives plugins the message boxes from Paseo 0.16 on; this plugin's own kit is older, so it is read here, and an
// app without it opens the chat and shows the question to type.
const useComposers = (PluginClient as unknown as { useComposers?: (sel: { agentId: string }) => readonly Composer[] }).useComposers;
const FILL_WAIT_MS = 8_000;
// The house plugin opens one of its views for another plugin (its client/visitor.ts bridge); "citizens" holds Add.
const openHouseView = () => (globalThis as { __agenticPocketsOpenView?: (id: string) => boolean }).__agenticPocketsOpenView?.("citizens") === true;

// Waits for the chat's message box (a desk just opened takes a moment), fills it, and brings the chat up.
function Fill({ agentId, text, use, done }: { agentId: string; text: string; use: NonNullable<typeof useComposers>; done: (filled: boolean) => void }) {
  const boxes = use({ agentId });
  useEffect(() => {
    const box = boxes[0];
    if (!box) return;
    box.setPrompt(text);
    void box.focus().then(() => done(true), () => done(false));
  }, [boxes, text]);
  useEffect(() => { const t = setTimeout(() => done(false), FILL_WAIT_MS); return () => clearTimeout(t); }, []);
  return null;
}

function Face({ c, theme }: { c: AskCitizen; theme: PluginTheme }) {
  const box = { width: 44, height: 44, borderRadius: 10 };
  return c.face ? <Image accessibilityIgnoresInvertColors source={{ uri: c.face }} style={box} />
    : <View style={[box, { alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2 }]}><Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>{c.name.slice(0, 1)}</Text></View>;
}

export function WhatToAskView({ s, theme, navigation }: { s: S; theme: PluginTheme; navigation?: PluginScreenProps["navigation"] }) {
  const read = useRpc(whatToAskRpc);
  const q = useQuery({ queryKey: ["setup.help.asks"], queryFn: () => read({}), refetchInterval: 60_000 });
  const tryRpc = useRpc(tryItRpc) as (i: { pocket: string }) => Promise<{ ok: boolean; agentId?: string; message?: string }>;
  const [said, setSaid] = useState<{ pocket: string; text: string; ok: boolean } | null>(null);
  const [fill, setFill] = useState<{ agentId: string; text: string; name: string } | null>(null);
  const go = useMutation({
    mutationFn: ({ c, text }: { c: AskCitizen; text: string }) => tryRpc({ pocket: c.pocket }).then((r) => ({ r, c, text })),
    onSuccess: ({ r, c, text }) => {
      if (!r.ok || !r.agentId) return setSaid({ pocket: c.pocket, text: r.message ?? `${c.name}'s chat could not be opened.`, ok: false });
      if (useComposers) return setFill({ agentId: r.agentId, text, name: c.name });
      navigation?.openAgent({ agentId: r.agentId });
      setSaid({ pocket: c.pocket, text: `${c.name}'s chat is open. Type: "${text}"`, ok: true });
    },
  });
  const filled = (f: { agentId: string; text: string; name: string }, ok: boolean, pocket: string) => {
    setFill(null);
    if (ok) return setSaid({ pocket, text: `The question is in ${f.name}'s message box. Change it if you like, then send it.`, ok: true });
    navigation?.openAgent({ agentId: f.agentId });
    setSaid({ pocket, text: `${f.name}'s chat is open. Type: "${f.text}"`, ok: true });
  };
  const c = theme.colors;
  if (!q.data) return <Text style={s.muted}>{q.isError ? `The citizens could not be read: ${String(q.error)}` : "Reading your citizens…"}</Text>;
  const card = (x: AskCitizen, add: boolean) => (
    <View key={x.pocket} style={{ gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Face c={x} theme={theme} />
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>{x.name}</Text>
          {x.title ? <Text style={s.muted}>{x.title}</Text> : null}
        </View>
        {add && <Pressable accessibilityRole="button" style={s.button} onPress={() => { if (!openHouseView()) setSaid({ pocket: x.pocket, text: `Open Agentic Pockets, then its Citizens tab, to add ${x.name}.`, ok: true }); }}>
          <Text style={s.buttonText}>Add</Text></Pressable>}
      </View>
      {!x.asks.length && <Text style={s.muted}>No examples yet. Ask {x.name} what it can do for you.</Text>}
      {x.asks.map((a) => (
        <View key={a} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Text style={[s.p, { flex: 1 }]}>"{a}"</Text>
          {!add && <Pressable accessibilityRole="button" accessibilityLabel={`Try it: ${a}`} style={s.quiet} disabled={go.isPending || !!fill}
            onPress={() => { setSaid(null); go.mutate({ c: x, text: a }); }}><Text style={s.quietText}>Try it</Text></Pressable>}
        </View>
      ))}
      {said?.pocket === x.pocket && <Text style={said.ok ? s.good : s.muted}>{said.text}</Text>}
      {fill && useComposers && go.data?.c.pocket === x.pocket && <Fill agentId={fill.agentId} text={fill.text} use={useComposers} done={(ok) => filled(fill, ok, x.pocket)} />}
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.muted}>Not sure what to ask? Here are some ideas for each of your citizens. Press Try it, and the question goes in that citizen's message box for you to send.</Text>
      {q.data.inHouse.map((x) => card(x, false))}
      {q.data.canAdd.length > 0 && <>
        <Text style={[s.h2, { marginTop: 8 }]}>Citizens you can add</Text>
        <Text style={s.muted}>What you could ask them, once they are in your house.</Text>
        {q.data.canAdd.map((x) => card(x, true))}
      </>}
    </View>
  );
}
