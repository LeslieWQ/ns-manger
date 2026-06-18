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

app.use(cors());
app.use(express.json());

let SQL;

async function init() {
  SQL = await initSqlJs();
  console.log('✅ SQL.js 初始化成功');
}

function loadDB() {
  try {
    const fileBuffer = fs.readFileSync(DB_PATH);
    return new SQL.Database(fileBuffer);
  } catch (e) {
    console.error('数据库加载失败:', e.message);
    return new SQL.Database();
  }
}

function saveDB(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

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

// ==================== 账号 ====================

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

// ==================== 游戏 ====================

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

app.post('/api/games', (req, res) => {
  try {
    const db = loadDB();
    const { account_id, title, price, purchase_date, notes } = req.body;
    dbRun(db,
      'INSERT INTO games (account_id, title, price, purchase_date, notes) VALUES (?, ?, ?, ?, ?)',
      [account_id, title, price || 0, purchase_date || null, notes || null]
    );
    saveDB(db);
    db.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 购买游戏（扣余额，不增加总花费）
app.post('/api/buy-game', (req, res) => {
  try {
    const db = loadDB();
    const { account_id, title, amount, price, purchase_date, notes } = req.body;

    // amount = 本地货币扣余额，price = 人民币价值存数据库
    const deductAmount = amount || price || 0;
    const savePrice = price || deductAmount;

    // 检查余额
    const accounts = dbAll(db, 'SELECT balance FROM accounts WHERE id = ?', [account_id]);
    if (accounts.length === 0) {
      db.close();
      return res.json({ success: false, message: '账号不存在' });
    }

    const balance = accounts[0].balance;
    if (balance < deductAmount) {
      db.close();
      return res.json({ success: false, message: `余额不足（余额: ¥${balance}，需要: ¥${deductAmount}）` });
    }

    // 添加游戏记录
    dbRun(db,
      'INSERT INTO games (account_id, title, price, purchase_date, notes) VALUES (?, ?, ?, ?, ?)',
      [account_id, title, savePrice, purchase_date || null, notes || null]
    );

    // 扣余额
    dbRun(db, 'UPDATE accounts SET balance = balance - ? WHERE id = ?', [deductAmount, account_id]);

    saveDB(db);
    db.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 充值 ====================

app.get('/api/recharges', (req, res) => {
  try {
    const db = loadDB();
    const { account_id } = req.query;
    let rows;
    if (account_id) {
      rows = dbAll(db, `
        SELECT r.*, a.name as account_name, a.region as account_region
        FROM recharges r
        LEFT JOIN accounts a ON r.account_id = a.id
        WHERE r.account_id = ?
        ORDER BY r.id DESC
      `, [account_id]);
    } else {
      rows = dbAll(db, `
        SELECT r.*, a.name as account_name, a.region as account_region
        FROM recharges r
        LEFT JOIN accounts a ON r.account_id = a.id
        ORDER BY r.id DESC
      `);
    }
    db.close();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recharges', (req, res) => {
  try {
    const db = loadDB();
    const { account_id, amount, cost, currency, notes } = req.body;

    // 记录充值
    dbRun(db,
      'INSERT INTO recharges (account_id, amount, cost, currency, notes) VALUES (?, ?, ?, ?, ?)',
      [account_id, amount, cost, currency || 'JPY', notes]
    );

    // 增加余额
    dbRun(db, 'UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, account_id]);

    saveDB(db);
    db.close();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 解密 ====================

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

function decryptPassword(encryptedText, key) {
  try {
    // 支持 old format (Python XOR) 和 new format (Node.js AES)
    if (!encryptedText.includes(':')) {
      // XOR format - just return as-is for display
      return encryptedText;
    }
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;

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

// ==================== 启动 ====================

init().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🎮 NS 账号管理系统后端启动中...`);
    console.log(`📡 API 地址：http://localhost:${PORT}`);
    console.log(`💾 数据库：${DB_PATH}`);
  });
});
