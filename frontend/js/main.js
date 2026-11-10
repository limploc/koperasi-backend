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
  syncNavbarRole();
});

// Sinkronisasi Role User (Pembeli vs Petani) dan Tampilan Navbar
function syncNavbarRole() {
  const userRole = localStorage.getItem('koperasi_role') || 'pembeli';
  const currentPath = window.location.pathname.toLowerCase();
  
  // Deteksi apakah sedang berada di landing page (index.html atau root)
  const isLandingPage = currentPath.endsWith('index.html') || 
                        currentPath.endsWith('/') || 
                        currentPath === '' || 
                        currentPath.endsWith('frontend') || 
                        currentPath.endsWith('frontend/');

  // 1. Logika Tampilan Menu Dashboard di Navbar Pill
  const dashLinks = document.querySelectorAll('.nav-pill-container a[href*="dashboard"]');
  dashLinks.forEach(link => {
    if (isLandingPage) {
      // Pada beranda, sembunyikan menu dashboard
      link.style.display = 'none';
    } else {
      // Pada halaman setelah login (toko, sewa, dashboard, profil):
      // Jika peran adalah 'petani' -> Tampilkan menu Dashboard
      // Jika peran adalah 'pembeli' -> Sembunyikan menu Dashboard
      if (userRole === 'petani') {
        link.style.display = '';
      } else {
        link.style.display = 'none';
      }
    }
  });

  // 2. Logika Tombol Kanan Atas (Logout vs Daftar)
  const authBtns = document.querySelectorAll('.btn-header-signup');
  authBtns.forEach(btn => {
    if (isLandingPage) {
      btn.textContent = 'Daftar';
      btn.setAttribute('href', 'register.html');
    } else {
      // Pada halaman toko dan lainnya setelah login: tombol menjadi 'Logout'
      btn.textContent = 'Logout';
      btn.setAttribute('href', 'login.html');
      btn.onclick = function() {
        // Reset role ke default saat logout
        localStorage.removeItem('koperasi_role');
      };
    }
  });

  // 3. Pada Beranda (index.html): Klik Toko Online atau Sewa Alat dialihkan ke Halaman Login
  if (isLandingPage) {
    const restrictedLinks = document.querySelectorAll('a[href*="toko.html"], a[href*="sewa.html"]');
    restrictedLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetHref = link.getAttribute('href') || 'toko.html';
        window.location.href = `login.html?redirect=${encodeURIComponent(targetHref)}`;
      });
    });
  }
}

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
