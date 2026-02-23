require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found. Create a .env file with your token from @BotFather');
  process.exit(1);
}

// Timezone configuration - EST/EDT (America/New_York)
const TIMEZONE = 'America/New_York';

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🤱 Baby Feeding Bot started!');

// Initialize SQLite database
const db = new sqlite3.Database('./feedings.db', (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    createTable();
  }
});

function createTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS feedings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ounces INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      username TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err);
    } else {
      console.log('✅ Feedings table ready');
    }
  });
}

// Helper: Parse SQLite timestamp as UTC, then format for EST display
function parseTimestampToDate(timestamp) {
  // SQLite timestamps are in UTC format "2026-02-23 06:34:04"
  // Append 'Z' to treat as UTC, then convert to local for display
  if (typeof timestamp === 'string' && !timestamp.endsWith('Z')) {
    timestamp = timestamp + 'Z';
  }
  return new Date(timestamp);
}

// Helper: format time ago
function timeAgo(timestamp) {
  const date = parseTimestampToDate(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Helper: format datetime in EST timezone
function formatEST(timestamp) {
  const date = parseTimestampToDate(timestamp);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit',
    timeZone: TIMEZONE
  });
}

// Helper: format time only in EST
function formatESTTime(timestamp) {
  const date = parseTimestampToDate(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZone: TIMEZONE
  });
}

// Helper: format date only in EST
function formatESTDate(timestamp) {
  const date = parseTimestampToDate(timestamp);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    timeZone: TIMEZONE
  });
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome = `🤱 *Welcome to Baby Feeding Bot!*

I'll help you track your baby's feedings. Both parents can use me from any device.

*How to log a feeding:*
Just send a number like \`4\`, \`6\`, or \`7\` — I'll log it as ounces with a timestamp.

*Commands:*
/today — Today's feedings
/week — Last 7 days
/month — This month
/last — Most recent feeding
/help — Show all commands`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const help = `🤱 *Baby Feeding Bot Commands*

*Logging:*
Just type a number (1-12) → logs ounces instantly

*Reports:*
/today or /daily — Today's feedings & total
/week or /weekly — Last 7 days summary  
/month or /monthly — This month's stats
/last — Most recent feeding
/parents or /stats — Who's feeding stats

*Tips:*
• Both parents can use the same bot
• I auto-track who logged each feeding
• Valid range: 1-12 ounces per feeding`;

  bot.sendMessage(chatId, help, { parse_mode: 'Markdown' });
});

