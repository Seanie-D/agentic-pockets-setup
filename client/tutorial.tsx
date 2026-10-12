// The tutorial (ticket 009): the house's checklist, ticked by the citizens as they explain each item, and the reward at
// 100 %. Its look is still being decided with the owner (Q3); this is the frame it hangs on.
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { Image, Text, View } from "react-native";
import { tutorialReadRpc } from "../shared/contracts";

type S = Record<"h1" | "p" | "muted" | "good", object>;
const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };

export function TutorialView({ s }: { s: S }) {
  const read = useRpc(tutorialReadRpc);
  const q = useQuery({ queryKey: ["setup.tutorial.read"], queryFn: () => read({}), refetchInterval: 30_000 });
  const t = q.data;
  if (!t) return <Text style={s.muted}>{q.isError ? `The tutorial could not be read: ${String(q.error)}` : "Reading the tutorial…"}</Text>;
  if (!t.items.length) return <Text style={s.muted}>The tutorial's checklist arrives with your house.</Text>;
  const done = t.items.filter((i) => i.done).length;
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h1}>Tutorial · {t.percent} %</Text>
      <Text style={s.muted}>{done} of {t.items.length} explained. Ask any citizen about an item; it is ticked when they explain it.</Text>
      {t.items.map((i) => (
        <View key={i.id} style={{ gap: 2 }}>
          <Text style={i.done ? s.good : s.p}>{i.done ? "✓" : "○"}  {i.title}</Text>
          <Text style={s.muted}>{i.body}{i.done ? `  · explained by ${NAMES[i.done.by] ?? i.done.by}` : ""}</Text>
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
