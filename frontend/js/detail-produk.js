/**
 * ==============================================================================
 * SCRIPT DETAIL PRODUK (detail-produk.js)
 * ------------------------------------------------------------------------------
 * Mengatur interaktivitas halaman detail produk ala Gambar 1:
 * - Load data produk dari URL parameter (?id=PRD-XXX)
 * - Switch 4 Thumbnail Vertikal ke Showcase Utama
 * - Toggle Deskripsi (Read More / Ringkas)
 * - Pemilihan Varian / Edition Kemasan (1kg, 2kg, 5kg) & Update Harga Dinamis
 * - Action Button: "Buy It Now" (Beli Sekarang) & Tambah ke Keranjang
 * - Accordion Garansi & Pengiriman
 * ==============================================================================
 */

let currentProduct = null;
let selectedEdition = { label: '1 kg', multiplier: 1 };
let isDescExpanded = false;

document.addEventListener('DOMContentLoaded', () => {
  loadProductDetail();
});

// 1. Muat Data Produk Berdasarkan URL Query
function loadProductDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  currentProduct = KOPERASI_DATA.products.find(p => p.id === productId) || KOPERASI_DATA.products[0];
  if (!currentProduct) return;

  // Title & Breadcrumb
  document.title = `${currentProduct.name} - Koperasi Tani`;
  const catBreadcrumb = document.getElementById('productCategoryBreadcrumb');
  if (catBreadcrumb) catBreadcrumb.textContent = currentProduct.categoryName || 'Hasil Tani';

  const titleEl = document.getElementById('productTitle');
  if (titleEl) titleEl.textContent = currentProduct.name;

  // Rating & Ulasan
  const ratingEl = document.getElementById('productRatingVal');
  if (ratingEl) ratingEl.textContent = currentProduct.rating || 4.9;

  const reviewEl = document.getElementById('productReviewCount');
  if (reviewEl) reviewEl.textContent = `(${currentProduct.sold || 184} ulasan pembeli)`;

  // Render Galeri 4 Thumbnail
  renderGalleryThumbnails();

  // Render Deskripsi
  renderDescription();

  // Render Pilihan Edition / Varian Kemasan
  renderEditionPills();

  // Update Harga Awal
  updatePriceDisplay();
}

// 2. Render 4 Thumbnail Vertikal & Event Switcher
function renderGalleryThumbnails() {
  const thumbsContainer = document.getElementById('galleryThumbs');
  const mainStageImg = document.getElementById('mainShowcaseImg');
  if (!thumbsContainer || !mainStageImg) return;

  // Siapkan 4 gambar variasi untuk galeri
  const galleryImages = [
    currentProduct.image,
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=600&q=80"
  ];

  mainStageImg.src = galleryImages[0];
  mainStageImg.alt = currentProduct.name;

  thumbsContainer.innerHTML = galleryImages.map((imgUrl, idx) => `
    <button type="button" class="thumb-btn ${idx === 0 ? 'active' : ''}" onclick="switchShowcaseImage('${imgUrl}', this)" aria-label="Lihat foto ke-${idx + 1}">
      <img src="${imgUrl}" alt="${currentProduct.name} foto ${idx + 1}" loading="lazy">
    </button>
  `).join('');
}

