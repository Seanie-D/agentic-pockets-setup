// A citizen's hello page inside its card on "Who would you like to start with?": headings, paragraphs and list items,
// drawn, not raw (Friday's Mac walk, 2026-10-13; the words are read by shared/hello.ts).
import { Text, View } from "react-native";
import { helloBlocks } from "../shared/hello";

type S = Record<"p" | "muted", object>;

export function Hello({ s, md, fallback }: { s: S; md: string; fallback: string }) {
  const blocks = helloBlocks(md);
  if (!blocks.length) return <Text style={s.muted}>{fallback}</Text>;
  return (
    <View style={{ gap: 4 }}>
      {blocks.map((b, i) => (
        <Text key={i} style={b.kind === "heading" ? [s.p, { fontWeight: "600" }] : s.muted}>
          {b.kind === "item" ? "•  " : ""}
          {b.spans.map((x, j) => <Text key={j} style={[x.bold && { fontWeight: "600" }, x.italic && { fontStyle: "italic" }]}>{x.text}</Text>)}
        </Text>
      ))}
    </View>
  );
}
