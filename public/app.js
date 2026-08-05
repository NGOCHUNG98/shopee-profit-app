// SHOPEE PROFIT TRACKER WEB APP - CLIENT JS ENGINE
document.addEventListener('DOMContentLoaded', () => {

  // STATE MANAGEMENT
  let currentMonth = '2026-08';
  let currentStatusFilter = 'all';
  let currentSearchQuery = '';

  // DOM ELEMENTS
  const monthSelect = document.getElementById('monthSelect');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const kpiOrdersCount = document.getElementById('kpiOrdersCount');
  const kpiItemsSold = document.getElementById('kpiItemsSold');
  const kpiRevenue = document.getElementById('kpiRevenue');
  const kpiCost = document.getElementById('kpiCost');
  const kpiFees = document.getElementById('kpiFees');
  const adsCostInput = document.getElementById('adsCostInput');
  const btnSaveAds = document.getElementById('btnSaveAds');
  const kpiFinalProfit = document.getElementById('kpiFinalProfit');
  const kpiMargin = document.getElementById('kpiMargin');
  const monthTitleBadge = document.getElementById('monthTitleBadge');
  const dailyStatsBody = document.getElementById('dailyStatsBody');

  const tabOrderCount = document.getElementById('tabOrderCount');
  const filterPills = document.querySelectorAll('.pill');
  const orderSearchInput = document.getElementById('orderSearchInput');
  const ordersTableBody = document.getElementById('ordersTableBody');
  const btnOpenAddOrderModal = document.getElementById('btnOpenAddOrderModal');

  const orderModal = document.getElementById('orderModal');
  const orderModalTitle = document.getElementById('orderModalTitle');
  const btnCloseOrderModal = document.getElementById('btnCloseOrderModal');
  const btnCancelOrderModal = document.getElementById('btnCancelOrderModal');
  const orderForm = document.getElementById('orderForm');

  const ratesTableBody = document.getElementById('ratesTableBody');
  const btnOpenAddRateModal = document.getElementById('btnOpenAddRateModal');
  const rateModal = document.getElementById('rateModal');
  const btnCloseRateModal = document.getElementById('btnCloseRateModal');
  const btnCancelRateModal = document.getElementById('btnCancelRateModal');
  const rateForm = document.getElementById('rateForm');

  const shopeeFileInput = document.getElementById('shopeeFileInput');
  const btnImportShopeeExcel = document.getElementById('btnImportShopeeExcel');
  const btnSyncShopee = document.getElementById('btnSyncShopee');
  const btnExportExcel = document.getElementById('btnExportExcel');

  const apiConfigForm = document.getElementById('apiConfigForm');
  const apiStatusBadge = document.getElementById('apiStatusBadge');

  let isEditingOrder = false;
  let editingOrderId = null;

  // FORMATTERS
  function formatVnd(val) {
    if (val === undefined || val === null || isNaN(val)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  }

  function formatNumber(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return new Intl.NumberFormat('vi-VN').format(val);
  }

  // EVENT: MONTH SELECT
  monthSelect.value = currentMonth;
  monthSelect.addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadDashboard();
    loadOrders();
    loadRates();
  });

  // EVENT: NAVIGATION TABS
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');

      if (tab.dataset.tab === 'dashboard') loadDashboard();
      if (tab.dataset.tab === 'orders') loadOrders();
      if (tab.dataset.tab === 'rates') loadRates();
      if (tab.dataset.tab === 'apiconfig') loadApiConfig();
    });
  });

  // --------------------------------------------------
  // DASHBOARD LOADING
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
      adsCostInput.value = data.adsCost || 0;
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
  // ORDERS LOADING & MANAGEMENT WITH LIVE STATUS COUNTS AND INLINE EDITING
  // --------------------------------------------------
  async function loadOrders() {
    try {
      const url = `/api/orders?month=${currentMonth}&status=${currentStatusFilter}&search=${encodeURIComponent(currentSearchQuery)}`;
      const res = await fetch(url);
      const resData = await res.json();

      const orders = Array.isArray(resData) ? resData : (resData.orders || []);
      const counts = resData.statusCounts || { all: orders.length, completed: 0, pending: 0, shipping: 0, cancelled: 0, refunded: 0 };

      tabOrderCount.textContent = counts.all;

      filterPills.forEach(pill => {
        const statusKey = pill.dataset.status;
        if (statusKey === 'all') pill.textContent = `Tất cả (${counts.all})`;
        if (statusKey === 'Giao thành công') pill.textContent = `🟢 Giao thành công (${counts.completed})`;
        if (statusKey === 'Chờ giao hàng') pill.textContent = `🔵 Chờ giao hàng (${counts.pending})`;
        if (statusKey === 'Đang vận chuyển') pill.textContent = `🚚 Đang vận chuyển (${counts.shipping})`;
        if (statusKey === 'Đã hủy') pill.textContent = `🔴 Đã hủy (${counts.cancelled})`;
        if (statusKey === 'Trả hàng/Hoàn tiền') pill.textContent = `🟡 Trả hàng/Hoàn tiền (${counts.refunded})`;
      });

      ordersTableBody.innerHTML = '';
      if (orders.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="19" class="text-center text-muted">Không tìm thấy đơn hàng nào</td></tr>`;
        return;
      }

      orders.forEach((o, index) => {
        let statusBadge = `<span class="badge badge-success">🟢 Giao thành công</span>`;
        if (o.status === 'Chờ giao hàng') statusBadge = `<span class="badge badge-info">🔵 Chờ giao hàng</span>`;
        if (o.status === 'Đang vận chuyển') statusBadge = `<span class="badge badge-warning">🚚 Đang vận chuyển</span>`;
        if (o.status === 'Đã hủy') statusBadge = `<span class="badge badge-danger">🔴 Đã hủy</span>`;
        if (o.status === 'Trả hàng/Hoàn tiền') statusBadge = `<span class="badge badge-warning">🟡 Trả hàng/Hoàn tiền</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td class="text-center font-bold text-primary">${o.id}</td>
          <td class="text-center">${o.date}</td>
          <td>${o.buyer}</td>
          <td class="font-medium">${o.sku}</td>
          <td class="font-medium text-muted">${o.variation || '-'}</td>
          <td class="text-center font-bold">${o.qty}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-right font-bold editable-cell inline-edit-cny" data-id="${o.id}" data-val="${o.priceCny}" title="Click để sửa nhanh Giá Vốn NDT">¥${formatNumber(o.priceCny)} ✏️</td>
          <td class="text-right font-bold editable-cell inline-edit-weight" data-id="${o.id}" data-val="${o.weightKg || 1.0}" title="Click để sửa nhanh Trọng Lượng Kg">${o.weightKg || 1.0} kg ✏️</td>
          <td class="text-right text-muted">${formatVnd(o.effectiveRate)}</td>
          <td class="text-right font-bold text-orange">${formatVnd(o.totalCostVnd)}</td>
          <td class="text-right">${formatVnd(o.sellVnd * o.qty)}</td>
          <td class="text-right text-danger">${o.shopVoucherVnd ? formatVnd(o.shopVoucherVnd) : '-'}</td>
          <td class="text-right text-warning">${formatVnd(o.taxFee)}</td>
          <td class="text-right text-purple">${formatVnd(o.totalShopeeFees)}</td>
          <td class="text-right font-bold">${formatVnd(o.netRevenue)}</td>
          <td class="text-right font-bold ${o.netProfit >= 0 ? 'text-success' : 'text-danger'}">${formatVnd(o.netProfit)}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-secondary btn-edit-order" data-id="${o.id}">Sửa</button>
            <button class="btn btn-sm btn-danger btn-delete-order" data-id="${o.id}">Xóa</button>
          </td>
        `;
        ordersTableBody.appendChild(tr);
      });

      // ATTACH INLINE EDIT LISTENERS FOR CNY PRICE AND WEIGHT KG
      document.querySelectorAll('.inline-edit-cny').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cell.querySelector('input')) return;

          const orderId = cell.dataset.id;
          const currentVal = cell.dataset.val;

          const input = document.createElement('input');
          input.type = 'number';
          input.step = 'any';
          input.className = 'inline-input';
          input.value = currentVal;

          cell.innerHTML = '';
          cell.appendChild(input);
          input.focus();
          input.select();

          let isSaved = false;
          async function saveInlineCny() {
            if (isSaved) return;
            isSaved = true;
            const newVal = Number(input.value);
            if (!isNaN(newVal) && newVal >= 0) {
              try {
                const targetOrder = orders.find(x => x.id === orderId);
                if (targetOrder) {
                  await fetch(`/api/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...targetOrder, priceCny: newVal })
                  });
                  loadOrders();
                  loadDashboard();
                }
              } catch (err) {
                console.error('Error saving inline CNY price:', err);
              }
            } else {
              loadOrders();
            }
          }

          input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
              evt.preventDefault();
              saveInlineCny();
            } else if (evt.key === 'Escape') {
              isSaved = true;
              loadOrders();
            }
          });

          input.addEventListener('blur', () => {
            saveInlineCny();
          });
        });
      });

      document.querySelectorAll('.inline-edit-weight').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cell.querySelector('input')) return;

          const orderId = cell.dataset.id;
          const currentVal = cell.dataset.val;

          const input = document.createElement('input');
          input.type = 'number';
          input.step = 'any';
          input.className = 'inline-input';
          input.value = currentVal;

          cell.innerHTML = '';
          cell.appendChild(input);
          input.focus();
          input.select();

          let isSaved = false;
          async function saveInlineWeight() {
            if (isSaved) return;
            isSaved = true;
            const newVal = Number(input.value);
            if (!isNaN(newVal) && newVal >= 0) {
              try {
                const targetOrder = orders.find(x => x.id === orderId);
                if (targetOrder) {
                  const pricePerKg = targetOrder.pricePerKgVnd || 24000;
                  const newShipVnd = Math.round(newVal * pricePerKg);
                  await fetch(`/api/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...targetOrder, weightKg: newVal, shipVnd: newShipVnd })
                  });
                  loadOrders();
                  loadDashboard();
                }
              } catch (err) {
                console.error('Error saving inline weight:', err);
              }
            } else {
              loadOrders();
            }
          }

          input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
              evt.preventDefault();
              saveInlineWeight();
            } else if (evt.key === 'Escape') {
              isSaved = true;
              loadOrders();
            }
          });

          input.addEventListener('blur', () => {
            saveInlineWeight();
          });
        });
      });

      document.querySelectorAll('.btn-edit-order').forEach(btn => {
        btn.addEventListener('click', () => openEditOrderModal(btn.dataset.id, orders));
      });
      document.querySelectorAll('.btn-delete-order').forEach(btn => {
        btn.addEventListener('click', () => deleteOrder(btn.dataset.id));
      });
    } catch (err) {
      console.error('Error loading orders:', err);
    }
  }

  filterPills.forEach(p => {
    p.addEventListener('click', () => {
      filterPills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      currentStatusFilter = p.dataset.status;
      loadOrders();
    });
  });

  orderSearchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    loadOrders();
  });

  // AUTO CALCULATE SHIP COST IN MODAL BASED ON WEIGHT & RATE PER KG
  const orderWeightInput = document.getElementById('orderWeightKg');
  const orderPricePerKgInput = document.getElementById('orderPricePerKgVnd');
  const orderShipInput = document.getElementById('orderShipVnd');

  function updateModalShipCost() {
    const w = Number(orderWeightInput.value) || 0;
    const p = Number(orderPricePerKgInput.value) || 24000;
    orderShipInput.value = Math.round(w * p);
  }

  orderWeightInput.addEventListener('input', updateModalShipCost);
  orderPricePerKgInput.addEventListener('input', updateModalShipCost);

  // ORDER MODAL HANDLERS
  btnOpenAddOrderModal.addEventListener('click', () => {
    isEditingOrder = false;
    editingOrderId = null;
    orderModalTitle.textContent = 'Thêm Đơn Hàng Shopee Mới';
    document.getElementById('orderId').readOnly = false;
    orderForm.reset();
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('orderRateDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('orderWeightKg').value = '1.0';
    document.getElementById('orderPricePerKgVnd').value = '24000';
    updateModalShipCost();
    orderModal.classList.add('active');
  });

  function closeOrderModal() {
    orderModal.classList.remove('active');
  }
  btnCloseOrderModal.addEventListener('click', closeOrderModal);
  btnCancelOrderModal.addEventListener('click', closeOrderModal);

  function openEditOrderModal(orderId, orders) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;

    isEditingOrder = true;
    editingOrderId = orderId;
    orderModalTitle.textContent = `Chỉnh Sửa Đơn Hàng: ${orderId}`;

    document.getElementById('orderId').value = o.id;
    document.getElementById('orderId').readOnly = true;
    document.getElementById('orderDate').value = o.date;
    document.getElementById('orderBuyer').value = o.buyer;
    document.getElementById('orderSku').value = o.sku;
    document.getElementById('orderVariation').value = o.variation || '';
    document.getElementById('orderQty').value = o.qty;
    document.getElementById('orderStatus').value = o.status;
    document.getElementById('orderPriceCny').value = o.priceCny;
    document.getElementById('orderRateDate').value = o.rateDate || o.date;
    document.getElementById('orderWeightKg').value = o.weightKg || 1.0;
    document.getElementById('orderPricePerKgVnd').value = o.pricePerKgVnd || 24000;
    document.getElementById('orderShipVnd').value = o.shipVnd || Math.round((o.weightKg || 1.0) * (o.pricePerKgVnd || 24000));
    document.getElementById('orderSellVnd').value = o.sellVnd;
    document.getElementById('orderShopVoucherVnd').value = o.shopVoucherVnd || 0;
    document.getElementById('orderNote').value = o.note || '';

    orderModal.classList.add('active');
  }

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderData = {
      id: document.getElementById('orderId').value.trim(),
      date: document.getElementById('orderDate').value,
      buyer: document.getElementById('orderBuyer').value.trim(),
      sku: document.getElementById('orderSku').value.trim(),
      variation: document.getElementById('orderVariation').value.trim(),
      qty: Number(document.getElementById('orderQty').value),
      status: document.getElementById('orderStatus').value,
      priceCny: Number(document.getElementById('orderPriceCny').value),
      rateDate: document.getElementById('orderRateDate').value,
      weightKg: Number(document.getElementById('orderWeightKg').value),
      pricePerKgVnd: Number(document.getElementById('orderPricePerKgVnd').value) || 24000,
      shipVnd: Number(document.getElementById('orderShipVnd').value),
      sellVnd: Number(document.getElementById('orderSellVnd').value),
      shopVoucherVnd: Number(document.getElementById('orderShopVoucherVnd').value) || 0,
      note: document.getElementById('orderNote').value.trim()
    };

    try {
      const url = isEditingOrder ? `/api/orders/${editingOrderId}` : '/api/orders';
      const method = isEditingOrder ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        closeOrderModal();
        loadOrders();
        loadDashboard();
      } else {
        alert('Lỗi khi lưu đơn hàng');
      }
    } catch (err) {
      alert('Không thể kết nối đến máy chủ');
    }
  });

  async function deleteOrder(id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${id}?`)) return;
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      loadOrders();
      loadDashboard();
    } catch (err) {
      alert('Lỗi khi xóa đơn hàng');
    }
  }

  // --------------------------------------------------
  // IMPORT SHOPEE EXCEL & SYNC & EXPORT
  // --------------------------------------------------
  btnImportShopeeExcel.addEventListener('click', () => {
    shopeeFileInput.click();
  });

  shopeeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Data = evt.target.result.split(',')[1];
      const clearAll = confirm('Bạn có muốn XÓA TẤT CẢ đơn hàng hiện tại trước khi import file mới không?\n- Chọn OK để Xóa Hết & Import Mới.\n- Chọn Cancel để Nạp Nối Tiếp/Cập Nhật.');

      try {
        btnImportShopeeExcel.disabled = true;
        btnImportShopeeExcel.textContent = '⏳ Đang Xử Lý Excel...';

        const res = await fetch('/api/import-shopee-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data, clearAll })
        });
        const result = await res.json();

        if (result.success) {
          alert(result.message);
          loadDashboard();
          loadOrders();
        } else {
          alert(`Lỗi import: ${result.error}`);
        }
      } catch (err) {
        alert('Không thể đọc file Excel Shopee');
      } finally {
        btnImportShopeeExcel.disabled = false;
        btnImportShopeeExcel.textContent = '📤 Import Shopee Excel';
        shopeeFileInput.value = '';
      }
    };
    reader.readAsDataURL(file);
  });

  btnSyncShopee.addEventListener('click', async () => {
    try {
      btnSyncShopee.disabled = true;
      btnSyncShopee.innerHTML = '<span class="spin-icon">🔄</span> Đang Đồng Bộ API...';

      const res = await fetch('/api/shopee/sync', { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        alert(`${result.message}\nĐã nạp đơn mới ID: ${result.syncedOrder.id}`);
        loadDashboard();
        loadOrders();
      }
    } catch (err) {
      alert('Lỗi đồng bộ Shopee API');
    } finally {
      btnSyncShopee.disabled = false;
      btnSyncShopee.innerHTML = '<span class="spin-icon">🔄</span> Đồng Bộ Shopee API';
    }
  });

  btnExportExcel.addEventListener('click', () => {
    window.location.href = `/api/export?month=${currentMonth}`;
  });

  // --------------------------------------------------
  // RATES MANAGEMENT WITH DATE RANGE SUPPORT
  // --------------------------------------------------
  async function loadRates() {
    try {
      const res = await fetch(`/api/rates?month=${currentMonth}`);
      const rates = await res.json();

      ratesTableBody.innerHTML = '';
      if (!rates || rates.length === 0) {
        ratesTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Chưa có tỷ giá NDT tự nhập cho tháng này</td></tr>`;
        return;
      }

      rates.forEach(r => {
        const effectiveRate = Math.round(r.baseRate * (1 + (r.feePercent || 0) / 100));
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center font-bold">${r.date}</td>
          <td class="text-right">${formatVnd(r.baseRate)}</td>
          <td class="text-center text-warning font-bold">${r.feePercent || 0}%</td>
          <td class="text-right font-bold text-success">${formatVnd(effectiveRate)}</td>
          <td>${r.source || 'Tự nhập'}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-secondary btn-edit-rate" data-date="${r.date}" data-base="${r.baseRate}" data-fee="${r.feePercent || 0}" data-source="${r.source || ''}">Sửa</button>
          </td>
        `;
        ratesTableBody.appendChild(tr);
      });

      document.querySelectorAll('.btn-edit-rate').forEach(b => {
        b.addEventListener('click', () => {
          document.getElementById('rateStartDateInput').value = b.dataset.date;
          document.getElementById('rateEndDateInput').value = b.dataset.date;
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
    const startDate = `${currentMonth}-01`;
    const [yearStr, mStr] = currentMonth.split('-');
    const daysInMonth = new Date(Number(yearStr), Number(mStr), 0).getDate();
    const endDate = `${currentMonth}-${daysInMonth.toString().padStart(2, '0')}`;

    document.getElementById('rateStartDateInput').value = startDate;
    document.getElementById('rateEndDateInput').value = endDate;
    rateModal.classList.add('active');
  });

  function closeRateModal() {
    rateModal.classList.remove('active');
  }
  btnCloseRateModal.addEventListener('click', closeRateModal);
  btnCancelRateModal.addEventListener('click', closeRateModal);

  rateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const startDate = document.getElementById('rateStartDateInput').value;
    const endDate = document.getElementById('rateEndDateInput').value || startDate;

    const rateData = {
      startDate,
      endDate,
      baseRate: Number(document.getElementById('rateBaseInput').value) || 0,
      feePercent: Number(document.getElementById('rateFeeInput').value) || 0,
      source: document.getElementById('rateSourceInput').value.trim()
    };

    try {
      const res = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateData)
      });
      const result = await res.json();
      if (result.message) {
        alert(result.message);
      }
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
