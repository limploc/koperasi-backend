/**
 * ==============================================================================
 * SCRIPT HALAMAN PROFIL (profil.js)
 * ------------------------------------------------------------------------------
 * Mengatur:
 * 1. Inisialisasi Data Pengguna Berdasarkan Role (Petani vs Pembeli)
 * 2. Pengisian & Penyimpanan Data Formulir Personal Info
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  populatePersonalForm();
});

// 1. Inisialisasi Data Pengguna Berdasarkan Role
function initUserProfile() {
  const userRole = localStorage.getItem('koperasi_role') || 'pembeli';
  const nameEl = document.getElementById('profileUserName');
  const roleEl = document.getElementById('profileUserRole');
  const avatarEl = document.getElementById('profileUserAvatar');

  if (userRole === 'petani') {
    if (nameEl) nameEl.textContent = 'Pak Joko Sastro';
    if (roleEl) roleEl.textContent = 'Petani Mitra Koperasi';
    if (avatarEl) {
      avatarEl.innerHTML = `🌾`;
      avatarEl.style.background = '#15803D';
      avatarEl.style.color = '#FFFFFF';
    }
  } else {
    if (nameEl) nameEl.textContent = 'Anzhela Pozharum';
    if (roleEl) roleEl.textContent = 'Anggota Pembeli';
    if (avatarEl) {
      avatarEl.innerHTML = `<img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }
  }
}

// 2. Isi Formulir Informasi Pribadi
function populatePersonalForm() {
  const userRole = localStorage.getItem('koperasi_role') || 'pembeli';
  const nameInput = document.getElementById('inputFullName');
  const emailInput = document.getElementById('inputEmail');
  const phoneInput = document.getElementById('inputPhone');
  const addressInput = document.getElementById('inputAddress');
  const roleInput = document.getElementById('inputRole');

  if (userRole === 'petani') {
    if (nameInput) nameInput.value = 'Pak Joko Sastro';
    if (emailInput) emailInput.value = 'pak.joko@koperasitani.id';
    if (phoneInput) phoneInput.value = '+62 812-9876-5432';
    if (addressInput) addressInput.value = 'Blok Lahan C-12, Desa Sukamaju';
    if (roleInput) roleInput.value = 'Petani Mitra Koperasi';
  } else {
    if (nameInput) nameInput.value = 'Anzhela Pozharum';
    if (emailInput) emailInput.value = 'anzhela.pozharum@gmail.com';
    if (phoneInput) phoneInput.value = '+62 813-2233-4455';
    if (addressInput) addressInput.value = 'Jl. Sukamaju No. 42, RT 03/RW 04';
    if (roleInput) roleInput.value = 'Anggota Pembeli Umum';
  }
}