function switchShowcaseImage(imgSrc, btnEl) {
  const mainImg = document.getElementById('mainShowcaseImg');
  if (!mainImg) return;

  mainImg.style.opacity = '0.4';
  setTimeout(() => {
    mainImg.src = imgSrc;
    mainImg.style.opacity = '1';
  }, 120);

  const allBtns = document.querySelectorAll('.thumb-btn');
  allBtns.forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function toggleZoomImage() {
  const mainImg = document.getElementById('mainShowcaseImg');
  if (mainImg) {
    window.open(mainImg.src, '_blank');
  }
}

// 3. Render Deskripsi Produk & Toggle Read More
function renderDescription() {
  const descEl = document.getElementById('productDescText');
  const toggleBtn = document.getElementById('btnToggleDesc');
  if (!descEl) return;

  const fullText = `${currentProduct.description} Komoditas ini dirawat secara presisi dengan pupuk organik binaan Koperasi Tani Makmur oleh ${currentProduct.farmer}. Hasil panen telah lolos uji laboratorium bebas pestisida kimia sintetis, menjamin kesegaran dan cita rasa alami terbaik untuk kebutuhan konsumsi harian keluarga Anda.`;

  if (isDescExpanded) {
    descEl.textContent = fullText;
    if (toggleBtn) toggleBtn.textContent = '- Tutup Sebagian';
  } else {
    descEl.textContent = currentProduct.description;
    if (toggleBtn) toggleBtn.textContent = '+ Baca Selengkapnya';
  }
}

function toggleProductDescription() {
  isDescExpanded = !isDescExpanded;
  renderDescription();
}

// 4. Render Pilihan Edition / Varian Kemasan Sesuai Referensi Gambar
function renderEditionPills() {
  const container = document.getElementById('editionPillsContainer');
  if (!container) return;

  let editions = [];
  const unitStr = (currentProduct.unit || '').toLowerCase();

  if (unitStr.includes('butir')) {
    editions = [
      { label: '1 Butir', multiplier: 1 },
      { label: '5 Butir', multiplier: 4.8 },
      { label: '10 Butir', multiplier: 9.2 }
    ];
  } else if (unitStr.includes('ml')) {
    editions = [
      { label: '250 ml', multiplier: 1 },
      { label: '500 ml', multiplier: 1.9 },
      { label: '1 Liter', multiplier: 3.6 }
    ];
  } else {
    // Default kemasan bobot kg / gr
    editions = [
      { label: '1 kg', multiplier: 1 },
      { label: '2.5 kg', multiplier: 2.4 },
      { label: '5 kg', multiplier: 4.6 }
    ];
  }

  selectedEdition = editions[0];

  container.innerHTML = editions.map((ed, idx) => `
    <button type="button" class="edition-pill-btn ${idx === 0 ? 'active' : ''}" onclick="selectEdition(${ed.multiplier}, '${ed.label}', this)">
      ${ed.label}
    </button>
  `).join('');
}

function selectEdition(multiplier, label, btnEl) {
  selectedEdition = { multiplier, label };
  
  const allPills = document.querySelectorAll('.edition-pill-btn');
  allPills.forEach(p => p.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  updatePriceDisplay();
}

// 5. Update Tampilan Harga Sesuai Edition yang Dipilih
function updatePriceDisplay() {
  if (!currentProduct) return;

  const currentPriceEl = document.getElementById('productPriceDisplay');
  const origPriceEl = document.getElementById('productOrigPriceDisplay');

  const basePrice = currentProduct.price;
  const baseOrig = currentProduct.originalPrice || Math.round(basePrice * 1.3 / 1000) * 1000;

  const finalPrice = Math.round(basePrice * selectedEdition.multiplier);
  const finalOrig = Math.round(baseOrig * selectedEdition.multiplier);

  if (currentPriceEl) currentPriceEl.textContent = formatRupiah(finalPrice);
  if (origPriceEl) origPriceEl.textContent = formatRupiah(finalOrig);
}

// 6. Action: Beli Sekarang (Buy It Now) & Tambah Keranjang
function detailBuyNow() {
  if (!currentProduct) return;

  const finalPrice = Math.round(currentProduct.price * selectedEdition.multiplier);
  let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');

  cart.push({
    id: `${currentProduct.id}-${selectedEdition.label.replace(/\s+/g, '')}`,
    name: `${currentProduct.name} (${selectedEdition.label})`,
    price: finalPrice,
    unit: selectedEdition.label,
    image: currentProduct.image,
    itemType: 'store',
    qty: 1
  });

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  if (typeof updateCartBadge === 'function') updateCartBadge();
  window.location.href = 'cart.html';
}

function detailAddToCart() {
  if (!currentProduct) return;

  const finalPrice = Math.round(currentProduct.price * selectedEdition.multiplier);
  let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');

  const cartItemId = `${currentProduct.id}-${selectedEdition.label.replace(/\s+/g, '')}`;
  const existing = cart.find(i => i.id === cartItemId);

  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id: cartItemId,
      name: `${currentProduct.name} (${selectedEdition.label})`,
      price: finalPrice,
      unit: selectedEdition.label,
      image: currentProduct.image,
      itemType: 'store',
      qty: 1
    });
  }

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  if (typeof updateCartBadge === 'function') updateCartBadge();
  if (typeof showToast === 'function') {
    showToast(`✓ Ditambahkan ke keranjang: ${currentProduct.name} (${selectedEdition.label})`);
  }
}

// 7. Accordions Interactive Toggle
function toggleAccordion(btn) {
  const item = btn.closest('.detail-accordion-item');
  if (item) {
    item.classList.toggle('open');
  }
}
