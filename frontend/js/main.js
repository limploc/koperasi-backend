/**
 * ==============================================================================
 * SCRIPT UTAMA (main.js)
 * ------------------------------------------------------------------------------
 * Mengatur interaksi global:
 * - Navigasi responsif (Hamburger & Mobile Pill Menu)
 * - Sistem Cart terintegrasi di localStorage
 * - Toast notifikasi elegan
 * ==============================================================================
 */

// Inisialisasi Cart dari localStorage atau array kosong
let cart = JSON.parse(localStorage.getItem('koperasi_cart') || '[]');

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  updateCartBadge();
});

// Setup Mobile Menu Toggle
function setupMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-menu-toggle');
  const header = document.querySelector('.site-header');

  if (toggleBtn && header) {
    toggleBtn.addEventListener('click', () => {
      header.classList.toggle('menu-open');
    });

    // Tutup saat link di-klik
    const navLinks = header.querySelectorAll('.nav-pill-container a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        header.classList.remove('menu-open');
      });
    });
  }
}

// Update Angka Badge Keranjang
function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-counter');
  const totalItems = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  badges.forEach(b => {
    b.textContent = totalItems;
    b.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

// Tambah item ke keranjang
function addToCart(productId, qty = 1) {
  const product = KOPERASI_DATA.products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
      qty: qty
    });
  }

  localStorage.setItem('koperasi_cart', JSON.stringify(cart));
  updateCartBadge();
  showToast(`✓ Ditambahkan ke keranjang: ${product.name}`);
}

// Fungsi Menampilkan Notifikasi Toast
function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}
