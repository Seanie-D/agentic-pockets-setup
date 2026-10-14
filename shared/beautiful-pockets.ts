// Beautiful Pockets in every house: our own copy of Beautiful Chat (ABorakati, MIT) with tool cards closed until they are
// opened (Sean, 2026-10-14 09:35 CDT; option A, 10:03 CDT: it ships in the release). Before it, setup installed Beautiful
// Chat itself (ticket 022). It is a folder in the release beside the house plugin, so neither the official directory
// nor the Cafe's auto-update can move it; a release moves it, and Friday walks each move.
export const BEAUTIFUL_POCKETS = "beautiful-pockets";
// Upstream's own id: a user who has it keeps it, and setup adds no second chat look beside it.
export const BEAUTIFUL_CHAT = "beautiful-chat";
// Written into a plugin's node_modules when its build finished, so a build cut off part-way is run again.
export const BUILT = ".pockets-built";

// Help's line on pasted pictures (ticket 022, the approved words): with the "Enhanced prompt bubble" on, its default, a
// pasted picture does not show in the user's own message, because Paseo hands plugins the text only.
export const PICTURE_TIP = "Pasted a picture and cannot see it in your message? Your citizen still got it. To see it, turn off Settings → Beautiful Pockets → Enhanced prompt bubble.";
