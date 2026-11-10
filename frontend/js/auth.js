/**
 * ==============================================================================
 * LOGIKA AUTENTIKASI SIMULASI (auth.js)
 * ------------------------------------------------------------------------------
 * Mengatur alur perpindahan role:
 * - Pembeli -> Dialihkan ke Toko Online (toko.html)
 * - Petani -> Dialihkan ke Dashboard Petani (dashboard-petani.html)
 * - Admin -> Simulasi konfirmasi login admin
 * - Tombol shortcut 1-klik untuk presentasi demo
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const tabUser = document.getElementById('tabUser');
  const tabAdmin = document.getElementById('tabAdmin');
  const userSubSelector = document.getElementById('userSubSelector');
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const roleHelpText = document.getElementById('roleHelpText');

  let currentTab = 'user'; // 'user' atau 'admin'

  // Ganti Tab Utama (User vs Admin)
  if (tabUser && tabAdmin) {
    tabUser.addEventListener('click', () => {
      currentTab = 'user';
      tabUser.classList.add('active');
      tabAdmin.classList.remove('active');
      if (userSubSelector) userSubSelector.style.display = 'flex';
      if (roleHelpText) roleHelpText.textContent = 'Masuk sebagai anggota koperasi (Pembeli atau Petani Mitra).';
    });

    tabAdmin.addEventListener('click', () => {
      currentTab = 'admin';
      tabAdmin.classList.add('active');
      tabUser.classList.remove('active');
      if (userSubSelector) userSubSelector.style.display = 'none';
      if (roleHelpText) roleHelpText.textContent = 'Masuk sebagai Administrator Pengurus Koperasi.';
    });
  }

  // Handle Form Submit
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (currentTab === 'admin') {
        showToast('✓ Berhasil Masuk sebagai Admin Koperasi');
        setTimeout(() => {
          alert('Mode Simulasi: Anda berhasil login sebagai Admin Koperasi. Silakan kembangkan panel admin sesuai kebutuhan tim Anda.');
        }, 600);
        return;
      }

      // Cek apakah radio Petani atau Pembeli terpilih
      const isPetani = document.querySelector('input[name="userRole"]:checked')?.value === 'petani';

      if (isPetani) {
        showToast('✓ Berhasil Masuk! Mengalihkan ke Dashboard Petani...');
        setTimeout(() => {
          window.location.href = 'dashboard-petani.html';
        }, 800);
      } else {
        showToast('✓ Berhasil Masuk! Selamat berbelanja...');
        setTimeout(() => {
          window.location.href = 'toko.html';
        }, 800);
      }
    });
  }
});

// Shortcut 1-Klik Isi Data Demo untuk Kemudahan Tim
function fillDemoUser(type) {
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const radioPetani = document.getElementById('rolePetani');
  const radioPembeli = document.getElementById('rolePembeli');
  const tabUser = document.getElementById('tabUser');
  const tabAdmin = document.getElementById('tabAdmin');

  if (type === 'petani') {
    tabUser?.click();
    if (radioPetani) radioPetani.checked = true;
    if (emailInput) emailInput.value = 'pak.joko@agricharm.id';
    if (passwordInput) passwordInput.value = 'petani123';
    showToast('Demo diisi: Petani Pak Joko (Punya Dashboard)');
  } else if (type === 'pembeli') {
    tabUser?.click();
    if (radioPembeli) radioPembeli.checked = true;
    if (emailInput) emailInput.value = 'ani.pembeli@gmail.com';
    if (passwordInput) passwordInput.value = 'pembeli123';
    showToast('Demo diisi: Pembeli Ani (Belanja Produk & Sewa)');
  } else if (type === 'admin') {
    tabAdmin?.click();
    if (emailInput) emailInput.value = 'admin.pusat@koperasi.id';
    if (passwordInput) passwordInput.value = 'adminrahasia';
    showToast('Demo diisi: Administrator Koperasi');
  }
}
