/**
 * ==============================================================================
 * SCRIPT TOKO ONLINE (toko.js)
 * ------------------------------------------------------------------------------
 * Mengatur filter kategori, pencarian, sort produk, modal detail HTML5 <dialog>,
 * dan keranjang belanja interaktif.
 * ==============================================================================
 */

let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'popular';

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  setupFilterButtons();
  setupSearchAndSort();
  setupCartDialog();
  checkUrlParams();
});

// Cek apakah ada query string kategori (misal: toko.html?cat=beras)
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('cat');
  if (catParam) {
    const catBtn = document.querySelector(`.cat-btn[data-cat="${catParam}"]`);
    if (catBtn) catBtn.click();
  }

  // Jika hash adalah #cart, langsung buka dialog cart
  if (window.location.hash === '#cart') {
    openCartModal();
  }
}

// Render Daftar Produk ke Grid
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let filtered = KOPERASI_DATA.products.filter(item => {
    const matchCat = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.farmer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Sorting
  if (currentSort === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    filtered.sort((a, b) => b.sold - a.sold); // Default: Terlaris
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
        <p style="font-size: 1.15rem; color: #6B7280;">Tidak ada produk yang cocok dengan pencarian Anda.</p>
        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="resetFilters()">Reset Filter</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <article class="product-card">
      <div class="product-image-container" onclick="openProductDetail('${item.id}')">
        <span class="product-tag">${item.isOrganic ? 'Organik' : item.freshness}</span>
        <img src="${item.image}" alt="${item.name}" loading="lazy">
      </div>
      <div class="product-content">
        <div class="product-meta">
          <span class="product-cat">${item.categoryName}</span>
          <span class="product-rating">★ ${item.rating} (${item.sold})</span>
        </div>
        <h3 class="product-name" onclick="openProductDetail('${item.id}')">${item.name}</h3>
        <p class="product-farmer">Petani: ${item.farmer}</p>
        
        <div class="product-action-row">
          <div class="product-price">
            ${formatRupiah(item.price)} <span>/ ${item.unit}</span>
          </div>
          <button class="btn btn-dark" style="padding: 0.5rem 1rem;" onclick="addToCart('${item.id}')">
            + Keranjang
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// Setup Tombol Filter Kategori
function setupFilterButtons() {
  const catButtons = document.querySelectorAll('.cat-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-cat') || 'all';
      renderProducts();
    });
  });
}

// Setup Search & Sort Event
function setupSearchAndSort() {
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });
  }
}

function resetFilters() {
  activeCategory = 'all';
  searchQuery = '';
  currentSort = 'popular';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const firstCat = document.querySelector('.cat-btn[data-cat="all"]');
  if (firstCat) firstCat.click();
}

// Buka Modal Detail Produk Native <dialog>
function openProductDetail(productId) {
  const product = KOPERASI_DATA.products.find(p => p.id === productId);
  const modal = document.getElementById('productDetailModal');
  const body = document.getElementById('productModalBody');
  if (!product || !modal || !body) return;

  body.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem; align-items: start;">
      <img src="${product.image}" alt="${product.name}" style="width: 100%; border-radius: var(--radius-lg); object-fit: cover; aspect-ratio: 1/1;">
      <div>
        <span class="badge-tag" style="padding-left:0;"><span class="dot-green"></span> ${product.categoryName}</span>
        <h2 style="font-size: 1.5rem; margin: 0.5rem 0 0.25rem 0;">${product.name}</h2>
        <p style="color: #6B7280; font-size: 0.85rem; margin-bottom: 1rem;">Mitra: ${product.farmer}</p>
        
        <div style="font-size: 1.5rem; font-weight: 800; color: #111827; margin-bottom: 1rem;">
          ${formatRupiah(product.price)} <span style="font-size: 0.85rem; font-weight: 400; color: #6B7280;">/ ${product.unit}</span>
        </div>

        <p style="font-size: 0.9rem; line-height: 1.6; color: #4B5563; margin-bottom: 1.25rem;">
          ${product.description}
        </p>

        <div style="background: #F9FAFB; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1.5rem;">
          <div>🌾 <strong>Kondisi:</strong> ${product.freshness}</div>
          <div style="margin-top: 0.25rem;">📦 <strong>Sisa Stok:</strong> ${product.stock} ${product.unit}</div>
        </div>

        <button class="btn btn-dark" style="width: 100%; padding: 0.75rem;" onclick="addToCart('${product.id}'); document.getElementById('productDetailModal').close();">
          + Tambahkan ke Keranjang
        </button>
      </div>
    </div>
  `;

  modal.showModal();
}

// Setup Cart Dialog
function setupCartDialog() {
  const modal = document.getElementById('cartModal');
  if (!modal) return;

  // Tutup dialog saat klik di luar kotak (backdrop click)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

function openCartModal() {
  const modal = document.getElementById('cartModal');
  const itemsContainer = document.getElementById('cartItemsContainer');
  const totalDisplay = document.getElementById('cartTotalDisplay');
  if (!modal || !itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: #6B7280;">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Keranjang Anda masih kosong.</p>
        <p style="font-size: 0.85rem;">Pilih hasil panen segar favorit Anda dari katalog toko.</p>
      </div>
    `;
    if (totalDisplay) totalDisplay.textContent = formatRupiah(0);
  } else {
    let grandTotal = 0;
    itemsContainer.innerHTML = cart.map((item, idx) => {
      const subtotal = item.price * item.qty;
      grandTotal += subtotal;
      return `
        <div class="cart-item-row">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.name}</h4>
            <div class="cart-item-price">${formatRupiah(item.price)} / ${item.unit}</div>
          </div>
          <div class="cart-qty-control">
            <button class="cart-qty-btn" onclick="updateItemQty(${idx}, -1)">-</button>
            <span style="font-size: 0.9rem; font-weight: 600; min-width: 20px; text-align: center;">${item.qty}</span>
            <button class="cart-qty-btn" onclick="updateItemQty(${idx}, 1)">+</button>
          </div>
          <button style="color: #EF4444; font-size: 1.1rem; padding: 0 4px;" title="Hapus" onclick="removeCartItem(${idx})">&times;</button>
        </div>
      `;
    }).join('');

    if (totalDisplay) totalDisplay.textContent = formatRupiah(grandTotal);
  }

  modal.showModal();
}

function updateItemQty(index, change) {
  if (!cart[index]) return;
  cart[index].qty += change;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  updateCartBadge();
  openCartModal(); // Refresh tampilan modal
}

function removeCartItem(index) {
  cart.splice(index, 1);
  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  updateCartBadge();
  openCartModal();
}

function checkoutSimulasi() {
  if (cart.length === 0) {
    alert('Keranjang masih kosong!');
    return;
  }
  alert('Simulasi Checkout Berhasil!\nTotal pesanan Anda telah dicatat. Tim dapat menghubungkan ini ke payment gateway atau WhatsApp Koperasi.');
  cart = [];
  localStorage.removeItem('koperasi_cart');
  updateCartBadge();
  document.getElementById('cartModal')?.close();
}
