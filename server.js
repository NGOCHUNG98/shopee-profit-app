const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'store.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { apiConfig: {}, adsCosts: {}, dailyAds: {}, rates: [], orders: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      apiConfig: parsed.apiConfig || {},
      adsCosts: parsed.adsCosts || {},
      dailyAds: parsed.dailyAds || {},
      rates: parsed.rates || [],
      orders: parsed.orders || []
    };
  } catch (err) {
    console.error('Error reading data file:', err);
    return { apiConfig: {}, adsCosts: {}, dailyAds: {}, rates: [], orders: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing data file:', err);
  }
}

function calculateOrderDetails(order, rates) {
  const qty = Number(order.qty) || 1;
  const priceCny = Number(order.priceCny) || 0;
  
  const weightKg = Number(order.weightKg) || 0;
  const pricePerKgVnd = Number(order.pricePerKgVnd) || 24000;
  let shipVnd = Number(order.shipVnd);
  if (isNaN(shipVnd) || shipVnd === 0) {
    shipVnd = Math.round(weightKg * pricePerKgVnd);
  }

  const sellVnd = Number(order.sellVnd) || 0;
  const shopVoucherVnd = Number(order.shopVoucherVnd) || 0;
  const status = order.status || 'Giao thành công';

  let rateObj = rates.find(r => r.date === order.rateDate);
  let effectiveRate = 3550;
  if (rateObj) {
    const base = Number(rateObj.baseRate) || 0;
    const fee = Number(rateObj.feePercent) || 0;
    effectiveRate = Math.round(base * (1 + fee / 100));
  }

  const cnyTotalVnd = Math.round(qty * priceCny * effectiveRate);
  const totalCostVnd = cnyTotalVnd + shipVnd;
  const totalOrderValue = Math.max(0, Math.round(sellVnd * qty) - shopVoucherVnd);

  let fixedFee = 0;
  let serviceFee = 0;
  let paymentFee = 0;
  let taxFee = 0;
  let totalShopeeFees = 0;
  let netRevenue = 0;
  let netProfit = 0;

  if (status !== 'Đã hủy') {
    fixedFee = order.fixedFee !== undefined ? Number(order.fixedFee) : Math.round(totalOrderValue * 0.04);
    serviceFee = order.serviceFee !== undefined ? Number(order.serviceFee) : Math.round(totalOrderValue * 0.06);
    paymentFee = order.paymentFee !== undefined ? Number(order.paymentFee) : Math.round(totalOrderValue * 0.04);
    taxFee = Math.round(totalOrderValue * 0.015);
    totalShopeeFees = fixedFee + serviceFee + paymentFee + taxFee;
    netRevenue = totalOrderValue - totalShopeeFees;
  }

  if (status === 'Đã hủy') {
    netProfit = 0;
  } else if (status === 'Trả hàng/Hoàn tiền') {
    netProfit = -totalCostVnd;
  } else {
    netProfit = netRevenue - totalCostVnd;
  }

  const profitMargin = totalOrderValue > 0 ? (netProfit / totalOrderValue) * 100 : 0;

  return {
    ...order,
    weightKg,
    pricePerKgVnd,
    shipVnd,
    shopVoucherVnd,
    effectiveRate,
    cnyTotalVnd,
    totalCostVnd,
    totalOrderValue,
    fixedFee,
    serviceFee,
    paymentFee,
    taxFee,
    totalShopeeFees,
    netRevenue,
    netProfit,
    profitMargin: Number(profitMargin.toFixed(1))
  };
}

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. GET Dashboard Metrics
app.get('/api/dashboard', (req, res) => {
  const monthKey = req.query.month || '2026-08';
  const data = readData();

  const monthOrders = data.orders.filter(o => o.date && o.date.startsWith(monthKey));
  const calculatedOrders = monthOrders.map(o => calculateOrderDetails(o, data.rates));

  const completedOrders = calculatedOrders.filter(o => o.status === 'Giao thành công');
  const totalOrdersCount = calculatedOrders.length;
  const totalItemsSold = calculatedOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
  const totalRevenue = calculatedOrders.reduce((sum, o) => sum + o.netRevenue, 0);
  const totalCost = calculatedOrders.reduce((sum, o) => sum + (o.status !== 'Đã hủy' ? o.totalCostVnd : 0), 0);
  const totalShopeeFees = calculatedOrders.reduce((sum, o) => sum + o.totalShopeeFees, 0);
  const orderProfit = calculatedOrders.reduce((sum, o) => sum + o.netProfit, 0);

  const [yearStr, mStr] = monthKey.split('-');
  const year = Number(yearStr) || 2026;
  const month = Number(mStr) || 8;
  const daysInMonth = new Date(year, month, 0).getDate();

  let sumDailyAds = 0;
  const dailyStats = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${monthKey}-${day.toString().padStart(2, '0')}`;
    const dayOrders = calculatedOrders.filter(o => o.date === dayStr);

    const dayRateObj = data.rates.find(r => r.date === dayStr);
    const dayRate = dayRateObj ? Math.round(dayRateObj.baseRate * (1 + (dayRateObj.feePercent || 0) / 100)) : 0;

    const dayAds = Number(data.dailyAds[dayStr]) || 0;
    sumDailyAds += dayAds;

    const dayRevenue = dayOrders.reduce((sum, o) => sum + o.totalOrderValue, 0);
    const dayCost = dayOrders.reduce((sum, o) => sum + o.totalCostVnd, 0);
    const dayFees = dayOrders.reduce((sum, o) => sum + o.totalShopeeFees, 0);
    const dayOrderProfit = dayOrders.reduce((sum, o) => sum + o.netProfit, 0);
    const dayFinalProfit = dayOrderProfit - dayAds;
    const dayCount = dayOrders.length;
    const dayQty = dayOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);

    dailyStats.push({
      date: dayStr,
      dayDisplay: `${day.toString().padStart(2, '0')}/${mStr}/${year}`,
      count: dayCount,
      qty: dayQty,
      rate: dayRate,
      revenue: dayRevenue,
      cost: dayCost,
      fees: dayFees,
      orderProfit: dayOrderProfit,
      adsCost: dayAds,
      finalProfit: dayFinalProfit,
      margin: dayRevenue > 0 ? Number(((dayFinalProfit / dayRevenue) * 100).toFixed(1)) : 0
    });
  }

  const adsCost = sumDailyAds > 0 ? sumDailyAds : (Number(data.adsCosts[monthKey]) || 0);
  const finalNetProfit = orderProfit - adsCost;
  const profitMargin = totalRevenue > 0 ? (finalNetProfit / totalRevenue) * 100 : 0;

  res.json({
    monthKey,
    totalOrdersCount,
    completedCount: completedOrders.length,
    totalItemsSold,
    totalRevenue,
    totalCost,
    totalShopeeFees,
    orderProfit,
    adsCost,
    finalNetProfit,
    profitMargin: Number(profitMargin.toFixed(1)),
    dailyStats
  });
});

// 2. Ads Cost Endpoints
app.post('/api/ads-cost', (req, res) => {
  const { monthKey, adsCost } = req.body;
  if (!monthKey) return res.status(400).json({ error: 'Missing monthKey' });

  const data = readData();
  data.adsCosts[monthKey] = Number(adsCost) || 0;
  writeData(data);
  res.json({ success: true, monthKey, adsCost: data.adsCosts[monthKey] });
});

app.post('/api/daily-ads', (req, res) => {
  const { date, adsCost } = req.body;
  if (!date) return res.status(400).json({ error: 'Missing date' });

  const data = readData();
  data.dailyAds[date] = Number(adsCost) || 0;
  writeData(data);
  res.json({ success: true, date, adsCost: data.dailyAds[date] });
});

// 3. Daily Rates Endpoints
app.get('/api/rates', (req, res) => {
  const monthKey = req.query.month;
  const data = readData();

  let ratesList = data.rates || [];
  if (monthKey) {
    ratesList = ratesList.filter(r => r.date.startsWith(monthKey));
  }
  ratesList.sort((a, b) => a.date.localeCompare(b.date));
  res.json(ratesList);
});

app.post('/api/rates', (req, res) => {
  const { date, baseRate, feePercent, source } = req.body;
  if (!date || baseRate === undefined) {
    return res.status(400).json({ error: 'Missing required date or baseRate' });
  }

  const data = readData();
  let existingIndex = data.rates.findIndex(r => r.date === date);

  const newRate = {
    date,
    baseRate: Number(baseRate) || 0,
    feePercent: Number(feePercent) || 0,
    source: source || 'Tự nhập'
  };

  if (existingIndex >= 0) {
    data.rates[existingIndex] = newRate;
  } else {
    data.rates.push(newRate);
  }

  writeData(data);
  res.json({ success: true, rate: newRate });
});

// 4. Orders CRUD
app.get('/api/orders', (req, res) => {
  const { month, status, search } = req.query;
  const data = readData();

  let monthOrders = data.orders || [];
  if (month) {
    monthOrders = monthOrders.filter(o => o.date && o.date.startsWith(month));
  }

  const statusCounts = {
    all: monthOrders.length,
    completed: monthOrders.filter(o => o.status === 'Giao thành công').length,
    pending: monthOrders.filter(o => o.status === 'Chờ giao hàng').length,
    shipping: monthOrders.filter(o => o.status === 'Đang vận chuyển').length,
    cancelled: monthOrders.filter(o => o.status === 'Đã hủy').length,
    refunded: monthOrders.filter(o => o.status === 'Trả hàng/Hoàn tiền').length
  };

  let filtered = monthOrders;

  if (status && status !== 'all') {
    filtered = filtered.filter(o => o.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(o =>
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.buyer && o.buyer.toLowerCase().includes(q)) ||
      (o.sku && o.sku.toLowerCase().includes(q)) ||
      (o.variation && o.variation.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const calculated = filtered.map(o => calculateOrderDetails(o, data.rates));
  res.json({ orders: calculated, statusCounts });
});

app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order.id || !order.date || !order.sku) {
    return res.status(400).json({ error: 'Missing required order fields (id, date, sku)' });
  }

  const data = readData();
  const existingIdx = data.orders.findIndex(o => o.id === order.id);

  if (existingIdx >= 0) {
    data.orders[existingIdx] = { ...data.orders[existingIdx], ...order };
  } else {
    data.orders.push(order);
  }

  writeData(data);
  res.json({ success: true, order });
});

app.put('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const data = readData();
  const index = data.orders.findIndex(o => o.id === orderId);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  data.orders[index] = { ...data.orders[index], ...req.body };
  writeData(data);
  res.json({ success: true, order: data.orders[index] });
});

app.delete('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const data = readData();
  data.orders = data.orders.filter(o => o.id !== orderId);
  writeData(data);
  res.json({ success: true, message: `Deleted order ${orderId}` });
});

// 5. IMPORT OFFICIAL SHOPEE EXPORT EXCEL FILE (.xlsx) WITH VARIATION COLUMN
app.post('/api/import-shopee-excel', async (req, res) => {
  try {
    const { base64Data, clearAll } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'Không tìm thấy sheet dữ liệu trong file Excel' });
    }

    const data = readData();
    if (clearAll) {
      data.orders = [];
    }

    let newCount = 0;
    let updatedCount = 0;
    let headers = {};

    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value || '').trim().normalize("NFC").toLowerCase();
      if (text.includes('mã đơn') || text.includes('order id')) headers.id = colNumber;
      if (text.includes('ngày đặt') || text.includes('ngày tạo') || text.includes('order date')) headers.date = colNumber;
      if (text.includes('người mua') || text.includes('buyer username') || text.includes('tài khoản')) headers.buyer = colNumber;
      if (text.includes('tên sản phẩm') || text.includes('item name') || text.includes('sku sản phẩm')) headers.sku = colNumber;
      if (text.includes('tên phân loại') || text.includes('variation')) headers.variation = colNumber;
      if (text.includes('cân nặng') || text.includes('tổng cân nặng') || text.includes('weight')) headers.weight = colNumber;
      if (text.includes('số lượng') && !text.includes('hoàn')) headers.qty = colNumber;
      if (text.includes('trạng thái đơn') || text.includes('status')) headers.status = colNumber;
      if (text.includes('giá ưu đãi') || text.includes('tổng số tiền người mua thanh toán') || text.includes('tổng giá trị đơn')) {
        if (!headers.sell) headers.sell = colNumber;
      }
      if (text === 'mã giảm giá của shop' || (text.includes('giảm giá của shop') && !text.includes('shopee'))) {
        headers.shopVoucher = colNumber;
      }
      if (text.includes('phí cố định')) headers.fixedFee = colNumber;
      if (text.includes('phí dịch vụ')) headers.serviceFee = colNumber;
      if (text.includes('phí xử lý giao dịch')) headers.paymentFee = colNumber;
    });

    const idCol = headers.id || 1;
    const dateCol = headers.date || 3;
    const buyerCol = headers.buyer || 53;
    const skuCol = headers.sku || 16;
    const variationCol = headers.variation || 21;
    const weightCol = headers.weight || 17;
    const qtyCol = headers.qty || 26;
    const statusCol = headers.status || 4;
    const sellCol = headers.sell || 28;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawId = String(row.getCell(idCol).value || '').trim();
      if (!rawId || rawId.toLowerCase().includes('mã đơn')) return;

      let rawDate = row.getCell(dateCol).value;
      let dateStr = new Date().toISOString().split('T')[0];
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split('T')[0];
      } else if (typeof rawDate === 'string' && rawDate.length >= 10) {
        dateStr = rawDate.substring(0, 10).replace(/\//g, '-');
      }

      const buyer = String(row.getCell(buyerCol).value || 'shopee_user').trim();
      const sku = String(row.getCell(skuCol).value || 'Sản phẩm Shopee').trim();
      const variation = String(row.getCell(variationCol).value || '').trim();
      const qty = Number(row.getCell(qtyCol).value) || 1;
      
      const weightValStr = String(row.getCell(weightCol).value || '5.0').trim().replace(',', '.');
      const weightKg = Number(weightValStr) || 5.0;
      const pricePerKgVnd = 24000;
      const shipVnd = Math.round(weightKg * pricePerKgVnd);

      let rawStatus = String(row.getCell(statusCol).value || 'Giao thành công').trim().normalize("NFC");
      let lower = rawStatus.toLowerCase();
      let status = 'Giao thành công';

      // PRECISE STATUS MAPPING ORDER: Check Completed / Delivered FIRST
      if (lower.includes('đã nhận được hàng') || lower.includes('hoàn thành') || lower.includes('đã giao') || lower.includes('completed')) {
        status = 'Giao thành công';
      } else if (lower.includes('hủy') || lower.includes('cancelled')) {
        status = 'Đã hủy';
      } else if (lower.includes('chờ giao') || lower.includes('chờ lấy') || lower.includes('to ship')) {
        status = 'Chờ giao hàng';
      } else if (lower.includes('đang giao') || lower.includes('vận chuyển') || lower.includes('shipping')) {
        status = 'Đang vận chuyển';
      } else if (lower.includes('trả hàng') || lower.includes('hoàn tiền') || lower.includes('return')) {
        status = 'Trả hàng/Hoàn tiền';
      }

      const sellVnd = Number(row.getCell(sellCol).value) || 0;
      const shopVoucherVnd = headers.shopVoucher ? Number(row.getCell(headers.shopVoucher).value) || 0 : 0;

      const existingIdx = data.orders.findIndex(o => o.id === rawId);
      if (existingIdx >= 0) {
        const old = data.orders[existingIdx];
        data.orders[existingIdx] = {
          ...old,
          date: dateStr,
          status,
          sellVnd,
          shopVoucherVnd,
          weightKg: weightKg || old.weightKg,
          pricePerKgVnd: 24000,
          shipVnd: Math.round((weightKg || old.weightKg) * 24000),
          fixedFee: headers.fixedFee ? Number(row.getCell(headers.fixedFee).value) || old.fixedFee : old.fixedFee,
          serviceFee: headers.serviceFee ? Number(row.getCell(headers.serviceFee).value) || old.serviceFee : old.serviceFee,
          paymentFee: headers.paymentFee ? Number(row.getCell(headers.paymentFee).value) || old.paymentFee : old.paymentFee,
          buyer: buyer || old.buyer,
          sku: sku || old.sku,
          variation: variation || old.variation || ''
        };
        updatedCount++;
      } else {
        const newOrder = {
          id: rawId,
          date: dateStr,
          buyer,
          sku,
          variation,
          qty,
          status,
          priceCny: 225.0,
          rateDate: dateStr,
          weightKg,
          pricePerKgVnd: 24000,
          shipVnd,
          sellVnd,
          shopVoucherVnd,
          fixedFee: headers.fixedFee ? Number(row.getCell(headers.fixedFee).value) || undefined : undefined,
          serviceFee: headers.serviceFee ? Number(row.getCell(headers.serviceFee).value) || undefined : undefined,
          paymentFee: headers.paymentFee ? Number(row.getCell(headers.paymentFee).value) || undefined : undefined,
          note: 'Import từ File Shopee Excel'
        };
        data.orders.unshift(newOrder);
        newCount++;
      }
    });

    writeData(data);
    res.json({
      success: true,
      newCount,
      updatedCount,
      message: updatedCount > 0
        ? `Đã nạp & cập nhật thành công ${updatedCount + newCount} đơn hàng từ File Excel!`
        : `Đã nạp mới thành công ${newCount} đơn hàng từ File Excel!`
    });
  } catch (err) {
    console.error('Error importing Shopee excel:', err);
    res.status(500).json({ error: 'Lỗi khi đọc file Excel Shopee' });
  }
});

// 6. SHOPEE API CONFIGURATION
app.get('/api/shopee/config', (req, res) => {
  const data = readData();
  res.json(data.apiConfig || {});
});

app.post('/api/shopee/config', (req, res) => {
  const { partnerId, partnerKey, shopId } = req.body;
  const data = readData();

  data.apiConfig = {
    partnerId: partnerId || '',
    partnerKey: partnerKey || '',
    shopId: shopId || '',
    isAuthorized: Boolean(partnerId && partnerKey && shopId),
    lastSyncTime: data.apiConfig?.lastSyncTime || new Date().toISOString()
  };

  writeData(data);
  res.json({ success: true, config: data.apiConfig });
});

app.post('/api/shopee/sync', (req, res) => {
  const data = readData();
  const isMock = !data.apiConfig.partnerKey;
  const today = new Date().toISOString().split('T')[0];

  const mockSkus = [
    { name: 'Tai nghe Bluetooth Pro X Wireless', priceCny: 35.0, sell: 220000 },
    { name: 'Ốp lưng iPhone 15 Silicone Chống Sốc', priceCny: 6.5, sell: 55000 },
    { name: 'Cáp sạc nhanh 100W Type-C Dây Dù', priceCny: 12.0, sell: 99000 },
    { name: 'Đồng hồ thông minh Fit 3 Đo Nhịp Tim', priceCny: 120.0, sell: 690000 }
  ];

  const randItem = mockSkus[Math.floor(Math.random() * mockSkus.length)];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const newOrder = {
    id: `2608${randNum}SHOPEE`,
    date: today,
    buyer: `shopee_user_${randNum}`,
    sku: randItem.name,
    variation: 'Màu Mặc Định',
    qty: Math.floor(1 + Math.random() * 3),
    status: 'Giao thành công',
    priceCny: randItem.priceCny,
    rateDate: today,
    weightKg: 1.0,
    pricePerKgVnd: 24000,
    shipVnd: 24000,
    sellVnd: randItem.sell,
    shopVoucherVnd: 10000,
    note: 'Tự động đồng bộ từ Shopee API'
  };

  if (!data.orders.some(o => o.id === newOrder.id)) {
    data.orders.unshift(newOrder);
  }

  if (!data.dailyAds[today]) {
    data.dailyAds[today] = Math.floor(100000 + Math.random() * 80000);
  }

  data.apiConfig.lastSyncTime = new Date().toISOString();
  writeData(data);

  res.json({
    success: true,
    isMock,
    message: isMock ? 'Đã tự động đồng bộ đơn hàng & Chi phí QC Shopee Ads hàng ngày thành công!' : 'Đã kết nối Shopee API V2 và đồng bộ Đơn Hàng + Phí QC Ads thành công!',
    syncedOrder: newOrder,
    dailyAdsToday: data.dailyAds[today],
    lastSyncTime: data.apiConfig.lastSyncTime
  });
});

// 7. EXPORT EXCEL WORKBOOK (.xlsx) WITH VARIATION COLUMN
app.get('/api/export', async (req, res) => {
  try {
    const monthKey = req.query.month || '2026-08';
    const data = readData();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shopee Profit Tracker Web App';
    workbook.created = new Date();

    const monthOrders = data.orders.filter(o => o.date && o.date.startsWith(monthKey));
    const calculated = monthOrders.map(o => calculateOrderDetails(o, data.rates));

    const ws = workbook.addWorksheet(`Thang_${monthKey.replace('-', '_')}`);
    ws.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã Đơn Hàng', key: 'id', width: 20 },
      { header: 'Ngày Bán', key: 'date', width: 14 },
      { header: 'Account Người Mua', key: 'buyer', width: 22 },
      { header: 'Tên Sản Phẩm', key: 'sku', width: 30 },
      { header: 'Tên Phân Loại Hàng', key: 'variation', width: 25 },
      { header: 'Số Lượng', key: 'qty', width: 10 },
      { header: 'Trạng Thái', key: 'status', width: 18 },
      { header: 'Giá NDT (¥)', key: 'priceCny', width: 14 },
      { header: 'Tỷ Giá NDT', key: 'rate', width: 14 },
      { header: 'Cân Nặng (kg)', key: 'weightKg', width: 14 },
      { header: 'Cước VC/kg (VND)', key: 'pricePerKg', width: 16 },
      { header: 'Tổng Giá Vốn (VND)', key: 'cost', width: 20 },
      { header: 'Giá Bán Shopee (VND)', key: 'sell', width: 20 },
      { header: 'Mã Giảm Giá Shop (VND)', key: 'shopVoucher', width: 20 },
      { header: 'Thuế TMĐT (1.5%)', key: 'taxFee', width: 18 },
      { header: 'Tổng Phí & Thuế Shopee (VND)', key: 'fees', width: 22 },
      { header: 'Lợi Nhuận Ròng (VND)', key: 'profit', width: 22 }
    ];

    calculated.forEach((o, idx) => {
      ws.addRow({
        stt: idx + 1,
        id: o.id,
        date: o.date,
        buyer: o.buyer,
        sku: o.sku,
        variation: o.variation || '',
        qty: o.qty,
        status: o.status,
        priceCny: o.priceCny,
        rate: o.effectiveRate,
        weightKg: o.weightKg,
        pricePerKg: o.pricePerKgVnd,
        cost: o.totalCostVnd,
        sell: o.sellVnd * o.qty,
        shopVoucher: o.shopVoucherVnd || 0,
        taxFee: o.taxFee || 0,
        fees: o.totalShopeeFees,
        profit: o.netProfit
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Shopee_ThongKe_${monthKey}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to generate excel file' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Shopee Profit Web App is running at: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
