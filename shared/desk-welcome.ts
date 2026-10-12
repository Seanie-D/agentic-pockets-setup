// The welcome in the user's first desk chat (the owner's ask, 2026-10-12, via Ultron): a row the setup plugin puts at the
// top of that chat, once, right after the first desk opens. The text is Ultron's draft, approved by the owner (2026-10-12).
import { z } from "zod";

export const DESK_WELCOME_ON = true;
export const WELCOME_KIND = "desk-welcome";
export const welcomeRowSchema = z.object({ citizen: z.string() });
const NAMES: Record<string, string> = { MissMinutes: "Miss Minutes" };
export const nameOf = (citizen: string) => NAMES[citizen] ?? citizen;
export const welcomeTitle = "Welcome to your first citizen chat!";
export const welcomeBody = (citizen: string) => {
  const n = nameOf(citizen);
  return `This is ${n}'s "desk": the one chat where ${n} is always available for you. Talk to ${n} here like a coworker at their desk: ask questions, plan, hand over work. ${n} remembers what you say here, so next time you can carry on where you stopped.`;
};
