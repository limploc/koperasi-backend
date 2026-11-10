/**
 * ==============================================================================
 * SCRIPT DAFTAR PESANAN & SEWA ALAT (pesanan.js)
 * ------------------------------------------------------------------------------
 * Mengelola rendering dan filter riwayat pemesanan anggota koperasi:
 * - Terbagi 2 Tab Utama:
 *   1. Toko Online (Pesanan Komoditas Hasil Tani)
 *   2. Sewa Alat (Peminjaman Alsintan Koperasi)
 * - Filter status cerdas menyesuaikan tab yang aktif
 * - Integrasi localStorage (koperasi_orders)
 * ==============================================================================
 */

// Contoh pesanan default awal jika pengguna belum pernah checkout
const DEFAULT_DEMO_ORDERS = [
  // --- KATEGORI 1: TOKO ONLINE ---
  {
    id: "#KOP-2026-8921",
    orderType: "store",
    date: "10 Nov 2026 • 09:15 WIB",
    status: "Dalam Pengiriman",
    shippingMethod: "Gratis Pengiriman (Binaan Koperasi)",
    total: "Rp 195.000",
    rawTotal: 195000,
    items: [
      {
        id: "PRD-002",
        name: "Cabai Rawit Merah Super",
        price: 45000,
        qty: 2,
        unit: "kg",
        image: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=400&q=80"
      },
      {
        id: "PRD-003",
        name: "Alpukat Mentega Super Jumbo",
        price: 35000,
        qty: 3,
        unit: "kg",
        image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=400&q=80"
      }
    ]
  },
  {
    id: "#KOP-2026-7643",
    orderType: "store",
    date: "07 Nov 2026 • 14:40 WIB",
    status: "Selesai",
    shippingMethod: "Gratis Pengiriman (Binaan Koperasi)",
    total: "Rp 375.000",
    rawTotal: 375000,
    items: [
      {
        id: "PRD-004",
        name: "Beras Pandan Wangi Organik",
        price: 75000,
        qty: 5,
        unit: "5kg",
        image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80"
      }
    ]
  },

  // --- KATEGORI 2: SEWA ALAT (ALSINTAN) ---
  {
    id: "#SEWA-2026-3190",
    orderType: "rental",
    date: "10 Nov 2026 • 07:30 WIB",
    status: "Unit di Lahan (Aktif)",
    unitName: "Traktor Quick G1000 Boxer Roda 2",
    unitCategory: "Olah Tanah",
    unitImage: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=400&q=80",
    days: 2,
    pricePerDay: 200000,
    operatorIncluded: true,
    deliveryIncluded: true,
    total: "Rp 650.000",
    rawTotal: 650000
  },
  {
    id: "#SEWA-2026-1045",
    orderType: "rental",
    date: "11 Nov 2026 • 08:15 WIB",
    status: "Menunggu ACC Admin",
    unitName: "Drone Sprayer Pertanian T40",
    unitCategory: "Perawatan & Semprot",
    unitImage: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=400&q=80",
    days: 1,
    pricePerDay: 650000,
    operatorIncluded: true,
    deliveryIncluded: true,
    total: "Rp 850.000",
    rawTotal: 850000
  },
  {
    id: "#SEWA-2026-9820",
    orderType: "rental",
    date: "05 Nov 2026 • 10:00 WIB",
    status: "Selesai Sewa",
    unitName: "Mesin Pompa Air Irigasi Alkon 3 Inch",
    unitCategory: "Irigasi & Pompa",
    unitImage: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
    days: 3,
    pricePerDay: 90000,
    operatorIncluded: false,
    deliveryIncluded: false,
    total: "Rp 270.000",
    rawTotal: 270000
  }
];

// State Aktif
let currentOrderType = 'store'; // 'store' atau 'rental'
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  // Cek parameter URL: pesanan.html?type=rental
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  if (typeParam === 'rental') {
    currentOrderType = 'rental';
  }

  initOrders();
  setupTypeNav();
  updateTypeTabsUI();
  renderFilterBar();
  renderCurrentOrders();
});

