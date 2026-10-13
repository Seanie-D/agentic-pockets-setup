// Beautiful Chat (ABorakati, MIT) in every house (ticket 022; Sean, 2026-10-13 09:52 CDT: "integrating Beautiful Chat as part
// of its install"). It is installed from its Git source at one commit we reviewed: an install from the official directory
// takes the directory's pin, which moves without Friday's walk, and the Cafe's auto-update follows it. A Git install at a
// commit reads "current" for good. Jarvis moves the pin, and Friday walks each move (ticket 013).
export const BEAUTIFUL_CHAT = {
  id: "beautiful-chat",
  source: "git:https://github.com/ABorakati/beautiful-chat.git",
  ref: "42b61d8301b5400a67821bbbfcf99fa8b681dc37",
};

// Help's line on pasted pictures (ticket 022, the approved words): with Beautiful Chat's "Enhanced prompt bubble" on, its
// default, a pasted picture does not show in the user's own message, because Paseo hands plugins the text only.
export const PICTURE_TIP = "Pasted a picture and cannot see it in your message? Your citizen still got it. To see it, turn off Settings → Beautiful Chat → Enhanced prompt bubble.";
