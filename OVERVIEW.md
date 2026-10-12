Sets up your own Agentic Pockets house from a personal invite.

The Agentic Pockets are a small team of AI citizens that live in Paseo, each in its own folder that remembers what it learns. This plugin is the front door: it takes you from an invite to your first citizen saying hello, with no terminal.

## What it does

1. Checks the tools a house needs (Node, Git, Claude Code and Paseo) and says plainly what is ready, too old or missing. One button installs what is missing and updates what is too old: with Homebrew on a Mac, with winget on Windows. Tools that are new enough stay as they are.
2. Takes the code from your invite page. It makes a key for this house, and the invite service gives that key read-only access to the house's files. The code works once.
3. Asks who you would like to start with. One citizen is the simplest start; picking two or more brings the Orchestrator, who coordinates them. It also asks how your citizens run: on demand (the default: a chat opens when it is needed) or always on (each keeps a chat open all day). You can change this after setup, and ask your first citizen about it. It offers the Paseo Cafe, a free catalogue of plugins and looks made by other Paseo users; it is off unless you tick it.
4. Places your house in an `agentic-pockets` folder in your home folder, makes a Paseo workspace for each citizen, and opens the first one.

## What it reads and changes

It reads the versions of your tools, and it installs or updates one only when you press the button. It lists the Claude Code and Paseo extras already on this computer (hooks, skills, agents, commands, plugins, MCP servers, your own CLAUDE.md). You can switch each one off for your new house only. It writes that choice in the house's own folders and never changes the extras themselves, so your other projects keep them. Some extras cannot be switched off for one project: a hook, and Paseo's own plugins and settings. The list says which. It leaves your other projects and workspaces as they are. It writes only the new house folder, one key in `~/.agentic-pockets/keys/`, and the workspaces it makes. It talks to the invite service once, to use your invite.

## Requirements

Paseo 0.11.2 or newer, with plugins switched on under Settings, Plugins. An invite from someone who runs an Agentic Pockets house. A Claude account for Claude Code.
