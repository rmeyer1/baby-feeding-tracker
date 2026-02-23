module.exports = {
  apps: [{
    name: 'baby-feeding-bot',
    script: './bot.js',
    cwd: '/Users/server/projects/baby-feeding-bot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production'
    },
    log_file: './logs/baby-bot.log',
    out_file: './logs/baby-bot-out.log',
    error_file: './logs/baby-bot-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};