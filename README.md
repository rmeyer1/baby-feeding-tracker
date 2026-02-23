# Baby Feeding Bot 🤱

A simple Telegram bot for tracking your baby's feedings. Both parents can use it from anywhere.

## How It Works

The bot automatically recognizes each parent through their Telegram account. When either of you logs a feeding, it tracks:
- How many ounces
- What time
- **Who fed the baby**

This gives you visibility into feeding patterns and helps coordinate between parents.

## Quick Start

1. **Get a bot token**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Run `/newbot` and follow the prompts
   - Copy the token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Install & Setup**
   ```bash
   git clone https://github.com/rmeyer1/baby-feeding-tracker.git
   cd baby-feeding-tracker
   npm install
   cp .env.example .env
   # Edit .env and add your BOT_TOKEN
   ```

3. **Run the Bot**
   ```bash
   npm start
   ```

4. **Add Both Parents**
   - Send your bot link to your partner
   - Both of you: run `/start` in the bot
   - Start logging feedings!

## Usage

### Log a Feeding
Just send a number → bot logs ounces instantly  
*Example: Send `6` → logs 6 ounces*

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Setup the bot (run this first) |
| `/today` or `/daily` | Today's feedings and total |
| `/week` or `/weekly` | Last 7 days with daily breakdown |
| `/month` or `/monthly` | This month's stats |
| `/last` | Most recent feeding |
| `/parents` or `/stats` | **Who's feeding breakdown** |
| `/help` | Show all commands |

## Example Session

```
You: 6
Bot: ✅ Logged 6oz at 2:45 PM
     👤 By: Dad

You: /parents
Bot: 👨‍👩‍👧 Parent Stats

     1. Dad
        124oz • 18 feedings • 65%
        Last: 2h ago

     2. Mom
        67oz • 12 feedings • 35%
        Last: 5h ago
```

## Features

- ✅ **Automatic parent tracking** — No setup needed, works via Telegram
- ✅ **Real-time sync** — Both parents see all feedings instantly
- ✅ **SQLite database** — Everything stored locally
- ✅ **Time-ago display** — "2h ago" instead of timestamps
- ✅ **Feeding distribution** — See who's doing more feedings
- ✅ **Works on any device** — Phone, tablet, desktop

## Tech Stack

- Node.js
- node-telegram-bot-api
- SQLite3
- No external hosting needed (runs locally or on a VPS)

## Roadmap

- [ ] `/delete` command to undo last feeding
- [ ] Feeding duration tracking
- [ ] Export to CSV
- [ ] Weekly email summaries

## License

MIT — see [LICENSE](LICENSE)

---

Built with ❤️ for parents who need sleep.