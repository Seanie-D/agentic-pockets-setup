import { useRpc } from "@getpaseo/plugin/client";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { houseStatusRpc, repairRpc } from "../shared/contracts";

// Item 4b of the next update: below the steps, once setup has ended, the setup status (house-check's seven lines, each a
// tick or what is missing) and the Repair my setup button, which sends Jarvis's desk the house-check request and opens it.
type S = { h2: object; p: object; muted: object; good: object; bad: object; card: object; row: object; button: object; buttonText: object; quiet: object; quietText: object; locked: object };
export function HouseStatus({ s, navigation }: { s: S; navigation: PluginScreenProps["navigation"] }) {
  const read = useRpc(houseStatusRpc);
  const q = useQuery({ queryKey: ["setup.house.status"], queryFn: () => read({}), refetchOnMount: "always" });
  const ask = useRpc(repairRpc);
  const fix = useMutation({ mutationFn: () => ask({}), onSuccess: (r) => { if (r.ok && r.agentId) navigation?.openAgent({ agentId: r.agentId }); } });
  const lines = q.data?.lines ?? [];
  const missing = lines.filter((l) => !l.ok).length;
  return (
    <View style={[s.card, { gap: 10 }]}>
      <Text style={s.h2}>Setup status</Text>
      {q.isPending ? <Text style={s.muted}>Checking each step of setup…</Text> : null}
      {q.isError ? <Text style={s.bad}>The check could not run: {String(q.error)}</Text> : null}
      {lines.map((l) => (
        <View key={l.what} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={l.unknown ? s.muted : l.ok ? s.good : s.bad}>{l.unknown ? "?" : l.ok ? "✓" : "✗"}</Text>
          <Text style={[s.p, { flexShrink: 1 }]}><Text style={{ fontWeight: "600" }}>{l.what}.</Text> {l.detail}</Text>
        </View>
      ))}
      {q.data ? <Text style={s.muted}>{missing ? `${missing} step${missing === 1 ? "" : "s"} did not finish. Your citizen can repair ${missing === 1 ? "it" : "them"} with you.` : "Every step of setup finished."}</Text> : null}
      <View style={s.row}>
        <Pressable accessibilityRole="button" style={[s.button, fix.isPending && s.locked]} disabled={fix.isPending} onPress={() => fix.mutate()}>
          <Text style={s.buttonText}>{fix.isPending ? "Asking…" : "Repair my setup"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.quiet} onPress={() => q.refetch()}><Text style={s.quietText}>Check again</Text></Pressable>
      </View>
      {fix.data ? <Text style={fix.data.ok ? s.muted : s.bad}>{fix.data.message}</Text> : null}
      {fix.isError ? <Text style={s.bad}>{String(fix.error)}</Text> : null}
    </View>
  );
}