// Inisialisasi daftar pesanan di localStorage
function initOrders() {
  let stored = localStorage.getItem('koperasi_orders');
  if (!stored) {
    localStorage.setItem('koperasi_orders', JSON.stringify(DEFAULT_DEMO_ORDERS));
  } else {
    // Pastikan pesanan lama yang tidak punya orderType default ke 'store'
    try {
      const parsed = JSON.parse(stored);
      let updated = false;
      parsed.forEach(o => {
        if (!o.orderType) {
          o.orderType = o.id.startsWith('#SEWA') ? 'rental' : 'store';
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem('koperasi_orders', JSON.stringify(parsed));
      }
    } catch (e) {
      console.error(e);
    }
  }
  updateCounters();
}

// Update Angka Counter pada Tab
function updateCounters() {
  const orders = JSON.parse(localStorage.getItem('koperasi_orders') || '[]');
  const storeCount = orders.filter(o => o.orderType !== 'rental').length;
  const rentalCount = orders.filter(o => o.orderType === 'rental').length;

  const storeEl = document.getElementById('storeOrderCount');
  const rentalEl = document.getElementById('rentalOrderCount');

  if (storeEl) storeEl.textContent = storeCount;
  if (rentalEl) rentalEl.textContent = rentalCount;
}

// Setup Tombol Navigasi Tipe (Toko Online vs Sewa Alat)
function setupTypeNav() {
  const tabStore = document.getElementById('tabStoreOrders');
  const tabRental = document.getElementById('tabRentalOrders');

  tabStore?.addEventListener('click', () => {
    if (currentOrderType !== 'store') {
      currentOrderType = 'store';
      activeFilter = 'all';
      updateTypeTabsUI();
      renderFilterBar();
      renderCurrentOrders();
    }
  });

  tabRental?.addEventListener('click', () => {
    if (currentOrderType !== 'rental') {
      currentOrderType = 'rental';
      activeFilter = 'all';
      updateTypeTabsUI();
      renderFilterBar();
      renderCurrentOrders();
    }
  });
}

// Update Tampilan Tab Aktif
function updateTypeTabsUI() {
  const tabStore = document.getElementById('tabStoreOrders');
  const tabRental = document.getElementById('tabRentalOrders');

  if (currentOrderType === 'store') {
    tabStore?.classList.add('active');
    tabStore?.setAttribute('aria-selected', 'true');
    tabRental?.classList.remove('active');
    tabRental?.setAttribute('aria-selected', 'false');
  } else {
    tabRental?.classList.add('active');
    tabRental?.setAttribute('aria-selected', 'true');
    tabStore?.classList.remove('active');
    tabStore?.setAttribute('aria-selected', 'false');
  }
}

// Render Tombol Filter Status sesuai Tipe Aktif
function renderFilterBar() {
  const filterBar = document.getElementById('statusFilterBar');
  if (!filterBar) return;

  if (currentOrderType === 'store') {
    filterBar.innerHTML = `
      <button class="order-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Semua Pesanan</button>
      <button class="order-filter-btn ${activeFilter === 'Diproses' ? 'active' : ''}" data-filter="Diproses">Sedang Diproses</button>
      <button class="order-filter-btn ${activeFilter === 'Dalam Pengiriman' ? 'active' : ''}" data-filter="Dalam Pengiriman">Dalam Pengiriman</button>
      <button class="order-filter-btn ${activeFilter === 'Selesai' ? 'active' : ''}" data-filter="Selesai">Selesai</button>
    `;
  } else {
    filterBar.innerHTML = `
      <button class="order-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Semua Sewa</button>
      <button class="order-filter-btn ${activeFilter === 'Menunggu' ? 'active' : ''}" data-filter="Menunggu">Menunggu ACC Admin</button>
      <button class="order-filter-btn ${activeFilter === 'Lahan' ? 'active' : ''}" data-filter="Lahan">Unit di Lahan (Aktif)</button>
      <button class="order-filter-btn ${activeFilter === 'Selesai' ? 'active' : ''}" data-filter="Selesai">Selesai Sewa</button>
    `;
  }

  // Pasang event listener pada setiap tombol filter baru
  filterBar.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterBar.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderCurrentOrders();
    });
  });
}

// Render Daftar Pesanan Sesuai Tipe dan Filter
function renderCurrentOrders() {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;

  const allOrders = JSON.parse(localStorage.getItem('koperasi_orders') || '[]');

  // 1. Filter berdasarkan Tipe (Store vs Rental)
  const typeFiltered = allOrders.filter(order => {
    if (currentOrderType === 'rental') {
      return order.orderType === 'rental';
    } else {
      return order.orderType !== 'rental';
    }
  });

  // 2. Filter berdasarkan Status
  const filtered = typeFiltered.filter(order => {
    if (activeFilter === 'all') return true;
    return (order.status || '').toLowerCase().includes(activeFilter.toLowerCase());
  });

  updateCounters();

  if (filtered.length === 0) {
    if (currentOrderType === 'store') {
      container.innerHTML = `
        <div class="orders-empty-box">
          <h3>Tidak Ada Pesanan Toko Online</h3>
          <p>Anda belum memiliki riwayat pesanan produk hasil panen untuk status ini. Jelajahi komoditas segar langsung dari petani mitra koperasi kami.</p>
          <a href="toko.html" class="btn-order-reorder" style="display: inline-block;">Belanja Hasil Tani Sekarang</a>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="orders-empty-box">
          <h3>Tidak Ada Riwayat Sewa Alat</h3>
          <p>Belum ada pengajuan sewa alsintan untuk status ini. Koperasi menyediakan traktor, drone sprayer, mesin pompa irigasi, dan power thresher dengan tarif bersubsidi.</p>
          <a href="sewa.html" class="btn-order-reorder" style="display: inline-block;">Lihat Katalog Sewa Alsintan</a>
        </div>
      `;
    }
    return;
  }

  // Render sesuai tipe
  if (currentOrderType === 'store') {
    container.innerHTML = filtered.map(order => renderStoreOrderCard(order)).join('');
  } else {
    container.innerHTML = filtered.map(order => renderRentalOrderCard(order)).join('');
  }
}

