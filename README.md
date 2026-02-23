# Baby Feeding Bot 🤱

A simple Telegram bot for tracking your baby's feedings. Both parents can use it from anywhere.

## Quick Start

1. **Get a bot token**
   - Message @BotFather on Telegram
   - Create a new bot, copy the token

2. **Setup**
   ```bash
   npm install
   cp .env.example .env
   # Edit .env and add your BOT_TOKEN
   ```

3. **Run**
   ```bash
   npm start
   ```

## How to Use

**Log a feeding:** Just send a number (4, 6, 7, etc.) → bot logs ounces with timestamp

**Commands:**
- `/today` or `/daily` - Today's feedings and total
- `/week` or `/weekly` - Last 7 days summary
- `/month` or `/monthly` - This month's stats
- `/last` - Most recent feeding
- `/help` - Show all commands

## Features

- ✅ Both parents can use the same bot
- ✅ Tracks who logged each feeding
- ✅ SQLite database (simple, local)
- ✅ Daily/weekly/monthly summaries
- ✅ Works on any phone with Telegram