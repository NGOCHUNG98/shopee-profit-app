const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          date TEXT,
          buyer TEXT,
          sku TEXT,
          variation TEXT,
          qty INTEGER,
          status TEXT,
          priceCny REAL,
          rateDate TEXT,
          weightKg REAL,
          pricePerKgVnd REAL,
          shipVnd REAL,
          sellVnd REAL,
          shopVoucherVnd REAL,
          fixedFee REAL,
          serviceFee REAL,
          paymentFee REAL,
          note TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rates (
          date TEXT PRIMARY KEY,
          baseRate REAL,
          feePercent REAL,
          source TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS daily_ads (
          date TEXT PRIMARY KEY,
          adsCost REAL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS ads_costs (
          monthKey TEXT PRIMARY KEY,
          adsCost REAL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS api_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          partnerId TEXT,
          partnerKey TEXT,
          shopId TEXT,
          isAuthorized INTEGER,
          lastSyncTime TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        migrateFromJson().then(resolve).catch(reject);
      });
    });
  });
}

// Auto-migrate store.json to SQLite DB on first run
async function migrateFromJson() {
  const jsonPath = path.join(DATA_DIR, 'store.json');
  if (!fs.existsSync(jsonPath)) return;

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (data.orders && data.orders.length > 0) {
      const count = await getOrdersCount();
      if (count === 0) {
        console.log(`📦 Migrating ${data.orders.length} orders from store.json to SQLite Database...`);
        for (const o of data.orders) {
          await upsertOrder(o);
        }
        console.log('✅ SQLite Database migration completed!');
      }
    }
  } catch (err) {
    console.error('Error migrating json data:', err);
  }
}

function getOrdersCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as cnt FROM orders', (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  });
}

function getAllOrders() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM orders ORDER BY date DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function upsertOrder(o) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT OR REPLACE INTO orders (
        id, date, buyer, sku, variation, qty, status, priceCny, rateDate,
        weightKg, pricePerKgVnd, shipVnd, sellVnd, shopVoucherVnd, fixedFee, serviceFee, paymentFee, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [
      o.id,
      o.date,
      o.buyer || 'shopee_user',
      o.sku || 'Sản phẩm Shopee',
      o.variation || '',
      Number(o.qty) || 1,
      o.status || 'Giao thành công',
      Number(o.priceCny) || 0,
      o.rateDate || o.date,
      Number(o.weightKg) || 5.0,
      Number(o.pricePerKgVnd) || 24000,
      Number(o.shipVnd) || 0,
      Number(o.sellVnd) || 0,
      Number(o.shopVoucherVnd) || 0,
      o.fixedFee !== undefined && o.fixedFee !== null ? Number(o.fixedFee) : null,
      o.serviceFee !== undefined && o.serviceFee !== null ? Number(o.serviceFee) : null,
      o.paymentFee !== undefined && o.paymentFee !== null ? Number(o.paymentFee) : null,
      o.note || ''
    ], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function deleteOrder(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function clearAllOrders() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM orders', function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAllRates() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM rates ORDER BY date DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function upsertRate(r) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT OR REPLACE INTO rates (date, baseRate, feePercent, source) VALUES (?, ?, ?, ?)';
    db.run(sql, [r.date, Number(r.baseRate) || 0, Number(r.feePercent) || 0, r.source || 'Tự nhập'], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAllDailyAds() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM daily_ads', (err, rows) => {
      if (err) return reject(err);
      const map = {};
      (rows || []).forEach(r => map[r.date] = r.adsCost);
      resolve(map);
    });
  });
}

function upsertDailyAds(date, adsCost) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT OR REPLACE INTO daily_ads (date, adsCost) VALUES (?, ?)';
    db.run(sql, [date, Number(adsCost) || 0], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAllAdsCosts() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ads_costs', (err, rows) => {
      if (err) return reject(err);
      const map = {};
      (rows || []).forEach(r => map[r.monthKey] = r.adsCost);
      resolve(map);
    });
  });
}

function upsertAdsCost(monthKey, adsCost) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT OR REPLACE INTO ads_costs (monthKey, adsCost) VALUES (?, ?)';
    db.run(sql, [monthKey, Number(adsCost) || 0], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getApiConfig() {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM api_config WHERE id = 1', (err, row) => {
      if (err) return reject(err);
      resolve(row ? {
        partnerId: row.partnerId,
        partnerKey: row.partnerKey,
        shopId: row.shopId,
        isAuthorized: Boolean(row.isAuthorized),
        lastSyncTime: row.lastSyncTime
      } : {});
    });
  });
}

function upsertApiConfig(config) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT OR REPLACE INTO api_config (id, partnerId, partnerKey, shopId, isAuthorized, lastSyncTime) VALUES (1, ?, ?, ?, ?, ?)';
    db.run(sql, [config.partnerId || '', config.partnerKey || '', config.shopId || '', config.isAuthorized ? 1 : 0, config.lastSyncTime || ''], function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

module.exports = {
  db,
  initDb,
  getAllOrders,
  upsertOrder,
  deleteOrder,
  clearAllOrders,
  getAllRates,
  upsertRate,
  getAllDailyAds,
  upsertDailyAds,
  getAllAdsCosts,
  upsertAdsCost,
  getApiConfig,
  upsertApiConfig
};
