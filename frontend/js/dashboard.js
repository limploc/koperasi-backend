/**
 * ==============================================================================
 * SCRIPT MONITORING DASHBOARD PETANI (dashboard.js)
 * ------------------------------------------------------------------------------
 * Khusus untuk pemantauan akun petani mitra koperasi:
 * - Menampilkan metrik akumulasi penjualan, transaksi sukses, & rating mutu
 * - Menyediakan filter status interaktif & pencarian real-time pada tabel
 * - Merender tabel distribusi panen dengan semantik aksesibel (<th scope="row">)
 * ==============================================================================
 */

const allFarmerOrders = [...(KOPERASI_DATA.farmerDashboard.salesOrders || [])];
let activeDashFilter = 'all';
let dashSearchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  renderMetrics();
  updateFilterCounts();
  setupDashSearch();
  renderSalesOrdersTable();
});

// Klasifikasi Status Pesanan
function classifyOrderStatus(statusText = '') {
  const st = statusText.toLowerCase();
  if (st.includes('selesai')) return 'selesai';
  if (st.includes('pengantaran') || st.includes('kurir') || st.includes('kirim')) return 'dikirim';
  if (st.includes('menunggu')) return 'menunggu';
  return 'diproses';
}

// 1. Render Kartu Metrik Monitoring Akun
function renderMetrics() {
  const profile = KOPERASI_DATA.farmerDashboard.farmerProfile;
  const totalSalesEl = document.getElementById('metricTotalSales');
  const ordersCountEl = document.getElementById('metricOrdersCount');
  const ratingEl = document.getElementById('metricRating');

  if (totalSalesEl) totalSalesEl.textContent = formatRupiah(profile.totalSalesAllTime || 8450000);
  if (ordersCountEl) ordersCountEl.textContent = `${allFarmerOrders.length} Transaksi`;
  if (ratingEl) ratingEl.innerHTML = `${profile.rating || 4.95} <span class="metric-unit">/ 5.0</span>`;
}

// 2. Hitung & Tampilkan Jumlah di Tiap Pill Filter
function updateFilterCounts() {
  const countAll = allFarmerOrders.length;
  const countProcess = allFarmerOrders.filter(o => {
    const c = classifyOrderStatus(o.adminStatus);
    return c === 'diproses' || c === 'menunggu';
  }).length;
  const countShipped = allFarmerOrders.filter(o => classifyOrderStatus(o.adminStatus) === 'dikirim').length;
  const countDone = allFarmerOrders.filter(o => classifyOrderStatus(o.adminStatus) === 'selesai').length;

  const elAll = document.getElementById('countDashAll');
  const elProc = document.getElementById('countDashProcess');
  const elShip = document.getElementById('countDashShipped');
  const elDone = document.getElementById('countDashDone');

  if (elAll) elAll.textContent = countAll;
  if (elProc) elProc.textContent = countProcess;
  if (elShip) elShip.textContent = countShipped;
  if (elDone) elDone.textContent = countDone;
}

// 3. Setup Live Search pada Tabel Distribusi
function setupDashSearch() {
  const searchInput = document.getElementById('dashOrderSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    dashSearchQuery = e.target.value.trim().toLowerCase();
    renderSalesOrdersTable();
  });
}

// 4. Filter Berdasarkan Pill Status
function filterDashboardOrders(statusKey, btnEl) {
  activeDashFilter = statusKey;
  if (btnEl) {
    const group = btnEl.closest('.dash-filter-pills');
    if (group) {
      group.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
    }
    btnEl.classList.add('active');
  }
  renderSalesOrdersTable();
}

// 5. Render Tabel Monitoring Penjualan & Distribusi Panen
function renderSalesOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const filtered = allFarmerOrders.filter((order) => {
    const statusClass = classifyOrderStatus(order.adminStatus);
    const matchStatus =
      activeDashFilter === 'all' ||
      (activeDashFilter === 'diproses' && (statusClass === 'diproses' || statusClass === 'menunggu')) ||
      statusClass === activeDashFilter;

    if (!matchStatus) return false;
    if (!dashSearchQuery) return true;

    const haystack = `${order.orderId} ${order.customerName} ${order.items} ${order.paymentMethod} ${order.logisticNote}`.toLowerCase();
    return haystack.includes(dashSearchQuery);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr class="dash-empty-row">
        <td colspan="7">Tidak ada data transaksi distribusi yang sesuai dengan filter atau pencarian Anda.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((order) => {
    const statusText = order.adminStatus || 'Diproses Admin Gudang';
    const statusClass = classifyOrderStatus(statusText);

    return `
      <tr>
        <th scope="row">
          <span class="invoice-tag">${order.orderId}</span>
        </th>
        <td>
          <div class="buyer-name">${order.customerName}</div>
          <div class="buyer-method">${order.paymentMethod}</div>
        </td>
        <td>
          <div class="commodity-text">${order.items}</div>
        </td>
        <td>
          <span class="price-text">${formatRupiah(order.totalAmount)}</span>
        </td>
        <td>
          <span class="date-text">${order.date}</span>
        </td>
        <td>
          <span class="status-pill ${statusClass}">
            <span class="status-dot" aria-hidden="true"></span>
            <span>${statusText}</span>
          </span>
        </td>
        <td>
          <div class="logistic-note">
            ${order.logisticNote || 'Dalam penanganan logistik koperasi'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
