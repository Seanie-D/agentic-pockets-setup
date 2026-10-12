// How the citizens run (ticket 004 Q11): two choices, the safe one first and the default; always on carries the owner's
// warning. Once a citizen is up, "Ask about this" hands the question to the lead's desk and opens it.
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { askRpc } from "../shared/contracts";
import { MODES, type Mode } from "../shared/mode";

type S = Record<"card" | "picked" | "p" | "muted" | "bad" | "good" | "quiet" | "quietText" | "row", object>;
type Asked = { ok: boolean; agentId?: string; citizen?: string; message: string };

export function ModeChoice({ s, mode, onPick, busy, askable, navigation }: {
  s: S; mode: Mode; onPick: (m: Mode) => void; busy?: boolean; askable: boolean; navigation?: PluginScreenProps["navigation"];
}) {
  const askCall = useRpc(askRpc) as (i: { topic: string }) => Promise<Asked>;
  const ask = useMutation({ mutationFn: askCall, onSuccess: (r: Asked) => { if (r.ok && r.agentId) navigation?.openAgent({ agentId: r.agentId }); } });
  return (
    <View style={{ gap: 8 }}>
      {(Object.keys(MODES) as Mode[]).map((m) => (
        <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: mode === m, disabled: busy }} disabled={busy}
          style={[s.card, mode === m && s.picked]} onPress={() => onPick(m)}>
          <Text style={s.p}>{mode === m ? "◉" : "○"}  {MODES[m].label}{m === "on-demand" ? " (recommended)" : ""}</Text>
          <Text style={s.muted}>{MODES[m].text}</Text>
          {MODES[m].warning && <Text style={s.bad}>{MODES[m].warning}</Text>}
        </Pressable>
      ))}
      {askable && <View style={s.row}>
        <Pressable accessibilityRole="button" style={s.quiet} disabled={ask.isPending} onPress={() => ask.mutate({ topic: "mode" })}>
          <Text style={s.quietText}>Ask about this</Text>
        </Pressable>
        {ask.data && <Text style={ask.data.ok ? s.good : s.muted}>{ask.data.message}</Text>}
        {ask.isError && <Text style={s.bad}>{String(ask.error)}</Text>}
      </View>}
    </View>
  );
}
