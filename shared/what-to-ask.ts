// "What to ask": each offered citizen's own example questions (Andrew's idea, 2026-11-23; the wording the owner saw in the
// pictures, his cards 2026-11-24 1:57 PM and 2:22 PM CST). In the order the tab shows them. A citizen's pack is its own
// folder, so the lists live here, with the tab that shows them. No Node imports: the client reads this file too.

export interface Asks { pocket: string; name: string; title: string; asks: readonly string[] }

export const ASKS: readonly Asks[] = [
  { pocket: "Ultron", name: "Ultron", title: "Orchestrator", asks: ["Which citizen should take my tax paperwork?", "What did every citizen do yesterday?", "I have a big idea. Help me plan it.", "Should this job get its own citizen?"] },
  { pocket: "MissMinutes", name: "Miss Minutes", title: "Keeps your time and your tasks", asks: ["What is waiting on me today?", "Plan my week: what matters most?", "What is on my calendar tomorrow?", "Remind me to call the dentist on Friday."] },
  { pocket: "Verro", name: "Verro", title: "Edits video beside you", asks: ["Make a first cut of this footage.", "Sync these three cameras.", "Make a short for socials from this episode.", "Add captions and render it."] },
  { pocket: "Vision", name: "Vision", title: "Research with sources", asks: ["Find the best budget microphones, with sources.", "Is it true that coffee dehydrates you?", "Compare these two tools for me.", "Give me a brief before I choose a new laptop."] },
  { pocket: "Friday", name: "Friday", title: "Keeps your computers healthy", asks: ["Is my computer healthy today?", "Why is my laptop running slow?", "Back up my Documents folder every night."] },
  { pocket: "Jarvis", name: "Jarvis", title: "House Manager", asks: ["Is there an update for the house?", "Make me a new citizen for my garden projects.", "Why did a citizen not wake up for its mail?"] },
];

// Ultron and Jarvis join a house on their own (the catalogue), so neither is ever offered under "Citizens you can add".
export const JOIN_ON_THEIR_OWN: ReadonlySet<string> = new Set(["Ultron", "Jarvis"]);

export interface AskCitizen { pocket: string; name: string; title: string; asks: string[]; face: string | null }
export interface WhatToAsk { inHouse: AskCitizen[]; canAdd: AskCitizen[] }
