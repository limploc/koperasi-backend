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
  checkUrlParams();
});

// Cek apakah ada query string kategori (misal: toko.html?cat=jagung)
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('cat');
  if (catParam) {
    const catBtn = document.querySelector(`.cat-tab-btn[data-cat="${catParam}"], .cat-btn[data-cat="${catParam}"]`);
    if (catBtn) catBtn.click();
  }

  // Jika hash adalah #cart, langsung alihkan ke cart.html
  if (window.location.hash === '#cart') {
    window.location.href = 'cart.html';
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

  grid.innerHTML = filtered.map(item => {
    const origPrice = item.originalPrice || Math.round(item.price * 1.3 / 1000) * 1000;
    return `
      <article class="product-card">
        <div class="product-image-container" onclick="goToProductDetail('${item.id}')">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
        </div>
        <div class="product-content">
          <div class="product-price-row">
            <span class="price-current">${formatRupiah(item.price)}</span>
            <span class="price-original">${formatRupiah(origPrice)}</span>
          </div>

          <div class="product-title-row">
            <h3 class="product-name" onclick="goToProductDetail('${item.id}')" title="${item.name}">${item.name}</h3>
            <div class="product-rating-box">
              <svg class="star-rating-icon" width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>${item.rating}</span>
            </div>
          </div>

          <p class="product-description" onclick="goToProductDetail('${item.id}')">
            ${item.description} <span class="see-more-link">Selengkapnya</span>
          </p>

          <div class="product-action-buttons">
            <button class="btn-buy-now" type="button" onclick="buyNow('${item.id}')">Beli Sekarang</button>
            <button class="btn-add-cart" type="button" onclick="addToCart('${item.id}')">+ Keranjang</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Navigasi ke Halaman Detail Produk Baru
function goToProductDetail(productId) {
  window.location.href = `detail-produk.html?id=${productId}`;
}

// Beli Sekarang: Tambahkan ke Keranjang dan Langsung Arahkan ke Halaman cart.html
function buyNow(productId) {
  addToCart(productId, 1);
  window.location.href = 'cart.html';
}

// Setup Tombol Filter Kategori (Minimalis Centered Tabs)
function setupFilterButtons() {
  const catButtons = document.querySelectorAll('.cat-tab-btn, .cat-btn');
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
  const firstCat = document.querySelector('.cat-tab-btn[data-cat="all"], .cat-btn[data-cat="all"]');
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
        <div style="font-size: 0.8rem; font-weight: 700; color: #0A7337; text-transform: uppercase; margin-bottom: 0.25rem;">${product.categoryName}</div>
        <h2 style="font-size: 1.5rem; margin: 0 0 0.25rem 0;">${product.name}</h2>
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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-top: 1rem;">
          <button class="btn-buy-now" style="padding: 0.75rem;" onclick="buyNow('${product.id}'); document.getElementById('productDetailModal').close();">
            Beli Sekarang
          </button>
          <button class="btn-add-cart" style="padding: 0.75rem;" onclick="addToCart('${product.id}'); document.getElementById('productDetailModal').close();">
            + Keranjang
          </button>
        </div>
      </div>
    </div>
  `;

  modal.showModal();
}
