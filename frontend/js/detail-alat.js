/**
 * ==============================================================================
 * SCRIPT DETAIL SEWA ALAT (detail-alat.js)
 * ------------------------------------------------------------------------------
 * Mengatur interaktivitas halaman detail peminjaman alsintan ala Gambar 1:
 * - Load data alsintan dari URL parameter (?id=ALS-XXX)
 * - Switch 4 Thumbnail Vertikal ke Showcase Utama
 * - Toggle Spesifikasi Teknis (Read More / Ringkas)
 * - Pemilihan Edition Durasi Sewa (1 Hari, 3 Hari, 7 Hari, 14 Hari)
 * - Action Button: "Sewa Sekarang" (Buy It Now) & Tambah ke Keranjang Sewa
 * - Accordion Syarat & Ketentuan Peminjaman
 * ==============================================================================
 */

let currentRental = null;
let selectedRentalEdition = { label: '1 Hari', days: 1, multiplier: 1 };
let isRentalDescExpanded = false;

document.addEventListener('DOMContentLoaded', () => {
  loadRentalDetail();
});

// 1. Muat Data Alsintan Berdasarkan URL Query
function loadRentalDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const rentalId = urlParams.get('id');

  currentRental = KOPERASI_DATA.rentals.find(r => r.id === rentalId) || KOPERASI_DATA.rentals[0];
  if (!currentRental) return;

  // Title & Breadcrumbs
  document.title = `${currentRental.name} - Sewa Alsintan Koperasi`;
  const catBreadcrumb = document.getElementById('rentalCategoryBreadcrumb');
  if (catBreadcrumb) catBreadcrumb.textContent = currentRental.categoryName || 'Alsintan Koperasi';

  const titleEl = document.getElementById('rentalTitle');
  if (titleEl) titleEl.textContent = currentRental.name;

  // Rating & Ulasan
  const ratingEl = document.getElementById('rentalRatingVal');
  if (ratingEl) ratingEl.textContent = currentRental.rating || 4.9;

  const reviewEl = document.getElementById('rentalReviewCount');
  if (reviewEl) reviewEl.textContent = `(52 peminjaman sukses di lahan)`;

  // Render Galeri 4 Thumbnail
  renderRentalGalleryThumbnails();

  // Render Deskripsi & Spesifikasi
  renderRentalDescription();

  // Render Pilihan Durasi Hari (Edition)
  renderRentalEditionPills();

  // Update Harga Awal
  updateRentalPriceDisplay();
}

// 2. Render 4 Thumbnail Vertikal & Switcher
function renderRentalGalleryThumbnails() {
  const thumbsContainer = document.getElementById('rentalGalleryThumbs');
  const mainStageImg = document.getElementById('rentalMainShowcaseImg');
  if (!thumbsContainer || !mainStageImg) return;

  const galleryImages = [
    currentRental.image,
    "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=600&q=80"
  ];

  mainStageImg.src = galleryImages[0];
  mainStageImg.alt = currentRental.name;

  thumbsContainer.innerHTML = galleryImages.map((imgUrl, idx) => `
    <button type="button" class="thumb-btn ${idx === 0 ? 'active' : ''}" onclick="switchRentalShowcaseImage('${imgUrl}', this)" aria-label="Lihat foto alat ke-${idx + 1}">
      <img src="${imgUrl}" alt="${currentRental.name} foto ${idx + 1}" loading="lazy">
    </button>
  `).join('');
}

