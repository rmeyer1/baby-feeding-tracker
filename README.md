# Baby Feeding Tracker Bot

A Telegram bot for tracking baby feeding schedules.

## Features

- Record feedings with the amount in ounces
- View all feedings for the current day
- Simple command interface

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram and get the token
4. Add your bot token to the `.env` file:
   ```
   TELEGRAM_TOKEN=your_bot_token_here
   ```
5. Run the bot:
   ```
   npm start
   ```

## Usage

Commands:
- `/feed <ounces>` - Records a feeding with current timestamp
- `/daily` - Returns all feedings for today in a readable list format
- `/help` - Shows command usage

## Database

The bot uses SQLite3 to store feeding records in a local database file named `feedings.db`.