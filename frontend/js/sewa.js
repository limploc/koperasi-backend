/**
 * ==============================================================================
 * SCRIPT SEWA ALAT MESIN PERTANIAN (sewa.js)
 * ------------------------------------------------------------------------------
 * Mengatur katalog alsintan, kalkulator estimasi tarif sewa interaktif,
 * dan modal konfirmasi pemesanan unit.
 * ==============================================================================
 */

let selectedRental = null;
let rentalDays = 1;
let includeOperator = false;
let includeDelivery = false;

let activeRentalCategory = 'all';
let rentalSearchQuery = '';
let currentRentalSort = 'popular';

document.addEventListener('DOMContentLoaded', () => {
  renderRentals();
  setupRentalFilterTabs();
  setupRentalSearchAndSort();
  setupRentalModal();
});

// Setup Tab Filter Kategori Alat
function setupRentalFilterTabs() {
  const tabs = document.querySelectorAll('.cat-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeRentalCategory = tab.getAttribute('data-cat') || 'all';
      renderRentals();
    });
  });
}

// Setup Event Pencarian dan Pengurutan Alsintan
function setupRentalSearchAndSort() {
  const searchInput = document.getElementById('rentalSearchInput');
  const sortSelect = document.getElementById('rentalSortSelect');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      rentalSearchQuery = e.target.value.trim();
      renderRentals();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentRentalSort = e.target.value;
      renderRentals();
    });
  }
}

// Reset Filter Pencarian & Kategori Sewa
function resetRentalFilters() {
  activeRentalCategory = 'all';
  rentalSearchQuery = '';
  currentRentalSort = 'popular';

  const searchInput = document.getElementById('rentalSearchInput');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('rentalSortSelect');
  if (sortSelect) sortSelect.value = 'popular';

  const firstTab = document.querySelector('.cat-tab-btn[data-cat="all"]');
  if (firstTab) firstTab.click();
}

