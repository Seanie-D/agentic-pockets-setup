Sets up your own Agentic Pockets house from a personal invite.

The Agentic Pockets are a small team of AI citizens that live in Paseo, each in its own folder that remembers what it learns. This plugin is the front door: it takes you from an invite to your first citizen saying hello, with no terminal.

## What it does

1. Checks the tools a house needs (Node, Git, Claude Code and Paseo) and says plainly what is ready, too old or missing, with a link for each.
2. Takes the code from your invite page. It makes a key for this house, and the invite service gives that key read-only access to the house's files. The code works once.
3. Asks who you would like to start with. One citizen is the simplest start; picking two or more brings the Orchestrator, who coordinates them.
4. Places your house in an `agentic-pockets` folder in your home folder, makes a Paseo workspace for each citizen, and opens the first one.

## What it reads and changes

It reads the versions of your tools and lists the Claude Code extras already on this computer (hooks, skills, agents, commands, plugins). It changes none of them, and it leaves your other projects and workspaces as they are. It writes only the new house folder, one key in `~/.agentic-pockets/keys/`, and the workspaces it makes. It talks to the invite service once, to use your invite.

## Requirements

Paseo 0.11.2 or newer, with plugins switched on under Settings, Plugins. An invite from someone who runs an Agentic Pockets house. A Claude account for Claude Code.
