const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.json');

// Check if PostgreSQL environment variable DATABASE_URL is available
const usePg = Boolean(process.env.DATABASE_URL);
let pgPool = null;

if (usePg) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

let inMemoryDb = {
  orders: [],
  rates: [],
  daily_ads: {},
  ads_costs: {},
  api_config: {}
};

function saveDbAtomic() {
  try {
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(inMemoryDb, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error saving atomic database:', err);
  }
}

function loadDbLocal() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      inMemoryDb = {
        orders: parsed.orders || [],
        rates: parsed.rates || [],
        daily_ads: parsed.daily_ads || {},
        ads_costs: parsed.ads_costs || {},
        api_config: parsed.api_config || {}
      };
    } else {
      migrateLegacyFiles();
      saveDbAtomic();
    }
  } catch (err) {
    console.error('Error loading local database:', err);
  }
}

function migrateLegacyFiles() {
  const storePath = path.join(DATA_DIR, 'store.json');
  if (fs.existsSync(storePath)) {
    try {
      const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      inMemoryDb.orders = storeData.orders || [];
      inMemoryDb.rates = storeData.rates || [];
      inMemoryDb.daily_ads = storeData.dailyAds || {};
      inMemoryDb.ads_costs = storeData.adsCosts || {};
      inMemoryDb.api_config = storeData.apiConfig || {};
      console.log(`📦 Successfully migrated ${inMemoryDb.orders.length} orders to Pure JS Database!`);
    } catch (e) {
      console.error('Legacy migration error:', e);
    }
  }
}