// Render Kartu Pesanan Toko Online
function renderStoreOrderCard(order) {
  let statusClass = 'diproses';
  let statusText = order.status || 'Sedang Diproses';
  const st = statusText.toLowerCase();

  if (st.includes('kirim') || st.includes('jalan')) {
    statusClass = 'dikirim';
  } else if (st.includes('selesai') || st.includes('terima')) {
    statusClass = 'selesai';
  }

  const itemsHtml = (order.items || []).map(item => `
    <div class="order-prod-row">
      <img src="${item.image || 'assets/bento-market.jpg'}" alt="${item.name}" class="order-prod-img" onerror="this.src='assets/bento-market.jpg'">
      <div class="order-prod-details">
        <h4 class="order-prod-title">${item.name}</h4>
        <span class="order-prod-meta">${item.qty} ${item.unit || 'unit'} &times; Rp ${(item.price || 0).toLocaleString('id-ID')}</span>
      </div>
      <span class="order-prod-price">Rp ${((item.price || 0) * (item.qty || 1)).toLocaleString('id-ID')}</span>
    </div>
  `).join('');

  const waMsg = encodeURIComponent(`Halo Admin Koperasi, saya ingin konfirmasi status pesanan belanja saya dengan nomor ${order.id}.`);

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div class="order-id-info">
          <span class="order-code">${order.id}</span>
          <span class="order-date">${order.date}</span>
        </div>
        <span class="order-status-badge ${statusClass}">
          ${statusText}
        </span>
      </div>

      <div class="order-items-wrap">
        ${itemsHtml}
      </div>

      <div class="order-card-footer">
        <div class="order-total-info">
          <span class="order-total-label">Total Belanja (${order.shippingMethod || 'Gratis Ongkir'})</span>
          <span class="order-total-amount">${order.total}</span>
        </div>

        <div class="order-action-links">
          <a href="https://wa.me/6281234567890?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="btn-order-wa">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            Tanya Admin via WA
          </a>
          <a href="toko.html" class="btn-order-reorder">Belanja Lagi</a>
        </div>
      </div>
    </div>
  `;
}

// Render Kartu Sewa Alat (Alsintan)
function renderRentalOrderCard(order) {
  let statusClass = 'menunggu-acc';
  let statusText = order.status || 'Menunggu ACC Admin';
  const st = statusText.toLowerCase();

  if (st.includes('lahan') || st.includes('aktif') || st.includes('jalan')) {
    statusClass = 'aktif-lahan';
  } else if (st.includes('selesai') || st.includes('kembali')) {
    statusClass = 'selesai';
  }

  const waMsg = encodeURIComponent(`Halo Admin Alsintan Koperasi, saya ingin konfirmasi permohonan sewa alat ${order.unitName} dengan nomor registrasi ${order.id}.`);

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div class="order-id-info">
          <span class="order-code">${order.id}</span>
          <span class="order-date">${order.date}</span>
        </div>
        <span class="order-status-badge ${statusClass}">
          ● ${statusText}
        </span>
      </div>

      <div class="order-items-wrap">
        <div class="order-prod-row">
          <img src="${order.unitImage || 'assets/bento-tractor.jpg'}" alt="${order.unitName}" class="order-prod-img" style="border-radius: 12px; width: 68px; height: 68px;" onerror="this.src='assets/bento-tractor.jpg'">
          <div class="order-prod-details">
            <div style="font-size: 0.75rem; font-weight: 700; color: #0A7337; text-transform: uppercase; margin-bottom: 0.15rem;">
              Kategori: ${order.unitCategory || 'Alat Mesin Pertanian'}
            </div>
            <h4 class="order-prod-title" style="font-size: 1.05rem;">${order.unitName}</h4>
            <div class="rental-spec-tags">
              <span class="rental-tag-pill">⏱ Durasi: <strong>${order.days || 1} Hari</strong></span>
              <span class="rental-tag-pill">${order.operatorIncluded ? '👨‍🌾 + Operator Ahli Koperasi' : 'Tanpa Operator'}</span>
              <span class="rental-tag-pill">${order.deliveryIncluded ? '🚚 Antar ke Lokasi Lahan' : 'Ambil di Gudang'}</span>
            </div>
          </div>
          <span class="order-prod-price" style="font-size: 1.1rem;">${order.total}</span>
        </div>
      </div>

      <div class="order-card-footer">
        <div class="order-total-info">
          <span class="order-total-label">Total Biaya Sewa (Termasuk Subsidi Anggota)</span>
          <span class="order-total-amount">${order.total}</span>
        </div>

        <div class="order-action-links">
          <a href="https://wa.me/6281234567890?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="btn-order-wa">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            Hubungi Admin Alsintan
          </a>
          <a href="sewa.html" class="btn-order-reorder">Sewa Unit Lain</a>
        </div>
      </div>
    </div>
  `;
}