function switchRentalShowcaseImage(imgSrc, btnEl) {
  const mainImg = document.getElementById('rentalMainShowcaseImg');
  if (!mainImg) return;

  mainImg.style.opacity = '0.4';
  setTimeout(() => {
    mainImg.src = imgSrc;
    mainImg.style.opacity = '1';
  }, 120);

  const allBtns = document.querySelectorAll('#rentalGalleryThumbs .thumb-btn');
  allBtns.forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function toggleZoomRentalImage() {
  const mainImg = document.getElementById('rentalMainShowcaseImg');
  if (mainImg) {
    window.open(mainImg.src, '_blank');
  }
}

// 3. Render Deskripsi & Spesifikasi Mesin
function renderRentalDescription() {
  const descEl = document.getElementById('rentalDescText');
  const toggleBtn = document.getElementById('btnToggleRentalDesc');
  if (!descEl) return;

  const shortDesc = `${currentRental.power} • Kapasitas: ${currentRental.capacity}. ${currentRental.description}`;
  const fullDesc = `${shortDesc} Unit alat dan mesin pertanian ini dirawat berkala oleh tim teknisi mekanik Koperasi Tani Makmur. Siap beroperasi di berbagai kontur lahan sawah maupun ladang kering, memberikan hasil olah tanah dan perawatan panen yang lebih cepat, efisien, dan menekan biaya produksi hingga 40%.`;

  if (isRentalDescExpanded) {
    descEl.textContent = fullDesc;
    if (toggleBtn) toggleBtn.textContent = '- Tutup Sebagian';
  } else {
    descEl.textContent = shortDesc;
    if (toggleBtn) toggleBtn.textContent = '+ Baca Selengkapnya';
  }
}

function toggleRentalDescription() {
  isRentalDescExpanded = !isRentalDescExpanded;
  renderRentalDescription();
}

// 4. Render Pilihan Durasi Hari (Edition) Sesuai Referensi Gambar
function renderRentalEditionPills() {
  const container = document.getElementById('rentalEditionPillsContainer');
  if (!container) return;

  const editions = [
    { label: '1 Hari', days: 1, multiplier: 1 },
    { label: '3 Hari', days: 3, multiplier: 2.85 },
    { label: '7 Hari', days: 7, multiplier: 6.2 },
    { label: '14 Hari', days: 14, multiplier: 11.5 }
  ];

  selectedRentalEdition = editions[0];

  container.innerHTML = editions.map((ed, idx) => `
    <button type="button" class="edition-pill-btn ${idx === 0 ? 'active' : ''}" onclick="selectRentalEdition(${ed.multiplier}, '${ed.label}', ${ed.days}, this)">
      ${ed.label}
    </button>
  `).join('');
}

function selectRentalEdition(multiplier, label, days, btnEl) {
  selectedRentalEdition = { multiplier, label, days };
  
  const allPills = document.querySelectorAll('#rentalEditionPillsContainer .edition-pill-btn');
  allPills.forEach(p => p.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  updateRentalPriceDisplay();
}

// 5. Update Tarif Sewa
function updateRentalPriceDisplay() {
  if (!currentRental) return;

  const currentPriceEl = document.getElementById('rentalPriceDisplay');
  const origPriceEl = document.getElementById('rentalOrigPriceDisplay');

  const basePrice = currentRental.pricePerDay;
  const baseOrig = currentRental.originalPricePerDay || Math.round(basePrice * 1.25 / 1000) * 1000;

  const finalPrice = Math.round(basePrice * selectedRentalEdition.multiplier);
  const finalOrig = Math.round(baseOrig * selectedRentalEdition.multiplier);

  if (currentPriceEl) {
    currentPriceEl.innerHTML = `${formatRupiah(finalPrice)} <small style="font-size: 0.95rem; color: #6B7280; font-weight: normal;">/ ${selectedRentalEdition.label}</small>`;
  }
  if (origPriceEl) {
    origPriceEl.textContent = formatRupiah(finalOrig);
  }
}

// 6. Action: Sewa Sekarang (Buy It Now) & Tambah ke Keranjang
function detailRentNow() {
  if (!currentRental) return;

  const finalPrice = Math.round(currentRental.pricePerDay * selectedRentalEdition.multiplier);
  let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');

  cart.push({
    id: `${currentRental.id}-${selectedRentalEdition.days}D`,
    name: `${currentRental.name} (${selectedRentalEdition.label})`,
    price: finalPrice,
    unit: selectedRentalEdition.label,
    itemType: 'rental',
    image: currentRental.image,
    qty: selectedRentalEdition.days
  });

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  if (typeof updateCartBadge === 'function') updateCartBadge();
  window.location.href = 'cart.html';
}

function detailAddRentalToCart() {
  if (!currentRental) return;

  const finalPrice = Math.round(currentRental.pricePerDay * selectedRentalEdition.multiplier);
  let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');

  const cartItemId = `${currentRental.id}-${selectedRentalEdition.days}D`;
  const existing = cart.find(i => i.id === cartItemId && i.itemType === 'rental');

  if (existing) {
    existing.qty = (existing.qty || 1) + selectedRentalEdition.days;
  } else {
    cart.push({
      id: cartItemId,
      name: `${currentRental.name} (${selectedRentalEdition.label})`,
      price: finalPrice,
      unit: selectedRentalEdition.label,
      itemType: 'rental',
      image: currentRental.image,
      qty: selectedRentalEdition.days
    });
  }

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  if (typeof updateCartBadge === 'function') updateCartBadge();
  if (typeof showToast === 'function') {
    showToast(`✓ Ditambahkan ke sewa alsintan: ${currentRental.name} (${selectedRentalEdition.label})`);
  }
}

// 7. Accordions Interactive Toggle
function toggleAccordion(btn) {
  const item = btn.closest('.detail-accordion-item');
  if (item) {
    item.classList.toggle('open');
  }
}
