/**
 * ==============================================================================
 * LOGIKA AUTENTIKASI USER KOPERASI (auth.js)
 * ------------------------------------------------------------------------------
 * Mendukung tampilan minimalis ala referensi:
 * - Mode utama: Magic link ke email
 * - Toggle mode: Masuk menggunakan kata sandi (Pembeli / Petani Mitra)
 * - Toggle daftar akun baru gratis
 * - Tombol Single Sign-On (SSO) untuk masuk cepat Pembeli / Petani
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const passwordSection = document.getElementById('passwordSection');
  const togglePasswordModeBtn = document.getElementById('togglePasswordModeBtn');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const toggleRegisterBtn = document.getElementById('toggleRegisterBtn');
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const authHeading = document.getElementById('authHeading');
  const authStatusBanner = document.getElementById('authStatusBanner');
  const ssoBtn = document.getElementById('ssoBtn');
  const ssoPanel = document.getElementById('ssoPanel');
  const termsLink = document.getElementById('termsLink');
  const privacyLink = document.getElementById('privacyLink');

  let usePasswordMode = false;
  let isRegisterMode = false;

  const urlParams = new URLSearchParams(window.location.search);
  const redirectTarget = urlParams.get('redirect');

  const updateAuthView = () => {
    if (isRegisterMode) {
      authHeading.textContent = 'Buat akun Koperasi';
      toggleRegisterBtn.textContent = 'Sudah punya akun? Masuk';
      submitAuthBtn.textContent = usePasswordMode ? 'Daftar sekarang' : 'Kirim tautan daftar';
      passwordInput.setAttribute('autocomplete', 'new-password');
    } else {
      authHeading.textContent = 'Halo, selamat datang!';
      toggleRegisterBtn.textContent = 'Daftar gratis';
      submitAuthBtn.textContent = usePasswordMode ? 'Masuk sekarang' : 'Kirim tautan masuk';
      passwordInput.setAttribute('autocomplete', 'current-password');
    }

    passwordSection.hidden = !usePasswordMode;
    passwordInput.disabled = !usePasswordMode;
    passwordInput.required = usePasswordMode;
    togglePasswordModeBtn.textContent = usePasswordMode
      ? 'Masuk menggunakan tautan email'
      : 'Masuk menggunakan kata sandi';
  };

  const showStatus = (message) => {
    if (!authStatusBanner) return;
    authStatusBanner.textContent = message;
    authStatusBanner.hidden = false;
  };

  // Toggle mode kata sandi vs magic link
  togglePasswordModeBtn?.addEventListener('click', () => {
    usePasswordMode = !usePasswordMode;
    updateAuthView();
    if (usePasswordMode) {
      passwordInput.focus();
    } else {
      emailInput.focus();
    }
  });

  // Toggle daftar gratis vs masuk
  toggleRegisterBtn?.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    if (authStatusBanner) authStatusBanner.hidden = true;
    updateAuthView();
    emailInput.focus();
  });

  // Toggle tampilkan/sembunyikan kata sandi
  togglePasswordBtn?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordBtn.setAttribute('aria-pressed', String(isHidden));
    togglePasswordBtn.setAttribute(
      'aria-label',
      isHidden ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
    );
  });

  // Toggle panel Single Sign-On (SSO)
  ssoBtn?.addEventListener('click', () => {
    const isOpen = !ssoPanel.hidden;
    ssoPanel.hidden = isOpen;
    ssoBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  // Pilihan masuk cepat SSO
  document.querySelectorAll('[data-sso-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-sso-role');
      if (role === 'petani') {
        localStorage.setItem('koperasi_role', 'petani');
        showStatus('Berhasil terhubung via SSO Koperasi sebagai Petani Mitra. Mengalihkan ke Dashboard...');
        setTimeout(() => {
          window.location.href = redirectTarget || 'dashboard-petani.html';
        }, 700);
      } else {
        localStorage.setItem('koperasi_role', 'pembeli');
        showStatus('Berhasil terhubung via SSO Koperasi sebagai Pembeli. Mengalihkan...');
        setTimeout(() => {
          window.location.href = redirectTarget || 'toko.html';
        }, 700);
      }
    });
  });

  // Link syarat & privasi
  termsLink?.addEventListener('click', (e) => {
    e.preventDefault();
    showStatus('Syarat Layanan: Keanggotaan Koperasi tunduk pada AD/ART Koperasi Tani Makmur.');
  });

  privacyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    showStatus('Kebijakan Privasi: Data email anggota hanya digunakan untuk autentikasi dan layanan koperasi.');
  });

  // Submit form utama
  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      emailInput.focus();
      return;
    }

    if (!usePasswordMode) {
      const actionLabel = isRegisterMode ? 'pendaftaran' : 'masuk';
      showStatus(`Tautan ${actionLabel} telah dikirim ke ${email}. Silakan periksa kotak masuk email Anda.`);
      if (typeof showToast === 'function') {
        showToast(`✓ Tautan masuk dikirim ke ${email}`);
      }
      return;
    }

    const isPetani = document.querySelector('input[name="userRole"]:checked')?.value === 'petani';
    if (isPetani) {
      localStorage.setItem('koperasi_role', 'petani');
      showStatus('Berhasil masuk sebagai Petani Mitra. Mengalihkan ke Dashboard Petani...');
      setTimeout(() => {
        window.location.href = redirectTarget || 'dashboard-petani.html';
      }, 700);
    } else {
      localStorage.setItem('koperasi_role', 'pembeli');
      showStatus('Berhasil masuk ke akun Pembeli. Mengalihkan ke Toko Online Koperasi...');
      setTimeout(() => {
        window.location.href = redirectTarget || 'toko.html';
      }, 700);
    }
  });
});
