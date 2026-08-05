const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.json');

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

function loadDb() {
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
    console.error('Error loading database:', err);
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
      console.log(`📦 Successfully migrated ${inMemoryDb.orders.length} orders to Atomic Pure JS Database!`);
    } catch (e) {
      console.error('Legacy migration error:', e);
    }
  }
}

async function initDb() {
  loadDb();
  return true;
}

async function getAllOrders() {
  return [...inMemoryDb.orders].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function upsertOrder(o) {
  const idx = inMemoryDb.orders.findIndex(item => item.id === o.id);
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
    fixedFee: o.fixedFee !== undefined && o.fixedFee !== null ? Number(o.fixedFee) : undefined,
    serviceFee: o.serviceFee !== undefined && o.serviceFee !== null ? Number(o.serviceFee) : undefined,
    paymentFee: o.paymentFee !== undefined && o.paymentFee !== null ? Number(o.paymentFee) : undefined,
    note: o.note || ''
  };

  if (idx >= 0) {
    inMemoryDb.orders[idx] = { ...inMemoryDb.orders[idx], ...formatted };
  } else {
    inMemoryDb.orders.unshift(formatted);
  }
  saveDbAtomic();
  return formatted;
}

async function deleteOrder(id) {
  inMemoryDb.orders = inMemoryDb.orders.filter(item => item.id !== id);
  saveDbAtomic();
  return true;
}

async function clearAllOrders() {
  inMemoryDb.orders = [];
  saveDbAtomic();
  return true;
}

async function getAllRates() {
  return [...inMemoryDb.rates].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function upsertRate(r) {
  const idx = inMemoryDb.rates.findIndex(item => item.date === r.date);
  const formatted = {
    date: r.date,
    baseRate: Number(r.baseRate) || 0,
    feePercent: Number(r.feePercent) || 0,
    source: r.source || 'Tự nhập'
  };

  if (idx >= 0) {
    inMemoryDb.rates[idx] = formatted;
  } else {
    inMemoryDb.rates.push(formatted);
  }
  saveDbAtomic();
  return formatted;
}

async function getAllDailyAds() {
  return { ...inMemoryDb.daily_ads };
}

async function upsertDailyAds(date, adsCost) {
  inMemoryDb.daily_ads[date] = Number(adsCost) || 0;
  saveDbAtomic();
  return true;
}

async function getAllAdsCosts() {
  return { ...inMemoryDb.ads_costs };
}

async function upsertAdsCost(monthKey, adsCost) {
  inMemoryDb.ads_costs[monthKey] = Number(adsCost) || 0;
  saveDbAtomic();
  return true;
}

async function getApiConfig() {
  return { ...inMemoryDb.api_config };
}

async function upsertApiConfig(config) {
  inMemoryDb.api_config = {
    partnerId: config.partnerId || '',
    partnerKey: config.partnerKey || '',
    shopId: config.shopId || '',
    isAuthorized: Boolean(config.isAuthorized),
    lastSyncTime: config.lastSyncTime || new Date().toISOString()
  };
  saveDbAtomic();
  return inMemoryDb.api_config;
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
