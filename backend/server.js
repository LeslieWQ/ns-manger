const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, '../ns_manager.db');
const DECRYPTION_KEY = 'leslie1214';

// 中间件
app.use(cors());
app.use(express.json());

let SQL;

// 初始化 sql.js
async function init() {
  SQL = await initSqlJs();
  console.log('✅ SQL.js 初始化成功');
}

// 每次请求都从文件加载数据库，确保数据一致性
function loadDB() {
  try {
    const fileBuffer = fs.readFileSync(DB_PATH);
    return new SQL.Database(fileBuffer);
  } catch (e) {
    console.error('数据库加载失败:', e.message);
    return new SQL.Database();
  }
}

// 保存数据库到文件
function saveDB(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 辅助函数：执行查询
function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbRun(db, sql, params = []) {
  db.run(sql, params);
}

// 获取账号列表
app.get('/api/accounts', (req, res) => {
  try {
    const db = loadDB();
    const accounts = dbAll(db, `
      SELECT a.*, 
             COALESCE((SELECT SUM(g.price) FROM games g WHERE g.account_id = a.id), 0) as total_spent
      FROM accounts a 
      ORDER BY a.id DESC
    `);
    db.close();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取游戏列表
app.get('/api/games', (req, res) => {
  try {
    const db = loadDB();
    const games = dbAll(db, `
      SELECT g.*, a.name as account_name, a.region as account_region
      FROM games g
      LEFT JOIN accounts a ON g.account_id = a.id
      ORDER BY 
        CASE WHEN g.account_id IS NULL THEN 1 ELSE 0 END,
        g.id DESC
    `);
    db.close();
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加账号
app.post('/api/accounts', (req, res) => {
  try {
    const db = loadDB();
    const { name, region, email, password } = req.body;
    dbRun(db,
      'INSERT INTO accounts (name, region, email, password) VALUES (?, ?, ?, ?)',
      [name, region, email, password]
    );
    saveDB(db);
    db.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加游戏
app.post('/api/games', (req, res) => {
  try {
    const db = loadDB();
    const { account_id, title, price, purchase_date, notes } = req.body;
    dbRun(db,
      'INSERT INTO games (account_id, title, price, purchase_date, notes) VALUES (?, ?, ?, ?, ?)',
      [account_id, title, price || 0, purchase_date, notes]
    );
    saveDB(db);
    db.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 解密密码
app.post('/api/decrypt', (req, res) => {
  const { password, key } = req.body;

  if (!password || !key) {
    return res.json({ success: false, message: '缺少密码或密钥' });
  }

  if (key !== DECRYPTION_KEY) {
    return res.json({ success: false, message: '密钥错误' });
  }

  let encryptedPassword = password;
  if (encryptedPassword.startsWith('ENC:')) {
    encryptedPassword = encryptedPassword.slice(4);
  }

  const decrypted = decryptPassword(encryptedPassword, key);

  if (decrypted) {
    res.json({ success: true, password: decrypted });
  } else {
    res.json({ success: false, message: '解密失败' });
  }
});

// 解密函数（与 Python crypto.py 逻辑一致）
function decryptPassword(encryptedText, key) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');

    const keyBuffer = crypto.createHash('md5').update(key).digest();

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('解密错误:', error);
    return null;
  }
}

// 启动服务器
init().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🎮 NS 账号管理系统后端启动中...`);
    console.log(`📡 API 地址：http://localhost:${PORT}`);
    console.log(`💾 数据库：${DB_PATH}`);
  });
});