// Handle number input (feeding ounces)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  // Skip commands
  if (!text || text.startsWith('/')) return;
  
  // Check if it's a number
  const ounces = parseInt(text, 10);
  if (isNaN(ounces)) return;
  
  // Validate range (1-12 ounces is reasonable for a feeding)
  if (ounces < 1 || ounces > 12) {
    bot.sendMessage(chatId, `⚠️ Please enter a number between 1 and 12 ounces.`);
    return;
  }
  
  // Save to database
  const userId = msg.from?.id?.toString();
  const username = msg.from?.username || msg.from?.first_name || 'Parent';
  
  db.run(
    'INSERT INTO feedings (ounces, user_id, username) VALUES (?, ?, ?)',
    [ounces, userId, username],
    function(err) {
      if (err) {
        console.error('Error saving feeding:', err);
        bot.sendMessage(chatId, '❌ Sorry, something went wrong. Try again.');
        return;
      }
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: TIMEZONE
      });
      const displayName = msg.from?.first_name || username;
      
      bot.sendMessage(
        chatId, 
        `✅ *Logged ${ounces}oz* at ${timeStr}\n👤 By: ${displayName}`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

// /today or /daily command
bot.onText(/\/today|\/daily/, (msg) => {
  const chatId = msg.chat.id;
  
  // Get current date in EST for the query
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const estDateStr = estNow.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
  
  // SQLite stores timestamps in UTC. To filter by "today in EST", we need to
  // convert the UTC timestamp to EST before extracting the date.
  // EST = UTC - 5 hours (or -4 during EDT). Using '-5 hours' is a reasonable default.
  db.all(
    `SELECT ounces, timestamp, username 
     FROM feedings 
     WHERE date(timestamp, '-5 hours') = date(?)
     ORDER BY timestamp DESC`,
    [estDateStr],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        bot.sendMessage(chatId, '❌ Error fetching data.');
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, '📊 *Today\'s Feedings*\n\nNo feedings logged yet today.', { parse_mode: 'Markdown' });
        return;
      }
      
      const total = rows.reduce((sum, r) => sum + r.ounces, 0);
      const count = rows.length;
      
      let message = `📊 *Today's Feedings*\n\n`;
      rows.forEach(row => {
        const timeStr = formatESTTime(row.timestamp);
        message += `• ${row.ounces}oz at ${timeStr} — ${row.username}\n`;
      });
      
      message += `\n*Total: ${total}oz* (${count} feeding${count !== 1 ? 's' : ''})`;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

// /week or /weekly command
bot.onText(/\/week|\/weekly/, (msg) => {
  const chatId = msg.chat.id;
  
  db.all(
    `SELECT ounces, timestamp
     FROM feedings 
     WHERE timestamp >= datetime('now', '-7 days')
     ORDER BY timestamp DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        bot.sendMessage(chatId, '❌ Error fetching data.');
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, '📈 *Last 7 Days*\n\nNo feedings logged.', { parse_mode: 'Markdown' });
        return;
      }
      
      // Group by EST date
      const byDate = {};
      rows.forEach(row => {
        const estDate = formatESTDate(row.timestamp);
        if (!byDate[estDate]) byDate[estDate] = { total: 0, count: 0 };
        byDate[estDate].total += row.ounces;
        byDate[estDate].count += 1;
      });
      
      const totalOunces = rows.reduce((sum, r) => sum + r.ounces, 0);
      const totalFeedings = rows.length;
      const avgPerDay = (totalOunces / 7).toFixed(1);
      
      let message = `📈 *Last 7 Days*\n\n`;
      
      // Get last 7 days in EST
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        const estD = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
        estD.setDate(estD.getDate() - i);
        days.push({
          name: estD.toLocaleDateString('en-US', { weekday: 'short', timeZone: TIMEZONE }),
          dateStr: estD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TIMEZONE })
        });
      }
      
      days.forEach(day => {
        const entry = Object.entries(byDate).find(([date]) => date.includes(day.dateStr.split(' ')[1]));
        if (entry) {
          message += `${day.name}: ${entry[1].total}oz (${entry[1].count})\n`;
        } else {
          message += `${day.name}: —\n`;
        }
      });
      
      message += `\n*Total: ${totalOunces}oz* (${totalFeedings} feedings)\n`;
      message += `Avg: ${avgPerDay}oz/day`;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

// /month or /monthly command
bot.onText(/\/month|\/monthly/, (msg) => {
  const chatId = msg.chat.id;
  
  // Get current month in EST
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const yearMonth = estNow.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', timeZone: TIMEZONE }).replace('/', '-');
  
  db.all(
    `SELECT ounces, timestamp
     FROM feedings 
     WHERE strftime('%Y-%m', timestamp) = ?
     ORDER BY timestamp DESC`,
    [yearMonth],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        bot.sendMessage(chatId, '❌ Error fetching data.');
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, '📅 *This Month*\n\nNo feedings logged yet.', { parse_mode: 'Markdown' });
        return;
      }
      
      // Group by EST date
      const byDate = {};
      rows.forEach(row => {
        const estDate = formatESTDate(row.timestamp);
        if (!byDate[estDate]) byDate[estDate] = { total: 0, count: 0 };
        byDate[estDate].total += row.ounces;
        byDate[estDate].count += 1;
      });
      
      const totalOunces = rows.reduce((sum, r) => sum + r.ounces, 0);
      const totalFeedings = rows.length;
      const daysActive = Object.keys(byDate).length;
      const avgPerDay = (totalOunces / daysActive).toFixed(1);
      
      let message = `📅 *This Month*\n\n`;
      message += `Days with feedings: ${daysActive}\n`;
      message += `Total feedings: ${totalFeedings}\n`;
      message += `Total ounces: ${totalOunces}oz\n`;
      message += `Average: ${avgPerDay}oz/day (active days)`;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

// /last command
bot.onText(/\/last/, (msg) => {
  const chatId = msg.chat.id;
  
  db.get(
    `SELECT ounces, timestamp, username 
     FROM feedings 
     ORDER BY timestamp DESC 
     LIMIT 1`,
    [],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        bot.sendMessage(chatId, '❌ Error fetching data.');
        return;
      }
      
      if (!row) {
        bot.sendMessage(chatId, '🍼 *Last Feeding*\n\nNo feedings logged yet.', { parse_mode: 'Markdown' });
        return;
      }
      
      const timeStr = formatEST(row.timestamp);
      const ago = timeAgo(row.timestamp);
      
      bot.sendMessage(
        chatId,
        `🍼 *Last Feeding*\n\n${row.ounces}oz at ${timeStr}\n👤 ${row.username}\n🕐 ${ago}`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

// /parents or /stats command - shows feeding breakdown by parent
bot.onText(/\/parents|\/stats/, (msg) => {
  const chatId = msg.chat.id;
  
  db.all(
    `SELECT 
       username,
       COUNT(*) as feedings,
       SUM(ounces) as total_ounces,
       MAX(timestamp) as last_feeding
     FROM feedings 
     GROUP BY username
     ORDER BY total_ounces DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        bot.sendMessage(chatId, '❌ Error fetching data.');
        return;
      }
      
      if (rows.length === 0) {
        bot.sendMessage(chatId, '👨‍👩‍👧 *Parent Stats*\n\nNo feedings logged yet.', { parse_mode: 'Markdown' });
        return;
      }
      
      // Get overall stats
      const totalAll = rows.reduce((sum, r) => sum + r.total_ounces, 0);
      const countAll = rows.reduce((sum, r) => sum + r.feedings, 0);
      
      let message = `👨‍👩‍👧 *Parent Stats*\n\n`;
      
      rows.forEach((row, index) => {
        const percent = ((row.total_ounces / totalAll) * 100).toFixed(0);
        const ago = timeAgo(row.last_feeding);
        message += `${index + 1}. *${row.username}*\n`;
        message += `   ${row.total_ounces}oz • ${row.feedings} feedings • ${percent}%\n`;
        message += `   Last: ${ago}\n\n`;
      });
      
      message += `*Total: ${totalAll}oz* (${countAll} feedings)`;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

// Error handling
bot.on('error', (err) => {
  console.error('Bot error:', err);
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
});

console.log('✅ Bot is running. Press Ctrl+C to stop.');
