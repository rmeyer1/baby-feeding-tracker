require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const { DateTime } = require('luxon');

// Initialize SQLite database
const db = new sqlite3.Database('feedings.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the feedings database.');
  }
});

// Create feedings table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS feedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ounces REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Initialize Telegram bot
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const knownCommands = new Set(['/help', '/feed', '/daily', '/addfeeding']);

function parseTimeInput(timeInput) {
  const cleaned = timeInput.replace(/^"(.*)"$/, '$1').trim();
  if (!cleaned) {
    return { error: 'Please provide a time (e.g., "8:30 AM", 08:30, or 14:30).' };
  }

  const formats = ['h:mm a', 'h:mma', 'H:mm', 'HH:mm'];
  const now = DateTime.local();

  for (const format of formats) {
    const parsed = DateTime.fromFormat(cleaned, format);
    if (parsed.isValid) {
      return {
        value: parsed.set({ year: now.year, month: now.month, day: now.day })
      };
    }
  }

  return { error: 'Time format not recognized. Use formats like "8:30 AM", "08:30", or "14:30".' };
}

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
*Baby Feeding Tracker Bot*

Commands:
/feed <amount> - Record a feeding (e.g., /feed 4.5)
/addfeeding <ounces> <time> - Record a feeding at a specific time (e.g., /addfeeding 3.5 "8:30 AM" or /addfeeding 4 08:30)
/daily - Show today's feedings
/help - Show this help message
`;
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Feed command - supports /feed, /feed 3, /feed 4.5
bot.onText(/\/feed\s*(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();
  
  // Default to 2 oz if no argument provided
  let ounces;
  if (!input) {
    ounces = 2;
  } else {
    ounces = parseFloat(input);
  }
  
  // Validate input
  if (isNaN(ounces) || ounces <= 0) {
    bot.sendMessage(chatId, 'Please provide a valid positive number for ounces (e.g., /feed 4.5)');
    return;
  }
  
  // Insert feeding record
  const timestamp = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO feedings (ounces, timestamp) VALUES (?, ?)');
  stmt.run(ounces, timestamp, function(err) {
    if (err) {
      console.error('Error inserting feeding record:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error recording the feeding. Please try again.');
    } else {
      const timeFormatted = DateTime.fromISO(timestamp).toLocaleString(DateTime.DATETIME_MED);
      bot.sendMessage(chatId, `Feeding recorded: ${ounces} oz at ${timeFormatted}`);
    }
  });
  stmt.finalize();
});

// Add feeding at a specific time
bot.onText(/\/addfeeding\s*(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();

  if (!input) {
    bot.sendMessage(chatId, 'Usage: /addfeeding <ounces> <time> (e.g., /addfeeding 3.5 "8:30 AM")');
    return;
  }

  const [ouncesPart, ...timeParts] = input.split(' ');
  const ounces = parseFloat(ouncesPart);
  const timeInput = timeParts.join(' ').trim();

  if (isNaN(ounces) || ounces <= 0) {
    bot.sendMessage(chatId, 'Please provide a valid positive number for ounces (e.g., /addfeeding 3.5 "8:30 AM")');
    return;
  }

  const { value: parsedTime, error } = parseTimeInput(timeInput);
  if (error) {
    bot.sendMessage(chatId, error);
    return;
  }

  const timestamp = parsedTime.toISO();
  const stmt = db.prepare('INSERT INTO feedings (ounces, timestamp) VALUES (?, ?)');
  stmt.run(ounces, timestamp, function(err) {
    if (err) {
      console.error('Error inserting feeding record:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error recording the feeding. Please try again.');
    } else {
      const timeFormatted = parsedTime.toLocaleString(DateTime.DATETIME_MED);
      bot.sendMessage(chatId, `Feeding recorded: ${ounces} oz at ${timeFormatted}`);
    }
  });
  stmt.finalize();
});

// Daily command
bot.onText(/\/daily/, (msg) => {
  const chatId = msg.chat.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Query for today's feedings
  const stmt = db.prepare(`
    SELECT ounces, timestamp 
    FROM feedings 
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp ASC
  `);
  
  stmt.all(today.toISOString(), tomorrow.toISOString(), (err, rows) => {
    if (err) {
      console.error('Error fetching daily feedings:', err.message);
      bot.sendMessage(chatId, 'Sorry, there was an error retrieving today\'s feedings.');
      return;
    }
    
    if (rows.length === 0) {
      bot.sendMessage(chatId, 'No feedings recorded today.');
      return;
    }
    
    let response = '*Today\'s Feedings:*\n';
    let totalOunces = 0;
    
    rows.forEach(row => {
      const timeFormatted = DateTime.fromISO(row.timestamp).toLocaleString(DateTime.TIME_SIMPLE);
      response += `${timeFormatted}: ${row.ounces} oz\n`;
      totalOunces += row.ounces;
    });
    
    response += `\n*Total:* ${totalOunces} oz`;
    
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  });
  
  stmt.finalize();
});

// Handle unsupported commands
bot.on('message', (msg) => {
  // Ignore messages that are handled by other listeners
  if (msg.text.startsWith('/')) {
    const command = msg.text.split(' ')[0].split('@')[0];
    if (knownCommands.has(command)) {
      return;
    }
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Unknown command. Type /help to see available commands.');
  }
});

console.log('Baby Feeding Tracker Bot is running...');
