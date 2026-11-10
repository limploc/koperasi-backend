/**
 * ==============================================================================
 * SCRIPT HALAMAN KERANJANG (cart.js)
 * ------------------------------------------------------------------------------
 * Mengatur pemisahan item Keranjang Belanja:
 * 1. Bagian Toko Online (Produk Hasil Tani)
 * 2. Bagian Sewa Alat Pertanian (Alsintan)
 * Stepper kuantitas & durasi sewa, kalkulasi subtotal terpisah,
 * serta integrasi pemesanan multi-kategori ke riwayat pesanan (pesanan.html).
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();
});

// Render Tampilan Halaman Keranjang Terpisah (Hasil Tani vs Sewa Alsintan)
function renderCartPage() {
  const emptyState = document.getElementById('cartEmptyState');
  const cartContent = document.getElementById('cartContentSection');
  
  const produceSection = document.getElementById('cartProduceSection');
  const produceContainer = document.getElementById('produceItemsContainer');
  const produceCountEl = document.getElementById('produceItemCount');
  const rowProduceSubtotal = document.getElementById('rowProduceSubtotal');
  const produceSubtotalEl = document.getElementById('produceSubtotalDisplay');

  const rentalSection = document.getElementById('cartRentalSection');
  const rentalContainer = document.getElementById('rentalItemsContainer');
  const rentalCountEl = document.getElementById('rentalItemCount');
  const rowRentalSubtotal = document.getElementById('rowRentalSubtotal');
  const rentalSubtotalEl = document.getElementById('rentalSubtotalDisplay');

  const grandTotalEl = document.getElementById('cartGrandTotalDisplay');

  // Muat ulang keranjang dari localStorage
  cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');
  if (typeof updateCartBadge === 'function') updateCartBadge();

  // Jika keranjang kosong
  if (!cart || cart.length === 0) {
    if (cartContent) cartContent.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (cartContent) cartContent.style.display = 'grid';

  // Pisahkan item berdasarkan kategori (Toko Online vs Sewa Alat)
  const produceItems = [];
  const rentalItems = [];

  cart.forEach((item, index) => {
    // Simpan referensi index asli di array cart
    const itemWithIndex = { ...item, originalIndex: index };
    if (item.itemType === 'rental') {
      rentalItems.push(itemWithIndex);
    } else {
      produceItems.push(itemWithIndex);
    }
  });

  let produceSubtotal = 0;
  let rentalSubtotal = 0;

  // 1. RENDER BAGIAN HASIL TANI
  if (produceSection && produceContainer) {
    if (produceItems.length === 0) {
      produceSection.style.display = 'none';
      if (rowProduceSubtotal) rowProduceSubtotal.style.display = 'none';
    } else {
      produceSection.style.display = 'block';
      if (rowProduceSubtotal) rowProduceSubtotal.style.display = 'flex';
      if (produceCountEl) produceCountEl.textContent = `${produceItems.length} Produk`;

      produceContainer.innerHTML = produceItems.map(item => {
        const itemSubtotal = item.price * (item.qty || 1);
        produceSubtotal += itemSubtotal;

        return `
          <div class="cart-item-row" data-id="${item.id}">
            <!-- Tombol Hapus -->
            <button type="button" class="btn-cart-remove" title="Hapus produk" onclick="removeCartItem(${item.originalIndex})">
              &times;
            </button>

            <!-- Thumbnail Gambar -->
            <div class="cart-thumb-box">
              <img src="${item.image}" alt="${item.name}" loading="lazy">
            </div>

            <!-- Info Produk -->
            <div class="cart-item-info">
              <span class="cart-item-name">${item.name}</span>
              <span class="cart-item-unit">${item.unit || 'kg'} / Pck</span>
            </div>

            <!-- Harga Satuan -->
            <div class="cart-item-price-col">
              <span class="cart-item-unit-price">${formatRupiah(item.price)}</span>
            </div>

            <!-- Stepper Kuantitas -->
            <div class="cart-stepper">
              <button type="button" class="stepper-btn" onclick="changeItemQty(${item.originalIndex}, -1)" title="Kurangi">&minus;</button>
              <span class="stepper-val">${item.qty || 1}</span>
              <button type="button" class="stepper-btn" onclick="changeItemQty(${item.originalIndex}, 1)" title="Tambah">&plus;</button>
            </div>

            <!-- Subtotal Item -->
            <div class="cart-item-subtotal">
              ${formatRupiah(itemSubtotal)}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. RENDER BAGIAN SEWA ALAT MESIN PERTANIAN (ALSINTAN)
  if (rentalSection && rentalContainer) {
    if (rentalItems.length === 0) {
      rentalSection.style.display = 'none';
      if (rowRentalSubtotal) rowRentalSubtotal.style.display = 'none';
    } else {
      rentalSection.style.display = 'block';
      if (rowRentalSubtotal) rowRentalSubtotal.style.display = 'flex';
      if (rentalCountEl) rentalCountEl.textContent = `${rentalItems.length} Unit`;

      rentalContainer.innerHTML = rentalItems.map(item => {
        const itemSubtotal = item.price * (item.qty || 1);
        rentalSubtotal += itemSubtotal;

        return `
          <div class="cart-item-row" data-id="${item.id}">
            <!-- Tombol Hapus -->
            <button type="button" class="btn-cart-remove" title="Hapus unit sewa" onclick="removeCartItem(${item.originalIndex})">
              &times;
            </button>

            <!-- Thumbnail Gambar -->
            <div class="cart-thumb-box">
              <img src="${item.image}" alt="${item.name}" loading="lazy">
            </div>

            <!-- Info Unit Sewa -->
            <div class="cart-item-info">
              <span class="cart-item-name">${item.name}</span>
              <span class="rental-unit-badge">🚚 Antar ke Lahan Sawah Gratis</span>
            </div>

            <!-- Tarif Sewa Per Hari -->
            <div class="cart-item-price-col">
              <span class="cart-item-unit-price">${formatRupiah(item.price)} <small style="font-size: 0.72rem; color: #6B7280; font-weight: normal;">/ hari</small></span>
            </div>

            <!-- Stepper Durasi Hari Sewa -->
            <div class="cart-stepper">
              <button type="button" class="stepper-btn" onclick="changeItemQty(${item.originalIndex}, -1)" title="Kurangi Hari">&minus;</button>
              <span class="stepper-val" style="min-width: 52px; font-size: 0.82rem; font-weight: 700;">${item.qty || 1} Hari</span>
              <button type="button" class="stepper-btn" onclick="changeItemQty(${item.originalIndex}, 1)" title="Tambah Hari">&plus;</button>
            </div>

            <!-- Subtotal Sewa Unit -->
            <div class="cart-item-subtotal">
              ${formatRupiah(itemSubtotal)}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3. UPDATE RINGKASAN TOTAL
  const grandTotal = produceSubtotal + rentalSubtotal;
  if (produceSubtotalEl) produceSubtotalEl.textContent = formatRupiah(produceSubtotal);
  if (rentalSubtotalEl) rentalSubtotalEl.textContent = formatRupiah(rentalSubtotal);
  if (grandTotalEl) grandTotalEl.textContent = formatRupiah(grandTotal);
}

// Ubah Kuantitas Item / Durasi Hari
function changeItemQty(index, change) {
  if (!cart[index]) return;

  cart[index].qty = (cart[index].qty || 1) + change;

  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  renderCartPage();
}

// Hapus Item dari Keranjang
function removeCartItem(index) {
  if (!cart[index]) return;
  const removedName = cart[index].name;
  cart.splice(index, 1);
  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  renderCartPage();
  if (typeof showToast === 'function') {
    showToast(`✓ ${removedName} dihapus dari keranjang`);
  }
}

// Lanjut ke Checkout (Mencatat ke Tab Pesanan Masing-Masing & Buka Modal Sukses)
function proceedToCheckout() {
  if (!cart || cart.length === 0) {
    if (typeof showToast === 'function') {
      showToast('Keranjang Anda masih kosong.');
    }
    return;
  }

  const produceItems = cart.filter(item => item.itemType !== 'rental');
  const rentalItems = cart.filter(item => item.itemType === 'rental');

  const produceSubtotal = produceItems.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
  const rentalSubtotal = rentalItems.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
  const grandTotal = produceSubtotal + rentalSubtotal;

  const dateFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormatted = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const fullTimestamp = `${dateFormatted} • ${timeFormatted}`;

  const orders = JSON.parse(localStorage.getItem('koperasi_orders') || '[]');
  const createdIds = [];

  // Rekam pesanan Produk Hasil Tani (jika ada) -> orderType: 'store'
  if (produceItems.length > 0) {
    const storeOrderId = `#KOP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    createdIds.push(storeOrderId);
    orders.unshift({
      id: storeOrderId,
      orderType: 'store',
      date: fullTimestamp,
      items: [...produceItems],
      total: formatRupiah(produceSubtotal),
      rawTotal: produceSubtotal,
      status: 'Diproses',
      shippingMethod: 'Gratis Pengiriman (Binaan Koperasi)'
    });
  }

  // Rekam peminjaman Sewa Alsintan (jika ada) -> orderType: 'rental'
  if (rentalItems.length > 0) {
    rentalItems.forEach(rental => {
      const rentalOrderId = `#SEWA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      createdIds.push(rentalOrderId);
      const totalCost = rental.price * (rental.qty || 1);
      orders.unshift({
        id: rentalOrderId,
        orderType: 'rental',
        date: fullTimestamp,
        status: 'Menunggu ACC Admin',
        unitName: rental.name,
        unitCategory: 'Alsintan Koperasi',
        unitImage: rental.image,
        days: rental.qty || 1,
        pricePerDay: rental.price,
        operatorIncluded: false,
        deliveryIncluded: true,
        total: formatRupiah(totalCost),
        rawTotal: totalCost
      });
    });
  }

  localStorage.setItem('koperasi_orders', JSON.stringify(orders));

  // Tampilkan data pada Modal Sukses
  const modal = document.getElementById('successCheckoutModal');
  const receiptOrderId = document.getElementById('receiptOrderId');
  const receiptTotalAmount = document.getElementById('receiptTotalAmount');

  if (receiptOrderId) receiptOrderId.textContent = createdIds.join(', ');
  if (receiptTotalAmount) receiptTotalAmount.textContent = formatRupiah(grandTotal);

  // Kosongkan keranjang belanja
  cart = [];
  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  renderCartPage();
  if (typeof updateCartBadge === 'function') updateCartBadge();

  // Buka modal dialog sukses
  if (modal) {
    modal.showModal();
  }
}
