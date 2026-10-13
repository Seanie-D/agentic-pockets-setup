// The tutorial (ticket 009): the house's checklist, ticked by the citizens as they explain each item, and the reward at
// 100 %. The owner's pick is A, the checklist (2026-10-12 15:02 CDT): the list, and one page at a time beside it. A page's
// example is a short made-up chat; the first time the page opens its bubbles appear one by one (the owner, 15:29 CDT).
import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { tutorialDiscussRpc, tutorialReadRpc, tutorialSeenRpc } from "../shared/contracts";
import { DrawingView } from "./drawing";
import { Help, useAsk } from "./help";

type S = Record<"h1" | "h2" | "p" | "muted" | "good" | "quiet" | "quietText", object>;
type Bubble = { from: "you" | "citizen"; text: string };
const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };
const STEP_MS = 900;   // the mock-up's pace: one bubble each 0.9 s

function Example({ example, animate, theme }: { example: Bubble[]; animate: boolean; theme: PluginTheme }) {
  const fades = useRef(example.map(() => new Animated.Value(animate ? 0 : 1))).current;
  useEffect(() => {
    if (!animate) return;
    const run = Animated.stagger(STEP_MS, fades.map((v) => Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true })));
    run.start(); return () => run.stop();
  }, [animate, fades]);
  const c = theme.colors;
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: c.surface0, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Example</Text>
      {example.map((m, k) => (
        <Animated.View key={k} style={{ opacity: fades[k], alignSelf: m.from === "you" ? "flex-end" : "flex-start", maxWidth: "85%",
          transform: [{ translateY: fades[k].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
          <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: m.from === "you" ? c.accent : c.surface2 }}>
            <Text style={{ color: m.from === "you" ? c.accentForeground : c.foreground, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function TutorialView({ s, theme, compact, navigation }: { s: S; theme: PluginTheme; compact: boolean; navigation?: PluginScreenProps["navigation"] }) {
  const read = useRpc(tutorialReadRpc);
  const q = useQuery({ queryKey: ["setup.tutorial.read"], queryFn: () => read({}), refetchInterval: 30_000 });
  // "Discuss this page" / "Ask <lead> about this": the lead citizen's desk gets the item, and opens here when the app can.
  type Discussed = { ok: boolean; agentId?: string; citizen?: string; message: string };
  const discussRpc = useRpc(tutorialDiscussRpc) as (i: { itemId: string }) => Promise<Discussed>;
  const discuss = useMutation({ mutationFn: discussRpc, onSuccess: (r: Discussed) => { if (r.ok && r.agentId) navigation?.openAgent({ agentId: r.agentId }); } });
  const help = useAsk(navigation);   // after 100 %, "Ask <lead> about this" asks without a tick (client/help.tsx)
  const markSeen = useRpc(tutorialSeenRpc);
  const [cur, setCur] = useState<string | null>(null);
  // Whether each page was new when this screen first showed it: the server's list, as it was before this visit.
  const [fresh, setFresh] = useState<Record<string, boolean>>({});
  const t = q.data;
  const items = t?.items ?? [];
  const page = items.find((i) => i.id === cur) ?? items.find((i) => !i.done) ?? items[0];
  useEffect(() => {
    if (!t || !page || page.id in fresh) return;
    setFresh((f) => ({ ...f, [page.id]: !t.seen.includes(page.id) }));
    if (!t.seen.includes(page.id)) void markSeen({ id: page.id }).catch(() => {});
  }, [t, page?.id]);
  if (!t) return <Text style={s.muted}>{q.isError ? `The tutorial could not be read: ${String(q.error)}` : "Reading the tutorial…"}</Text>;
  if (!items.length || !page) return <Text style={s.muted}>The tutorial's checklist arrives with your house.</Text>;
  const done = items.filter((i) => i.done).length;
  const lead = t.lead ? NAMES[t.lead] ?? t.lead : null;
  const ask = t.complete && lead ? `Ask ${lead} about this` : "Discuss this page";
  const c = theme.colors;
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h1}>{t.complete ? "Agentic Pockets Help" : `Tutorial · ${t.percent} %`}</Text>
      <Text style={s.muted}>{t.complete
        ? "Everything is explained. Re-read any page, or ask about it again."
        : `${done} of ${items.length} explained. Ask any citizen about an item; it is ticked when they explain it.`}</Text>
      {/* Ultron's prototype (variant A, the owner's pick): a progress bar under the heading. */}
      {!t.complete && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: t.percent }} style={{ height: 10, borderRadius: 99, backgroundColor: c.surface2, overflow: "hidden" }}>
        <View style={{ width: `${t.percent}%`, height: "100%", backgroundColor: c.statusSuccess }} />
      </View>}
      {!t.complete && <Text style={s.p}>Any time your brain glazes over and what you read does not make sense, type /wait-what in any chat.</Text>}
      {t.reward && (t.reward.drawing
        ? <DrawingView drawing={t.reward.drawing} theme={theme} width={compact ? 300 : 320} />
        : <Text style={s.p}>{NAMES[t.reward.citizen] ?? t.reward.citizen} is making something for you.</Text>)}
      <View style={{ flexDirection: compact ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
        <View style={{ gap: 6, width: compact ? "100%" : 280 }}>
          {items.map((i) => (
            <Pressable key={i.id} accessibilityRole="button" accessibilityState={{ selected: i.id === page.id, checked: !!i.done }} onPress={() => setCur(i.id)}
              style={{ flexDirection: "row", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
                borderColor: i.id === page.id ? c.accent : c.border, backgroundColor: c.surface1 }}>
              <Text style={s.p}>{i.done ? "✅" : i.icon ?? "○"}</Text>
              <Text style={[s.p, { flex: 1 }]}>{i.title}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: compact ? undefined : 1, width: compact ? "100%" : undefined, gap: 10, padding: 20, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1 }}>
          <Text style={s.h2}>{page.icon ? `${page.icon}  ` : ""}{page.title}</Text>
          <Text style={[s.p, { fontSize: 17, lineHeight: 25 }]}>{page.body}</Text>
          {page.lines?.map((l, k) => <Text key={k} style={s.p}>•  {l.text}</Text>)}
          {/* Drawn once fresh is known: drawn before, its bubbles start shown and the fade-in has nothing to show (the walk). */}
          {page.example && page.id in fresh && <Example key={page.id} example={page.example} animate={fresh[page.id] === true} theme={theme} />}
          {page.done && <Text style={s.good}>✓ Explained by {NAMES[page.done.by] ?? page.done.by}</Text>}
          {lead && <Pressable accessibilityRole="button" style={[s.quiet, { alignSelf: "flex-start" }]} disabled={discuss.isPending || help.isPending} onPress={() => t.complete ? help.mutate({ kind: "page", id: page.id }) : discuss.mutate({ itemId: page.id })}><Text style={s.quietText}>{ask}</Text></Pressable>}
          {discuss.data && !t.complete && <Text style={discuss.data.ok ? s.good : s.muted}>{discuss.data.message}</Text>}
          {help.data && t.complete && <Text style={help.data.ok ? s.good : s.muted}>{help.data.message}</Text>}
        </View>
      </View>
      {t.complete && <Help s={s} theme={theme} lead={lead} navigation={navigation} />}
    </View>
  );
}
