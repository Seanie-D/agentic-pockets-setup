// Agentic Pockets Help (ticket 009 Q1c, the owner 2026-10-12 14:44 CDT): once the tutorial is complete, the tutorial view
// also holds the /wait-what reminder, the house's glossary, and "Ask Ultron about this" (the lead citizen, by name).
import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { helpAskRpc, helpGlossaryRpc } from "../shared/contracts";
import { PICTURE_TIP } from "../shared/beautiful-chat";

type S = Record<"h2" | "p" | "muted" | "good" | "quiet" | "quietText", object>;
type Asked = { ok: boolean; agentId?: string; citizen?: string; message: string };
export type Subject = { kind: "term" | "page"; id: string };

// "Ask <lead> about this": the lead citizen's desk gets the word or the page, and the screen opens that desk.
export function useAsk(navigation?: PluginScreenProps["navigation"]) {
  const ask = useRpc(helpAskRpc) as (i: Subject) => Promise<Asked>;
  return useMutation({ mutationFn: ask, onSuccess: (r: Asked) => { if (r.ok && r.agentId) navigation?.openAgent({ agentId: r.agentId }); } });
}

// The owner's push for /wait-what, ticket 009 (2026-10-08), near his own words.
export const WAIT_WHAT = "Any time your brain glazes over, and what you read does not make sense, type /wait-what in any chat. "
  + "You can add words to it: \"/wait-what tell me what you need me to do\", or \"/wait-what the part with the issue with the transcript\", and so on.";

export function Help({ s, theme, lead, navigation }: { s: S; theme: PluginTheme; lead: string | null; navigation?: PluginScreenProps["navigation"] }) {
  const read = useRpc(helpGlossaryRpc);
  const q = useQuery({ queryKey: ["setup.help.glossary"], queryFn: () => read({}) });
  const ask = useAsk(navigation);
  const [find, setFind] = useState("");
  const [cur, setCur] = useState<string | null>(null);
  const c = theme.colors;
  const terms = (q.data?.terms ?? []).filter((t) => !find.trim() || t.word.toLowerCase().includes(find.trim().toLowerCase()));
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.accent }}>
        <Text style={s.h2}>When something does not make sense</Text>
        <Text style={s.p}>{WAIT_WHAT}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={s.h2}>Pictures in your messages</Text>
        <Text style={s.p}>{PICTURE_TIP}</Text>
      </View>
      <Text style={s.h2}>The glossary</Text>
      <Text style={s.muted}>The words your citizens use.{lead ? ` Tap a word to ask ${lead} about it.` : ""}</Text>
      {!q.data ? <Text style={s.muted}>{q.isError ? `The glossary could not be read: ${String(q.error)}` : "Reading the glossary…"}</Text>
        : !q.data.terms.length ? <Text style={s.muted}>This house has no glossary yet.</Text>
        : <>
          <TextInput accessibilityLabel="Find a word" value={find} onChangeText={setFind} autoCapitalize="none" autoCorrect={false}
            placeholder="Find a word" placeholderTextColor={c.foregroundMuted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, color: c.foreground, fontSize: 15 }} />
          {!terms.length && <Text style={s.muted}>No word matches "{find.trim()}".</Text>}
          {terms.map((t) => (
            <View key={t.word} style={{ gap: 4, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.word === cur ? c.surface2 : "transparent" }}>
              <Pressable accessibilityRole="button" onPress={() => { setCur(t.word === cur ? null : t.word); ask.reset(); }}>
                <Text style={s.p}><Text style={{ fontWeight: "600" }}>{t.word}</Text>: {t.meaning}</Text>
              </Pressable>
              {t.word === cur && t.not && <Text style={s.muted}>Not the same as: {t.not}</Text>}
              {t.word === cur && lead && <>
                <Pressable accessibilityRole="button" style={[s.quiet, { alignSelf: "flex-start" }]} disabled={ask.isPending}
                  onPress={() => ask.mutate({ kind: "term", id: t.word })}><Text style={s.quietText}>Ask {lead} about this</Text></Pressable>
                {ask.data && <Text style={ask.data.ok ? s.good : s.muted}>{ask.data.message}</Text>}
                {ask.isError && <Text style={s.muted}>The question did not go: {String(ask.error)}</Text>}
              </>}
            </View>
          ))}
        </>}
    </View>
  );
}