// Render Katalog Alat Sewa (Mengikuti format kartu toko online 4-kolom kompak)
function renderRentals() {
  const grid = document.getElementById('rentalsGrid');
  if (!grid) return;

  const query = rentalSearchQuery.toLowerCase();

  let filtered = KOPERASI_DATA.rentals.filter(item => {
    const matchCat = activeRentalCategory === 'all' || item.category === activeRentalCategory;
    const matchSearch = item.name.toLowerCase().includes(query) ||
                        (item.description && item.description.toLowerCase().includes(query)) ||
                        (item.power && item.power.toLowerCase().includes(query)) ||
                        (item.categoryName && item.categoryName.toLowerCase().includes(query));
    return matchCat && matchSearch;
  });

  // Sorting
  if (currentRentalSort === 'price-low') {
    filtered.sort((a, b) => a.pricePerDay - b.pricePerDay);
  } else if (currentRentalSort === 'price-high') {
    filtered.sort((a, b) => b.pricePerDay - a.pricePerDay);
  } else {
    // Default: Paling Populer (berdasarkan rating)
    filtered.sort((a, b) => (b.rating || 4.9) - (a.rating || 4.9));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
        <p style="font-size: 1.15rem; color: #6B7280;">Tidak ada alat pertanian yang cocok dengan pencarian Anda.</p>
        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="resetRentalFilters()">Reset Filter</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const origPrice = item.originalPricePerDay || Math.round(item.pricePerDay * 1.25 / 1000) * 1000;
    return `
      <article class="product-card">
        <div class="product-image-container" onclick="goToRentalDetail('${item.id}')">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
        </div>
        <div class="product-content">
          <div class="product-price-row">
            <span class="price-current">${formatRupiah(item.pricePerDay)} <small style="font-size: 0.72rem; color: #6B7280; font-weight: normal;">/ hari</small></span>
            <span class="price-original">${formatRupiah(origPrice)}</span>
          </div>

          <div class="product-title-row">
            <h3 class="product-name" onclick="goToRentalDetail('${item.id}')" title="${item.name}">${item.name}</h3>
            <div class="product-rating-box">
              <svg class="star-rating-icon" width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>${item.rating || 4.9}</span>
            </div>
          </div>

          <p class="product-description" onclick="goToRentalDetail('${item.id}')">
            ${item.power} • ${item.capacity}. ${item.description} <span class="see-more-link">Selengkapnya</span>
          </p>

          <div class="product-action-buttons single-button">
            <button class="btn-buy-now" type="button" style="width: 100%; justify-content: center; padding: 0.75rem;" onclick="rentNow('${item.id}')">Sewa Sekarang</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Navigasi ke Halaman Detail Alat Sewa Baru
function goToRentalDetail(rentalId) {
  window.location.href = `detail-alat.html?id=${rentalId}`;
}

// Masukkan Alat ke Keranjang Belanja dan Langsung ke Halaman cart.html
function rentNow(rentalId) {
  const item = KOPERASI_DATA.rentals.find(r => r.id === rentalId);
  if (!item) return;

  let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');
  const existing = cart.find(c => c.id === rentalId && c.itemType === 'rental');

  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.pricePerDay,
      unit: 'Hari',
      itemType: 'rental',
      image: item.image,
      qty: 1
    });
  }

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  if (typeof updateCartBadge === 'function') updateCartBadge();
  window.location.href = 'cart.html';
}

// Setup Dialog Kalkulator
function setupRentalModal() {
  const modal = document.getElementById('rentalCalcModal');
  if (!modal) return;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

// Buka Kalkulator Tarif Sewa
function openRentalCalculator(rentalId) {
  selectedRental = KOPERASI_DATA.rentals.find(r => r.id === rentalId);
  const modal = document.getElementById('rentalCalcModal');
  const body = document.getElementById('rentalCalcBody');
  if (!selectedRental || !modal || !body) return;

  rentalDays = 1;
  includeOperator = false;
  includeDelivery = false;

  renderCalculatorContent();
  modal.showModal();
}

// Render Tampilan Dalam Kalkulator
function renderCalculatorContent() {
  const body = document.getElementById('rentalCalcBody');
  if (!selectedRental || !body) return;

  const basePrice = selectedRental.pricePerDay * rentalDays;
  const opPrice = (includeOperator && selectedRental.operatorAvailable) ? (selectedRental.operatorFeePerDay * rentalDays) : 0;
  const delivPrice = includeDelivery ? 50000 : 0;
  const totalPrice = basePrice + opPrice + delivPrice;

  body.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <div style="font-size: 0.8rem; font-weight: 700; color: #0A7337; text-transform: uppercase; margin-bottom: 0.25rem;">Formulir Sewa Alsintan</div>
      <h2 style="font-size: 1.5rem; margin-top: 0.25rem;">${selectedRental.name}</h2>
      <p style="font-size: 0.85rem; color: #6B7280;">Tarif Dasar: ${formatRupiah(selectedRental.pricePerDay)} / hari</p>
    </div>

    <!-- Pilihan Durasi Hari -->
    <div class="form-group">
      <label class="form-label">Durasi Waktu Sewa (Hari):</label>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <input type="range" min="1" max="14" value="${rentalDays}" style="flex: 1; accent-color: #111827;" oninput="onDurationChange(this.value)">
        <span style="font-size: 1.1rem; font-weight: 700; min-width: 60px; text-align: right;">${rentalDays} Hari</span>
      </div>
    </div>

    <!-- Opsi Tambahan -->
    <div style="display: flex; flex-direction: column; gap: 0.65rem; margin: 1rem 0;">
      ${selectedRental.operatorAvailable ? `
        <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" ${includeOperator ? 'checked' : ''} onchange="toggleOperator(this.checked)" style="accent-color: var(--color-primary); width: 16px; height: 16px;">
          <span>Sertakan Operator Berpengalaman Koperasi (+${formatRupiah(selectedRental.operatorFeePerDay)}/hari)</span>
        </label>
      ` : ''}

      <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; cursor: pointer;">
        <input type="checkbox" ${includeDelivery ? 'checked' : ''} onchange="toggleDelivery(this.checked)" style="accent-color: var(--color-primary); width: 16px; height: 16px;">
        <span>Layanan Antar Unit Langsung ke Lokasi Sawah (+Rp 50.000 sekali jalan)</span>
      </label>
    </div>

    <!-- Ringkasan Perhitungan Biaya -->
    <div class="calc-summary-box">
      <div class="calc-row">
        <span>Sewa Unit (${rentalDays} Hari):</span>
        <strong>${formatRupiah(basePrice)}</strong>
      </div>
      ${opPrice > 0 ? `
        <div class="calc-row">
          <span>Jasa Operator (${rentalDays} Hari):</span>
          <strong>${formatRupiah(opPrice)}</strong>
        </div>
      ` : ''}
      ${delivPrice > 0 ? `
        <div class="calc-row">
          <span>Ongkos Antar Unit:</span>
          <strong>${formatRupiah(delivPrice)}</strong>
        </div>
      ` : ''}
      <div class="calc-row total">
        <span>Total Estimasi Biaya:</span>
        <span style="color: var(--color-primary);">${formatRupiah(totalPrice)}</span>
      </div>
    </div>

    <div style="font-size: 0.75rem; color: #9CA3AF; margin-bottom: 1.25rem;">
      ℹ️ Syarat: Menunjukkan Kartu Tanda Anggota / KTP saat pengambilan unit di gudang koperasi.
    </div>

    <button class="btn btn-dark" style="width: 100%; padding: 0.85rem;" onclick="submitRentalBooking()">
      Ajukan Pemesanan Sewa &rarr;
    </button>
  `;
}

function onDurationChange(val) {
  rentalDays = parseInt(val, 10);
  renderCalculatorContent();
}

function toggleOperator(val) {
  includeOperator = val;
  renderCalculatorContent();
}

function toggleDelivery(val) {
  includeDelivery = val;
  renderCalculatorContent();
}

function submitRentalBooking() {
  if (!selectedRental) return;

  const basePrice = selectedRental.pricePerDay * rentalDays;
  const opPrice = (selectedRental.operatorAvailable && includeOperator) ? (selectedRental.operatorFeePerDay * rentalDays) : 0;
  const delivPrice = includeDelivery ? 50000 : 0;
  const totalPrice = basePrice + opPrice + delivPrice;

  const rentalId = `#SEWA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' • ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  // Simpan data pemesanan sewa ke localStorage 'koperasi_orders'
  const orders = JSON.parse(localStorage.getItem('koperasi_orders') || '[]');
  const newRentalOrder = {
    id: rentalId,
    orderType: 'rental',
    date: dateFormatted,
    status: 'Menunggu ACC Admin',
    unitName: selectedRental.name,
    unitCategory: selectedRental.categoryName || 'Alsintan',
    unitImage: selectedRental.image,
    days: rentalDays,
    pricePerDay: selectedRental.pricePerDay,
    operatorIncluded: includeOperator,
    deliveryIncluded: includeDelivery,
    total: formatRupiah(totalPrice),
    rawTotal: totalPrice
  };

  orders.unshift(newRentalOrder);
  localStorage.setItem('koperasi_orders', JSON.stringify(orders));

  // Tutup modal kalkulator
  document.getElementById('rentalCalcModal')?.close();

  // Tampilkan data ke modal sukses
  const successModal = document.getElementById('successRentalModal');
  const receiptIdEl = document.getElementById('rentalReceiptId');
  const receiptUnitEl = document.getElementById('rentalReceiptUnit');
  const receiptDaysEl = document.getElementById('rentalReceiptDays');
  const receiptTotalEl = document.getElementById('rentalReceiptTotal');

  if (receiptIdEl) receiptIdEl.textContent = rentalId;
  if (receiptUnitEl) receiptUnitEl.textContent = selectedRental.name;
  if (receiptDaysEl) receiptDaysEl.textContent = `${rentalDays} Hari (${includeOperator ? 'Dengan Operator' : 'Tanpa Operator'})`;
  if (receiptTotalEl) receiptTotalEl.textContent = formatRupiah(totalPrice);

  if (successModal) {
    successModal.showModal();
  } else {
    showToast(`✓ Permohonan sewa ${selectedRental.name} berhasil diajukan!`);
  }
}