async function initDb() {
  if (usePg) {
    console.log('🐘 Initializing PostgreSQL Cloud Database Connection...');
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        date VARCHAR(20),
        buyer VARCHAR(250),
        sku TEXT,
        variation TEXT,
        qty INT,
        status VARCHAR(100),
        price_cny NUMERIC,
        rate_date VARCHAR(20),
        weight_kg NUMERIC,
        price_per_kg_vnd NUMERIC,
        ship_vnd NUMERIC,
        sell_vnd NUMERIC,
        shop_voucher_vnd NUMERIC,
        fixed_fee NUMERIC,
        service_fee NUMERIC,
        payment_fee NUMERIC,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS rates (
        date VARCHAR(20) PRIMARY KEY,
        base_rate NUMERIC,
        fee_percent NUMERIC,
        source TEXT
      );

      CREATE TABLE IF NOT EXISTS daily_ads (
        date VARCHAR(20) PRIMARY KEY,
        ads_cost NUMERIC
      );

      CREATE TABLE IF NOT EXISTS ads_costs (
        month_key VARCHAR(20) PRIMARY KEY,
        ads_cost NUMERIC
      );

      CREATE TABLE IF NOT EXISTS api_config (
        id INT PRIMARY KEY DEFAULT 1,
        partner_id TEXT,
        partner_key TEXT,
        shop_id TEXT,
        is_authorized INT,
        last_sync_time TEXT
      );
    `);
    console.log('✅ PostgreSQL Schema initialized successfully!');
  } else {
    loadDbLocal();
  }
  return true;
}

async function getAllOrders() {
  if (usePg) {
    const res = await pgPool.query('SELECT * FROM orders ORDER BY date DESC');
    return res.rows.map(r => ({
      id: r.id,
      date: r.date,
      buyer: r.buyer,
      sku: r.sku,
      variation: r.variation,
      qty: Number(r.qty),
      status: r.status,
      priceCny: Number(r.price_cny),
      rateDate: r.rate_date,
      weightKg: Number(r.weight_kg),
      pricePerKgVnd: Number(r.price_per_kg_vnd),
      shipVnd: Number(r.ship_vnd),
      sellVnd: Number(r.sell_vnd),
      shopVoucherVnd: Number(r.shop_voucher_vnd),
      fixedFee: r.fixed_fee !== null ? Number(r.fixed_fee) : undefined,
      serviceFee: r.service_fee !== null ? Number(r.service_fee) : undefined,
      paymentFee: r.payment_fee !== null ? Number(r.payment_fee) : undefined,
      note: r.note
    }));
  }
  return [...inMemoryDb.orders].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function upsertOrder(o) {
  const formatted = {
    id: o.id,
    date: o.date,
    buyer: o.buyer || 'shopee_user',
    sku: o.sku || 'Sản phẩm Shopee',
    variation: o.variation || '',
    qty: Number(o.qty) || 1,
    status: o.status || 'Giao thành công',
    priceCny: Number(o.priceCny) || 0,
    rateDate: o.rateDate || o.date,
    weightKg: Number(o.weightKg) || 5.0,
    pricePerKgVnd: Number(o.pricePerKgVnd) || 24000,
    shipVnd: Number(o.shipVnd) || 0,
    sellVnd: Number(o.sellVnd) || 0,
    shopVoucherVnd: Number(o.shopVoucherVnd) || 0,
    fixedFee: o.fixedFee !== undefined && o.fixedFee !== null ? Number(o.fixedFee) : null,
    serviceFee: o.serviceFee !== undefined && o.serviceFee !== null ? Number(o.serviceFee) : null,
    paymentFee: o.paymentFee !== undefined && o.paymentFee !== null ? Number(o.paymentFee) : null,
    note: o.note || ''
  };

  if (usePg) {
    const query = `
      INSERT INTO orders (
        id, date, buyer, sku, variation, qty, status, price_cny, rate_date,
        weight_kg, price_per_kg_vnd, ship_vnd, sell_vnd, shop_voucher_vnd, fixed_fee, service_fee, payment_fee, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        date=EXCLUDED.date, buyer=EXCLUDED.buyer, sku=EXCLUDED.sku, variation=EXCLUDED.variation,
        qty=EXCLUDED.qty, status=EXCLUDED.status, price_cny=EXCLUDED.price_cny, rate_date=EXCLUDED.rate_date,
        weight_kg=EXCLUDED.weight_kg, price_per_kg_vnd=EXCLUDED.price_per_kg_vnd, ship_vnd=EXCLUDED.ship_vnd,
        sell_vnd=EXCLUDED.sell_vnd, shop_voucher_vnd=EXCLUDED.shop_voucher_vnd, fixed_fee=EXCLUDED.fixed_fee,
        service_fee=EXCLUDED.service_fee, payment_fee=EXCLUDED.payment_fee, note=EXCLUDED.note
    `;
    await pgPool.query(query, [
      formatted.id, formatted.date, formatted.buyer, formatted.sku, formatted.variation, formatted.qty,
      formatted.status, formatted.priceCny, formatted.rateDate, formatted.weightKg, formatted.pricePerKgVnd,
      formatted.shipVnd, formatted.sellVnd, formatted.shopVoucherVnd, formatted.fixedFee, formatted.serviceFee,
      formatted.paymentFee, formatted.note
    ]);
  } else {
    const idx = inMemoryDb.orders.findIndex(item => item.id === o.id);
    if (idx >= 0) {
      inMemoryDb.orders[idx] = { ...inMemoryDb.orders[idx], ...formatted };
    } else {
      inMemoryDb.orders.unshift(formatted);
    }
    saveDbAtomic();
  }
  return formatted;
}

async function deleteOrder(id) {
  if (usePg) {
    await pgPool.query('DELETE FROM orders WHERE id = $1', [id]);
  } else {
    inMemoryDb.orders = inMemoryDb.orders.filter(item => item.id !== id);
    saveDbAtomic();
  }
  return true;
}

async function clearAllOrders() {
  if (usePg) {
    await pgPool.query('DELETE FROM orders');
  } else {
    inMemoryDb.orders = [];
    saveDbAtomic();
  }
  return true;
}

async function getAllRates() {
  if (usePg) {
    const res = await pgPool.query('SELECT * FROM rates ORDER BY date DESC');
    return res.rows.map(r => ({
      date: r.date,
      baseRate: Number(r.base_rate),
      feePercent: Number(r.fee_percent),
      source: r.source
    }));
  }
  return [...inMemoryDb.rates].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function upsertRate(r) {
  const formatted = {
    date: r.date,
    baseRate: Number(r.baseRate) || 0,
    feePercent: Number(r.feePercent) || 0,
    source: r.source || 'Tự nhập'
  };

  if (usePg) {
    const query = `
      INSERT INTO rates (date, base_rate, fee_percent, source) VALUES ($1, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE SET base_rate=EXCLUDED.base_rate, fee_percent=EXCLUDED.fee_percent, source=EXCLUDED.source
    `;
    await pgPool.query(query, [formatted.date, formatted.baseRate, formatted.feePercent, formatted.source]);
  } else {
    const idx = inMemoryDb.rates.findIndex(item => item.date === r.date);
    if (idx >= 0) {
      inMemoryDb.rates[idx] = formatted;
    } else {
      inMemoryDb.rates.push(formatted);
    }
    saveDbAtomic();
  }
  return formatted;
}

async function getAllDailyAds() {
  if (usePg) {
    const res = await pgPool.query('SELECT * FROM daily_ads');
    const map = {};
    res.rows.forEach(r => map[r.date] = Number(r.ads_cost));
    return map;
  }
  return { ...inMemoryDb.daily_ads };
}

async function upsertDailyAds(date, adsCost) {
  const val = Number(adsCost) || 0;
  if (usePg) {
    const query = `
      INSERT INTO daily_ads (date, ads_cost) VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET ads_cost=EXCLUDED.ads_cost
    `;
    await pgPool.query(query, [date, val]);
  } else {
    inMemoryDb.daily_ads[date] = val;
    saveDbAtomic();
  }
  return true;
}

async function getAllAdsCosts() {
  if (usePg) {
    const res = await pgPool.query('SELECT * FROM ads_costs');
    const map = {};
    res.rows.forEach(r => map[r.month_key] = Number(r.ads_cost));
    return map;
  }
  return { ...inMemoryDb.ads_costs };
}

async function upsertAdsCost(monthKey, adsCost) {
  const val = Number(adsCost) || 0;
  if (usePg) {
    const query = `
      INSERT INTO ads_costs (month_key, ads_cost) VALUES ($1, $2)
      ON CONFLICT (month_key) DO UPDATE SET ads_cost=EXCLUDED.ads_cost
    `;
    await pgPool.query(query, [monthKey, val]);
  } else {
    inMemoryDb.ads_costs[monthKey] = val;
    saveDbAtomic();
  }
  return true;
}

async function getApiConfig() {
  if (usePg) {
    const res = await pgPool.query('SELECT * FROM api_config WHERE id = 1');
    if (res.rows.length === 0) return {};
    const r = res.rows[0];
    return {
      partnerId: r.partner_id,
      partnerKey: r.partner_key,
      shopId: r.shop_id,
      isAuthorized: Boolean(r.is_authorized),
      lastSyncTime: r.last_sync_time
    };
  }
  return { ...inMemoryDb.api_config };
}

async function upsertApiConfig(config) {
  const formatted = {
    partnerId: config.partnerId || '',
    partnerKey: config.partnerKey || '',
    shopId: config.shopId || '',
    isAuthorized: config.isAuthorized ? 1 : 0,
    lastSyncTime: config.lastSyncTime || new Date().toISOString()
  };

  if (usePg) {
    const query = `
      INSERT INTO api_config (id, partner_id, partner_key, shop_id, is_authorized, last_sync_time) VALUES (1, $1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        partner_id=EXCLUDED.partner_id, partner_key=EXCLUDED.partner_key, shop_id=EXCLUDED.shop_id,
        is_authorized=EXCLUDED.is_authorized, last_sync_time=EXCLUDED.last_sync_time
    `;
    await pgPool.query(query, [formatted.partnerId, formatted.partnerKey, formatted.shopId, formatted.isAuthorized, formatted.lastSyncTime]);
  } else {
    inMemoryDb.api_config = formatted;
    saveDbAtomic();
  }
  return formatted;
}

module.exports = {
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
