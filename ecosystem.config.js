module.exports = {
  apps: [{
    name: 'ns-manager-api',
    script: '/opt/ns-manager/backend/server.js',
    cwd: '/opt/ns-manager',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    error_file: '/opt/ns-manager/logs/pm2-error.log',
    out_file: '/opt/ns-manager/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
