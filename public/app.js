document.addEventListener('DOMContentLoaded', () => {
  // APP STATE
  let currentMonth = '2026-08';
  let currentStatusFilter = 'all';
  let currentSearchQuery = '';
  let editingOrderId = null;

  // DOM ELEMENTS
  const monthSelect = document.getElementById('monthSelect');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const btnSyncShopee = document.getElementById('btnSyncShopee');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnImportShopeeExcel = document.getElementById('btnImportShopeeExcel');
  const shopeeFileInput = document.getElementById('shopeeFileInput');

  const btnSaveAds = document.getElementById('btnSaveAds');
  const adsCostInput = document.getElementById('adsCostInput');

  // KPI Elements
  const kpiOrdersCount = document.getElementById('kpiOrdersCount');
  const kpiItemsSold = document.getElementById('kpiItemsSold');
  const kpiRevenue = document.getElementById('kpiRevenue');
  const kpiCost = document.getElementById('kpiCost');
  const kpiFees = document.getElementById('kpiFees');
  const kpiFinalProfit = document.getElementById('kpiFinalProfit');
  const kpiMargin = document.getElementById('kpiMargin');
  const monthTitleBadge = document.getElementById('monthTitleBadge');
  const dailyStatsBody = document.getElementById('dailyStatsBody');

  // Orders Elements
  const tabOrderCount = document.getElementById('tabOrderCount');
  const orderSearchInput = document.getElementById('orderSearchInput');
  const filterPills = document.querySelectorAll('.pill');
  const ordersTableBody = document.getElementById('ordersTableBody');
  const btnOpenAddOrderModal = document.getElementById('btnOpenAddOrderModal');

  // Modals
  const orderModal = document.getElementById('orderModal');
  const btnCloseOrderModal = document.getElementById('btnCloseOrderModal');
  const btnCancelOrderModal = document.getElementById('btnCancelOrderModal');
  const orderForm = document.getElementById('orderForm');
  const orderModalTitle = document.getElementById('orderModalTitle');

  // Freight calculation elements
  const orderWeightKg = document.getElementById('orderWeightKg');
  const orderPricePerKgVnd = document.getElementById('orderPricePerKgVnd');
  const orderShipVnd = document.getElementById('orderShipVnd');

  function updateFreightTotal() {
    const kg = Number(orderWeightKg.value) || 0;
    const ratePerKg = Number(orderPricePerKgVnd.value) || 0;
    orderShipVnd.value = Math.round(kg * ratePerKg);
  }

  orderWeightKg.addEventListener('input', updateFreightTotal);
  orderPricePerKgVnd.addEventListener('input', updateFreightTotal);

  // Rates Elements
  const ratesTableBody = document.getElementById('ratesTableBody');
  const btnOpenAddRateModal = document.getElementById('btnOpenAddRateModal');
  const rateModal = document.getElementById('rateModal');
  const btnCloseRateModal = document.getElementById('btnCloseRateModal');
  const btnCancelRateModal = document.getElementById('btnCancelRateModal');
  const rateForm = document.getElementById('rateForm');

  // API Config Elements
  const apiConfigForm = document.getElementById('apiConfigForm');
  const apiStatusBadge = document.getElementById('apiStatusBadge');

  // --------------------------------------------------
  // FORMATTING HELPERS
  // --------------------------------------------------
  function formatVnd(val) {
    if (val === undefined || val === null || isNaN(val)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' đ';
  }

  function formatCny(val) {
    if (val === undefined || val === null || isNaN(val)) return '¥0.00';
    return '¥' + Number(val).toFixed(2);
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'Giao thành công':
        return `<span class="badge badge-success">🟢 Giao thành công</span>`;
      case 'Chờ giao hàng':
        return `<span class="badge badge-info" style="background:#E0F2FE; color:#0369A1;">🔵 Chờ giao hàng</span>`;
      case 'Đang vận chuyển':
        return `<span class="badge badge-info">🚚 Đang vận chuyển</span>`;
      case 'Đã hủy':
        return `<span class="badge badge-danger">🔴 Đã hủy</span>`;
      case 'Trả hàng/Hoàn tiền':
        return `<span class="badge badge-warning">🟡 Trả hàng/Hoàn tiền</span>`;
      default:
        return `<span class="badge badge-info">${status}</span>`;
    }
  }

  // --------------------------------------------------
  // INITIALIZATION & EVENT LISTENERS
  // --------------------------------------------------
  monthSelect.addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadDashboard();
    loadOrders();
    loadRates();
  });

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');

      if (tab.dataset.tab === 'orders') loadOrders();
      if (tab.dataset.tab === 'rates') loadRates();
      if (tab.dataset.tab === 'apiconfig') loadApiConfig();
    });
  });

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStatusFilter = pill.dataset.status;
      loadOrders();
    });
  });

  orderSearchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim();
    loadOrders();
  });

  btnExportExcel.addEventListener('click', () => {
    window.location.href = `/api/export?month=${currentMonth}`;
  });

  // --------------------------------------------------
  // IMPORT SHOPEE EXPORT EXCEL FILE (.xlsx) WITH SEAMLESS STATUS UPDATE
  // --------------------------------------------------
  btnImportShopeeExcel.addEventListener('click', () => {
    shopeeFileInput.click();
  });

  shopeeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    btnImportShopeeExcel.disabled = true;
    btnImportShopeeExcel.innerHTML = '⏳ Đang nạp file...';

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64Data = evt.target.result.split(',')[1];
        const res = await fetch('/api/import-shopee-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data, clearAll: false })
        });
        const result = await res.json();

        if (result.success) {
          alert(result.message);
          loadDashboard();
          loadOrders();
        } else {
          alert('Lỗi: ' + (result.error || 'Không đọc được file'));
        }
        btnImportShopeeExcel.disabled = false;
        btnImportShopeeExcel.innerHTML = '📤 Import Shopee Excel';
        shopeeFileInput.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Lỗi khi nạp file Shopee Excel');
      btnImportShopeeExcel.disabled = false;
      btnImportShopeeExcel.innerHTML = '📤 Import Shopee Excel';
      shopeeFileInput.value = '';
    }
  });

  // Shopee API Sync
  btnSyncShopee.addEventListener('click', async () => {
    btnSyncShopee.disabled = true;
    btnSyncShopee.innerHTML = '🔄 Đang đồng bộ...';

    try {
      const res = await fetch('/api/shopee/sync', { method: 'POST' });
      const result = await res.json();
      alert(result.message);
      loadDashboard();
      loadOrders();
    } catch (err) {
      alert('Lỗi kết nối khi đồng bộ API Shopee');
    } finally {
      btnSyncShopee.disabled = false;
      btnSyncShopee.innerHTML = '🔄 Đồng Bộ Shopee API';
    }
  });

  btnSaveAds.addEventListener('click', async () => {
    const cost = Number(adsCostInput.value) || 0;
    try {
      await fetch('/api/ads-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey: currentMonth, adsCost: cost })
      });
      alert('Đã lưu Chi phí Quảng Cáo Shopee Ads Tháng!');
      loadDashboard();
    } catch (err) {
      alert('Lỗi khi lưu chi phí QC');
    }
  });

  // --------------------------------------------------
  // DASHBOARD LOADING & RENDERING
  // --------------------------------------------------
  async function loadDashboard() {
    try {
      const res = await fetch(`/api/dashboard?month=${currentMonth}`);
      const data = await res.json();

      kpiOrdersCount.textContent = `${data.completedCount} / ${data.totalOrdersCount} đơn`;
      kpiItemsSold.textContent = `${data.totalItemsSold} sản phẩm bán ra`;
      kpiRevenue.textContent = formatVnd(data.totalRevenue);
      kpiCost.textContent = formatVnd(data.totalCost);
      kpiFees.textContent = formatVnd(data.totalShopeeFees);
      adsCostInput.value = data.adsCost;
      kpiFinalProfit.textContent = formatVnd(data.finalNetProfit);
      kpiMargin.textContent = `${data.profitMargin}%`;

      const mParts = currentMonth.split('-');
      monthTitleBadge.textContent = `Tháng ${mParts[1]}/${mParts[0]}`;

      dailyStatsBody.innerHTML = '';
      if (!data.dailyStats || data.dailyStats.length === 0) {
        dailyStatsBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">Chưa có dữ liệu thống kê ngày</td></tr>`;
        return;
      }

      data.dailyStats.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center font-bold">${d.dayDisplay}</td>
          <td class="text-center font-bold">${d.count}</td>
          <td class="text-center">${d.qty}</td>
          <td class="text-right font-bold text-muted">${d.rate ? formatVnd(d.rate) : 'Chưa nhập'}</td>
          <td class="text-right">${formatVnd(d.revenue)}</td>
          <td class="text-right">${formatVnd(d.cost)}</td>
          <td class="text-right">${formatVnd(d.fees)}</td>
          <td class="text-right font-bold text-danger">
            <span class="daily-ads-val" data-date="${d.date}">${formatVnd(d.adsCost)}</span>
          </td>
          <td class="text-right font-bold ${d.finalProfit >= 0 ? 'text-success' : 'text-danger'}">${formatVnd(d.finalProfit)}</td>
          <td class="text-center">${d.margin}%</td>
        `;
        dailyStatsBody.appendChild(tr);
      });

      document.querySelectorAll('.daily-ads-val').forEach(el => {
        el.style.cursor = 'pointer';
        el.title = 'Nhấn để sửa nhanh Phí QC Ads của ngày này';
        el.addEventListener('click', async () => {
          const dateStr = el.dataset.date;
          const currentVal = el.textContent.replace(/[^0-9]/g, '');
          const newVal = prompt(`Nhập Phí QC Shopee Ads ngày ${dateStr} (VND):`, currentVal);
          if (newVal !== null && !isNaN(newVal)) {
            await fetch('/api/daily-ads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: dateStr, adsCost: Number(newVal) })
            });
            loadDashboard();
          }
        });
      });
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  }

  // --------------------------------------------------
  // ORDERS LOADING & MANAGEMENT WITH LIVE STATUS COUNTS
  // --------------------------------------------------
  async function loadOrders() {
    try {
      const url = `/api/orders?month=${currentMonth}&status=${currentStatusFilter}&search=${encodeURIComponent(currentSearchQuery)}`;
      const res = await fetch(url);
      const resData = await res.json();

      const orders = Array.isArray(resData) ? resData : (resData.orders || []);
      const counts = resData.statusCounts || {};

      // UPDATE STATUS FILTER BADGE COUNTS
      filterPills.forEach(pill => {
        const st = pill.dataset.status;
        if (st === 'all') pill.textContent = `Tất cả (${counts.all || orders.length})`;
        else if (st === 'Giao thành công') pill.textContent = `🟢 Giao thành công (${counts.completed || 0})`;
        else if (st === 'Chờ giao hàng') pill.textContent = `🔵 Chờ giao hàng (${counts.pending || 0})`;
        else if (st === 'Đang vận chuyển') pill.textContent = `🚚 Đang vận chuyển (${counts.shipping || 0})`;
        else if (st === 'Đã hủy') pill.textContent = `🔴 Đã hủy (${counts.cancelled || 0})`;
        else if (st === 'Trả hàng/Hoàn tiền') pill.textContent = `🟡 Trả hàng/Hoàn tiền (${counts.refunded || 0})`;
      });

      tabOrderCount.textContent = counts.all !== undefined ? counts.all : orders.length;
      ordersTableBody.innerHTML = '';

      if (orders.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="18" class="text-center text-muted">Không tìm thấy đơn hàng nào</td></tr>`;
        return;
      }

      orders.forEach((o, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center">${idx + 1}</td>
          <td class="text-center font-bold">${o.id}</td>
          <td class="text-center">${o.date}</td>
          <td class="font-bold">${o.buyer}</td>
          <td>${o.sku}</td>
          <td style="color: #94A3B8; font-size: 0.82rem;">${o.variation || '-'}</td>
          <td class="text-center font-bold">${o.qty}</td>
          <td class="text-center">${getStatusBadge(o.status)}</td>
          <td class="text-right">${formatCny(o.priceCny)}</td>
          <td class="text-right font-bold">${formatVnd(o.effectiveRate)}</td>
          <td class="text-right font-bold">${formatVnd(o.totalCostVnd)}</td>
          <td class="text-right">${formatVnd(o.sellVnd * o.qty)}</td>
          <td class="text-right text-danger">${formatVnd(o.shopVoucherVnd || 0)}</td>
          <td class="text-right text-warning">${formatVnd(o.taxFee || 0)}</td>
          <td class="text-right">${formatVnd(o.totalShopeeFees)}</td>
          <td class="text-right font-bold">${formatVnd(o.netRevenue)}</td>
          <td class="text-right font-bold ${o.netProfit >= 0 ? 'text-success' : 'text-danger'}">${formatVnd(o.netProfit)}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-secondary btn-edit-order" data-id="${o.id}">Sửa</button>
            <button class="btn btn-sm btn-danger btn-delete-order" data-id="${o.id}">Xóa</button>
          </td>
        `;
        ordersTableBody.appendChild(tr);
      });

      document.querySelectorAll('.btn-edit-order').forEach(b => {
        b.addEventListener('click', () => openEditOrderModal(b.dataset.id));
      });
      document.querySelectorAll('.btn-delete-order').forEach(b => {
        b.addEventListener('click', () => deleteOrder(b.dataset.id));
      });
    } catch (err) {
      console.error('Error loading orders:', err);
    }
  }

  btnOpenAddOrderModal.addEventListener('click', () => {
    editingOrderId = null;
    orderModalTitle.textContent = 'Thêm Đơn Hàng Shopee Mới';
    orderForm.reset();
    document.getElementById('orderId').readOnly = false;
    document.getElementById('orderDate').value = `${currentMonth}-01`;
    document.getElementById('orderRateDate').value = `${currentMonth}-01`;
    document.getElementById('orderShopVoucherVnd').value = 0;
    document.getElementById('orderVariation').value = '';
    orderWeightKg.value = 1.0;
    orderPricePerKgVnd.value = 24000;
    updateFreightTotal();
    orderModal.classList.add('active');
  });

  function closeOrderModal() {
    orderModal.classList.remove('active');
  }
  btnCloseOrderModal.addEventListener('click', closeOrderModal);
  btnCancelOrderModal.addEventListener('click', closeOrderModal);

  async function openEditOrderModal(id) {
    try {
      const res = await fetch(`/api/orders?month=${currentMonth}&status=all&search=${id}`);
      const resData = await res.json();
      const orders = Array.isArray(resData) ? resData : (resData.orders || []);
      const order = orders.find(o => o.id === id);
      if (!order) return;

      editingOrderId = id;
      orderModalTitle.textContent = `Chỉnh Sửa Đơn Hàng ${id}`;
      document.getElementById('orderId').value = order.id;
      document.getElementById('orderId').readOnly = true;
      document.getElementById('orderDate').value = order.date;
      document.getElementById('orderBuyer').value = order.buyer;
      document.getElementById('orderSku').value = order.sku;
      document.getElementById('orderVariation').value = order.variation || '';
      document.getElementById('orderQty').value = order.qty;
      document.getElementById('orderStatus').value = order.status;
      document.getElementById('orderPriceCny').value = order.priceCny;
      document.getElementById('orderRateDate').value = order.rateDate || order.date;
      
      orderWeightKg.value = order.weightKg !== undefined ? order.weightKg : 5.0;
      orderPricePerKgVnd.value = order.pricePerKgVnd !== undefined ? order.pricePerKgVnd : 24000;
      updateFreightTotal();

      document.getElementById('orderSellVnd').value = order.sellVnd;
      document.getElementById('orderShopVoucherVnd').value = order.shopVoucherVnd || 0;
      document.getElementById('orderNote').value = order.note || '';

      orderModal.classList.add('active');
    } catch (err) {
      alert('Lỗi tải thông tin đơn hàng');
    }
  }

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderData = {
      id: document.getElementById('orderId').value.trim(),
      date: document.getElementById('orderDate').value,
      buyer: document.getElementById('orderBuyer').value.trim(),
      sku: document.getElementById('orderSku').value.trim(),
      variation: document.getElementById('orderVariation').value.trim(),
      qty: Number(document.getElementById('orderQty').value) || 1,
      status: document.getElementById('orderStatus').value,
      priceCny: Number(document.getElementById('orderPriceCny').value) || 0,
      rateDate: document.getElementById('orderRateDate').value,
      weightKg: Number(orderWeightKg.value) || 0,
      pricePerKgVnd: Number(orderPricePerKgVnd.value) || 0,
      shipVnd: Number(orderShipVnd.value) || 0,
      sellVnd: Number(document.getElementById('orderSellVnd').value) || 0,
      shopVoucherVnd: Number(document.getElementById('orderShopVoucherVnd').value) || 0,
      note: document.getElementById('orderNote').value.trim()
    };

    try {
      const method = editingOrderId ? 'PUT' : 'POST';
      const url = editingOrderId ? `/api/orders/${editingOrderId}` : '/api/orders';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      closeOrderModal();
      loadDashboard();
      loadOrders();
    } catch (err) {
      alert('Lỗi khi lưu đơn hàng');
    }
  });

  async function deleteOrder(id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${id}?`)) return;
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      loadDashboard();
      loadOrders();
    } catch (err) {
      alert('Lỗi khi xóa đơn hàng');
    }
  }

  // --------------------------------------------------
  // NDT RATES MANAGEMENT
  // --------------------------------------------------
  async function loadRates() {
    try {
      const res = await fetch(`/api/rates?month=${currentMonth}`);
      const rates = await res.json();

      ratesTableBody.innerHTML = '';
      if (rates.length === 0) {
        ratesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Chưa có tỷ giá nào do bạn tự nhập trong tháng này</td></tr>`;
        return;
      }

      rates.forEach(r => {
        const effective = Math.round(r.baseRate * (1 + (r.feePercent || 0) / 100));
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center font-bold">${r.date}</td>
          <td class="text-right font-bold">${formatVnd(r.baseRate)}</td>
          <td class="text-center">${r.feePercent || 0}%</td>
          <td class="text-right font-bold text-success">${formatVnd(effective)}</td>
          <td>${r.source || 'Tự nhập'}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-secondary btn-edit-rate" data-date="${r.date}" data-base="${r.baseRate}" data-fee="${r.feePercent || 0}" data-source="${r.source || ''}">Sửa</button>
          </td>
        `;
        ratesTableBody.appendChild(tr);
      });

      document.querySelectorAll('.btn-edit-rate').forEach(b => {
        b.addEventListener('click', () => {
          document.getElementById('rateDateInput').value = b.dataset.date;
          document.getElementById('rateBaseInput').value = b.dataset.base;
          document.getElementById('rateFeeInput').value = b.dataset.fee;
          document.getElementById('rateSourceInput').value = b.dataset.source;
          rateModal.classList.add('active');
        });
      });
    } catch (err) {
      console.error('Error loading rates:', err);
    }
  }

  btnOpenAddRateModal.addEventListener('click', () => {
    rateForm.reset();
    document.getElementById('rateDateInput').value = `${currentMonth}-01`;
    rateModal.classList.add('active');
  });

  function closeRateModal() {
    rateModal.classList.remove('active');
  }
  btnCloseRateModal.addEventListener('click', closeRateModal);
  btnCancelRateModal.addEventListener('click', closeRateModal);

  rateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rateData = {
      date: document.getElementById('rateDateInput').value,
      baseRate: Number(document.getElementById('rateBaseInput').value) || 0,
      feePercent: Number(document.getElementById('rateFeeInput').value) || 0,
      source: document.getElementById('rateSourceInput').value.trim()
    };

    try {
      await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateData)
      });
      closeRateModal();
      loadRates();
      loadDashboard();
      loadOrders();
    } catch (err) {
      alert('Lỗi khi lưu tỷ giá');
    }
  });

  // --------------------------------------------------
  // SHOPEE API CONFIGURATION
  // --------------------------------------------------
  async function loadApiConfig() {
    try {
      const res = await fetch('/api/shopee/config');
      const config = await res.json();

      document.getElementById('partnerId').value = config.partnerId || '';
      document.getElementById('partnerKey').value = config.partnerKey || '';
      document.getElementById('shopId').value = config.shopId || '';

      if (config.isAuthorized) {
        apiStatusBadge.className = 'badge badge-success';
        apiStatusBadge.textContent = '🟢 Đã Kết Nối API Shopee Chính Thức';
      } else {
        apiStatusBadge.className = 'badge badge-warning';
        apiStatusBadge.textContent = '🟡 Chưa Kết Nối (Đang Dùng Mock API Engine)';
      }
    } catch (err) {
      console.error('Error loading API config:', err);
    }
  }

  apiConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const configData = {
      partnerId: document.getElementById('partnerId').value.trim(),
      partnerKey: document.getElementById('partnerKey').value.trim(),
      shopId: document.getElementById('shopId').value.trim()
    };

    try {
      await fetch('/api/shopee/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      alert('Đã lưu cấu hình Shopee API!');
      loadApiConfig();
    } catch (err) {
      alert('Lỗi lưu cấu hình API');
    }
  });

  // INITIAL LOAD
  loadDashboard();
  loadOrders();
});
