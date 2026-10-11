# Netherite Giveaway Bot

A standalone Discord.js v14 giveaway bot for a Minecraft streamer community.

## Commands
- `/giveaway-start prize duration [winners] [channel]` — create a giveaway. Duration examples: `30s`, `30m`, `2h`, `1d`; allowed range is 10 seconds to 30 days.
- `/giveaway-end message_id` — end early and randomly choose winner(s).
- `/giveaway-reroll message_id` — choose new winner(s) from the original entrant list.
- `/giveaway-info message_id` — see status, entry count, prize, and end time.
- `/giveaway-list` — list active giveaways.
- `/giveaway-cancel message_id` — cancel without choosing a winner.

When the timer expires, the bot disables the entry button, edits the giveaway post, randomly chooses up to the configured number of unique entrants, and announces winner(s) in the **same channel**. Entrants and active/ended giveaway records are saved in `giveaways.json`, so restarts on a host with persistent disk do not erase the entry list. A host with ephemeral storage can still lose the file after a redeploy/restart; use persistent storage or a database for that host.

## Setup
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in your bot token, application/client ID, and server/guild ID. Never share your token.
3. In this folder run `npm install`.
4. Run `npm run deploy` once to register slash commands.
5. Run `npm start` to keep the bot online.
6. Invite the bot with `bot` and `applications.commands` scopes. It needs View Channel, Send Messages, Embed Links, Read Message History, and Use Application Commands.

To run 24/7 with your computer off, deploy this folder as a persistent Node.js worker on a hosting provider. Enable persistent disk/storage for `giveaways.json`; the bot cannot stay online if it is only run locally and your computer is off.
