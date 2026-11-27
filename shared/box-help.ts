// Help's topic for each box under a chat (the "Ours" build, ticket 04): "Yours", "Ours" and "Mine", always written in
// quotes and capitalized. Beautiful Pockets'
// "What goes here?" opens the matching one through the bridge in index.client.tsx. No Node import: the phone reads it.
export type Box = "yours" | "ours" | "mine";
export const BOXES: Box[] = ["yours", "ours", "mine"];
export const BOX_HELP: Record<Box, { name: string; holds: string; how: string }> = {
  yours: {
    name: "\"Yours\"",
    holds: "What waits on you in this chat: the questions a citizen asked you, and your reminders and stickies.",
    how: "Tap a choice on a card, or write your own answer in its note, then press Send. A card from another chat shows greyed; tap it to go to that chat with the card open.",
  },
  ours: {
    name: "\"Ours\"",
    holds: "What you and this citizen still have to talk through: topics that read \"Let's discuss: …\", and maps, where a big unknown is split into questions to settle one at a time.",
    how: "Begin discussion starts the talk in this chat; Begin in a new chat thread starts it in a new thread. When a talk is settled, it leaves \"Ours\" and becomes work in \"Mine\".",
  },
  mine: {
    name: "\"Mine\"",
    holds: "What this citizen will do: its tasks, and its expeditions, the big builds it has cut into tickets.",
    how: "Open a task to read it. Act on this, Discuss and Drop are picked like a card's choices, and nothing goes until you press Send.",
  },
};
export const BOXES_TAB = "\"Yours\", \"Ours\", \"Mine\"";

// Help's ticket page (the owner's cards in Jarvis's desk, 2026-11-26): a page of its own, and each box's topic
// opens with a line that links to it. The 1.19 changelog quotes these words, so users are shown them and know where they are.
export const TICKETS_TAB = "Tickets";
export const TICKET_LINK = "Each thing here is a ticket. What is a ticket?";
export const TICKET_HELP: { intro: string; boxes: Record<Box, string>; tail: string } = {
  intro: "A ticket is any one thing at the bottom of a citizen's chat: an open question, a task, a reminder — anything not yet finished or addressed. It sits in one of three boxes, by whose it is:",
  boxes: {
    yours: "\"Yours\": the ball is in your court. Questions, reminders and stickies that wait on you.",
    ours: "\"Ours\": the two of you work it out together. Talks and maps: questions to answer before any work starts.",
    mine: "\"Mine\": this citizen's own tasks, expeditions and shared jobs, which for the most part are just up to it to get done. Sometimes a citizen needs a nudge to take up its open tasks, because it puts being ready to help you first and does not take up open work by itself (yet). The Work through tasks button in \"Mine\" is that nudge.",
  },
  tail: "A ticket shows in one box only. It can move or split as the work changes. A big ticket, an expedition or a map, holds smaller tickets of its own, each one step of it.",
};

// Verro's three-courts loop for the ticket page (job 2026-11-27-three-courts-explainer; the owner's yes to the storyboard,
// 2026-11-26): in the house's Commons, read from a citizen's pocket (two folders down), its still for less motion.
export const TICKET_LOOP = {
  loop: "../../Commons/reference/house/media/three-courts-loop.gif", // a GIF: the iPhone app draws an animated WebP as a still (the owner, 2026-11-26)
  still: "../../Commons/reference/house/media/three-courts-still.png",
  aspect: 800 / 840,
  alt: "Ultron shows the three boxes: a question card in \"Yours\", a talk in \"Ours\", new tasks in \"Mine\"",
};
