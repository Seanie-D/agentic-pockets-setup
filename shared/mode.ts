// How the citizens run (ticket 004 Q11, the owner, 2026-10-08: "On-demand is the default; always-on is a choice", and a
// plain warning on always-on). The choice is each citizen's contract tier, the one source the house plugin and the boot
// read: on demand is `on-call`, always on is `standing`.
export type Mode = "on-demand" | "always-on";
export const DEFAULT_MODE: Mode = "on-demand";
export const tierFor = (m: Mode): "on-call" | "standing" => (m === "always-on" ? "standing" : "on-call");

export const MODES: Record<Mode, { label: string; text: string; warning?: string }> = {
  "on-demand": {
    label: "On demand",
    text: "A citizen's chat opens when you, its mail, or another citizen calls it. Each night, open chats close. This is best for a laptop.",
  },
  "always-on": {
    label: "Always on",
    text: "Each citizen keeps one chat open all the time, and gets a fresh one each night. Use this only on a computer that stays on all day.",
    warning: "If you're confused by what this means, do not click it.",
  },
};

// A contract with its frontmatter `tier:` set: the line replaced, or added at the end of the frontmatter, or a frontmatter
// added when the file has none. The file's own line endings are kept.
export function withTier(md: string, tier: "on-call" | "standing"): string {
  const nl = md.includes("\r\n") ? "\r\n" : "\n";
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(md);
  if (!fm) return `---${nl}tier: ${tier}${nl}---${nl}${md}`;
  const body = /^tier:.*$/m.test(fm[1]) ? fm[1].replace(/^tier:.*$/m, `tier: ${tier}`) : `${fm[1]}${nl}tier: ${tier}`;
  return `---${nl}${body}${nl}---${fm[2]}${md.slice(fm[0].length)}`;
}
