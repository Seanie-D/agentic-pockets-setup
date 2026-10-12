// The tutorial (ticket 009): the house's checklist, ticked by the citizens as they explain each item, and the reward at
// 100 %. Its look is still being decided with the owner (Q3); this is the frame it hangs on.
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image, Pressable, Text, View } from "react-native";
import { tutorialDiscussRpc, tutorialReadRpc } from "../shared/contracts";

type S = Record<"h1" | "p" | "muted" | "good" | "quiet" | "quietText", object>;
const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };

export function TutorialView({ s, navigation }: { s: S; navigation?: PluginScreenProps["navigation"] }) {
  const read = useRpc(tutorialReadRpc);
  const q = useQuery({ queryKey: ["setup.tutorial.read"], queryFn: () => read({}), refetchInterval: 30_000 });
  // "Discuss this page" / "Ask <lead> about this": the lead citizen's desk gets the item, and opens here when the app can.
  type Discussed = { ok: boolean; agentId?: string; citizen?: string; message: string };
  const discussRpc = useRpc(tutorialDiscussRpc) as (i: { itemId: string }) => Promise<Discussed>;
  const discuss = useMutation({ mutationFn: discussRpc, onSuccess: (r: Discussed) => { if (r.ok && r.agentId) navigation?.openAgent({ agentId: r.agentId }); } });
  const t = q.data;
  if (!t) return <Text style={s.muted}>{q.isError ? `The tutorial could not be read: ${String(q.error)}` : "Reading the tutorial…"}</Text>;
  if (!t.items.length) return <Text style={s.muted}>The tutorial's checklist arrives with your house.</Text>;
  const done = t.items.filter((i) => i.done).length;
  const lead = t.lead ? NAMES[t.lead] ?? t.lead : null;
  const ask = t.complete && lead ? `Ask ${lead} about this` : "Discuss this page";
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h1}>{t.complete ? "Agentic Pockets Help" : `Tutorial · ${t.percent} %`}</Text>
      <Text style={s.muted}>{t.complete
        ? "Everything is explained. Re-read any page below, or ask about it again."
        : `${done} of ${t.items.length} explained. Ask any citizen about an item; it is ticked when they explain it.`}</Text>
      <Text style={s.p}>Any time your brain glazes over and what you read does not make sense, type /wait-what in any chat.</Text>
      {discuss.data && <Text style={discuss.data.ok ? s.good : s.muted}>{discuss.data.message}</Text>}
      {t.items.map((i) => (
        <View key={i.id} style={{ gap: 2 }}>
          <Text style={i.done ? s.good : s.p}>{i.done ? "✓" : "○"}  {i.title}</Text>
          <Text style={s.muted}>{i.body}{i.done ? `  · explained by ${NAMES[i.done.by] ?? i.done.by}` : ""}</Text>
          {lead && <Pressable accessibilityRole="button" style={[s.quiet, { alignSelf: "flex-start" }]} disabled={discuss.isPending} onPress={() => discuss.mutate({ itemId: i.id })}><Text style={s.quietText}>{ask}</Text></Pressable>}
        </View>
      ))}
      {t.reward && (
        <View style={{ gap: 8 }}>
          {t.reward.image ? <Image source={{ uri: t.reward.image }} style={{ width: 320, height: 240, borderRadius: 8 }} resizeMode="contain" /> : null}
          <Text style={s.p}>{t.reward.line ?? `${NAMES[t.reward.citizen] ?? t.reward.citizen} is making something for you.`}</Text>
        </View>
      )}
    </View>
  );
}
