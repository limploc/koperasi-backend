/**
 * ==============================================================================
 * SCRIPT DASHBOARD KHUSUS PETANI (dashboard.js)
 * ------------------------------------------------------------------------------
 * Mengatur data kelola penjualan hasil tani Pak Joko:
 * - Render metrik ringkasan penjualan (Omzet, Pesanan, Produk, Rating)
 * - Render & update tabel pesanan masuk dari pembeli
 * - Aksi ubah status pesanan (Diproses / Dikirim / Selesai)
 * - Render produk panen & form modal tambah panen baru
 * ==============================================================================
 */

// Clone data lokal agar interaksi tambah produk & ubah status pesanan langsung terlihat
let localOrders = [...KOPERASI_DATA.farmerDashboard.salesOrders];
let localProducts = [...KOPERASI_DATA.farmerDashboard.myProducts];

document.addEventListener('DOMContentLoaded', () => {
  renderMetrics();
  renderSalesOrdersTable();
  renderFarmerProducts();
  setupAddProductModal();
});

// Render Kartu Metrik
function renderMetrics() {
  const profile = KOPERASI_DATA.farmerDashboard.farmerProfile;
  const revEl = document.getElementById('metricRevenue');
  const orderEl = document.getElementById('metricOrders');
  const prodEl = document.getElementById('metricProducts');
  const ratingEl = document.getElementById('metricRating');

  if (revEl) revEl.textContent = formatRupiah(profile.totalRevenue);
  if (orderEl) orderEl.textContent = `${localOrders.length} Pesanan`;
  if (prodEl) prodEl.textContent = `${localProducts.filter(p => p.status === 'Aktif').length} Produk`;
  if (ratingEl) ratingEl.textContent = `${profile.rating} / 5.0`;
}

// Render Tabel Pesanan Masuk
function renderSalesOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  tbody.innerHTML = localOrders.map((order, idx) => {
    let statusClass = 'menunggu';
    if (order.status === 'Diproses') statusClass = 'diproses';
    if (order.status === 'Dikirim') statusClass = 'dikirim';
    if (order.status === 'Selesai') statusClass = 'selesai';

    return `
      <tr>
        <td><strong>${order.orderId}</strong></td>
        <td>
          <div style="font-weight: 600; color: #111827;">${order.customerName}</div>
          <div style="font-size: 0.75rem; color: #9CA3AF;">${order.paymentMethod}</div>
        </td>
        <td style="max-width: 250px;">${order.items}</td>
        <td><strong>${formatRupiah(order.totalAmount)}</strong></td>
        <td style="font-size: 0.8rem; color: #6B7280;">${order.date}</td>
        <td>
          <span class="status-pill ${statusClass}">● ${order.status}</span>
        </td>
        <td>
          <select 
            style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--color-border); font-size: 0.8rem; background: #FFFFFF; cursor: pointer;"
            onchange="changeOrderStatus(${idx}, this.value)"
          >
            <option value="Menunggu" ${order.status === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
            <option value="Diproses" ${order.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
            <option value="Dikirim" ${order.status === 'Dikirim' ? 'selected' : ''}>Dikirim</option>
            <option value="Selesai" ${order.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

// Ubah Status Pesanan
function changeOrderStatus(orderIndex, newStatus) {
  if (!localOrders[orderIndex]) return;
  localOrders[orderIndex].status = newStatus;
  renderSalesOrdersTable();
  showToast(`✓ Status pesanan ${localOrders[orderIndex].orderId} diperbarui: ${newStatus}`);
}

// Render Produk Hasil Panen Milik Petani Ini
function renderFarmerProducts() {
  const grid = document.getElementById('farmerProductsGrid');
  if (!grid) return;

  grid.innerHTML = localProducts.map(p => `
    <div class="farmer-prod-item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="farmer-prod-name">${p.name}</span>
        <span class="status-pill ${p.status === 'Aktif' ? 'selesai' : 'menunggu'}" style="font-size: 0.7rem;">
          ${p.status}
        </span>
      </div>
      <div class="farmer-prod-price">
        ${formatRupiah(p.price)} <span style="font-size: 0.75rem; font-weight: 400; color: #6B7280;">/ ${p.unit}</span>
      </div>
      <div style="font-size: 0.8rem; color: #6B7280; display: flex; justify-content: space-between;">
        <span>Stok: <strong>${p.stock} ${p.unit}</strong></span>
        <span>Terjual: <strong>${p.soldCount}</strong></span>
      </div>
    </div>
  `).join('');
}

// Setup Modal Tambah Produk Panen Baru
function setupAddProductModal() {
  const modal = document.getElementById('addProductModal');
  const form = document.getElementById('addProductForm');

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.close();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('prodNameInput')?.value;
      const price = parseInt(document.getElementById('prodPriceInput')?.value || '0', 10);
      const unit = document.getElementById('prodUnitInput')?.value;
      const stock = parseInt(document.getElementById('prodStockInput')?.value || '0', 10);

      const newProduct = {
        id: `PRD-${Date.now().toString().slice(-3)}`,
        name: name,
        price: price,
        unit: unit,
        stock: stock,
        status: "Aktif",
        soldCount: 0
      };

      localProducts.unshift(newProduct);
      renderFarmerProducts();
      renderMetrics();
      form.reset();
      modal.close();
      showToast(`✓ Hasil panen baru berhasil ditambahkan ke lapak: ${name}`);
    });
  }
}

function openAddProductModal() {
  document.getElementById('addProductModal')?.showModal();
}
