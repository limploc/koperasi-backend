# 🌾 Template Web Koperasi & Ekosistem Pertanian Modern (Anti AI-Slop)

Template web berbasis **HTML5, CSS3, dan Vanilla JavaScript modern** yang dirancang khusus untuk memadukan estetika visual editorial agritech premium (berkiblat pada desain referensi Luckycharm) dengan sistem fungsional Koperasi Pertanian.

Dibangun tanpa ketergantungan framework berat (*zero build-step*), sehingga **sangat mudah dirombak, dibaca, dan disesuaikan oleh tim/teman Anda** untuk kebutuhan tugas, proyek, skripsi, maupun pengembangan produk nyata.

---

## 📸 1. Replikasi Desain Beranda (Sesuai Referensi Visual)

Halaman Beranda (`index.html`) mengadopsi struktur visual yang persis dengan referensi:
1. **Header**: Logo dengan 4 rounded dots grid, navigasi tengah berbentuk kapsul hitam (*dark pill*), dan tombol *Sign Up* outline di kanan.
2. **Hero Section**: 
   - Badge kecil hijau: `• Precision Agriculture`
   - Judul besar: **The Journey To A Perfection.**
   - Subtitle elegan dengan kontras teks slate.
   - Tombol kapsul hitam berpanah: `Explore Our Farms →`
   - Dekorasi 4 silang bintang (`+`) terapung dan garis panduan putus-putus vertikal samar di latar belakang.
   - Foto panorama ladang pertanian luas dengan sudut melengkung (*rounded corners*).
3. **4-Column Key Metrics Bar**:
   - `50+` Years Of Experience
   - `200+` Acres Managed
   - `120,000+` Farmers Supported
   - `$15 Billion` Agricultural Impact
4. **Editorial Statement (2025 & Filosofi)**:
   - Sisi kiri: Tahun `2025` dan tag kategori pertanian berkelanjutan.
   - Sisi kanan: Kutipan filosofis agritech tipografi editorial.
5. **Bento Showcase Grid (Partner For A Brighter Harvest)**:
   - Sisi kiri: Penjelasan kemitraan dan tombol kontak.
   - Sisi kanan: Kolase foto 2x2 (Robot alsintan, tangan merawat bibit organik, sayuran segar berwarna-warni, kolaborasi petani).

---

## 📁 2. Struktur Direktori Proyek

```
Template-koperasi/
│
├── index.html                  # Beranda (Replikasi desain referensi + integrasi koperasi)
├── login.html                  # Halaman Login Multi-Role (Pembeli, Petani, Admin)
├── toko.html                   # Katalog Toko Online Hasil Tani + Keranjang Belanja
├── sewa.html                   # Katalog Sewa Alat Mesin Pertanian (Alsintan) + Kalkulator
├── dashboard-petani.html       # Dashboard Khusus Petani (Kelola Data Penjualan & Panen)
│
├── css/
│   ├── variables.css           # 🎨 PUSAT TEMA: Ubah warna & font di sini!
│   ├── base.css                # Reset CSS, tipografi global, tombol pill, dekorasi (+)
│   ├── navbar.css              # Header, dark pill menu, responsive mobile drawer
│   ├── home.css                # Layout hero panorama, 4 stats, quote, dan bento grid
│   ├── auth.css                # Form login, tab role selector, shortcut demo
│   ├── toko.css                # Layout toko, filter kategori, kartu produk, native modal
│   ├── sewa.css                # Layout sewa alat, kartu alsintan, modal kalkulator
│   └── dashboard.css           # Layout dashboard petani, kartu omzet, grafik CSS, tabel
│
├── js/
│   ├── data.js                 # 📦 PUSAT DATA MOCK: Ubah nama barang, harga, & stok di sini!
│   ├── main.js                 # Global: Cart localStorage, toast notifikasi, mobile menu
│   ├── auth.js                 # Simulasi login & pengalihan rute sesuai role
│   ├── toko.js                 # Filter kategori, live search, sorting, dan drawer cart
│   ├── sewa.js                 # Kalkulator durasi sewa alsintan + operator + antar
│   └── dashboard.js            # Update status pesanan langsung, form tambah produk panen
│
└── README.md                   # Panduan dokumentasi lengkap
```

---

## 👥 3. Pemetaan Peran Pengguna (User Roles)

Sesuai instruksi Anda:
- **Pengguna Pembeli**: 
  - Menjelajahi Beranda, Toko Online Hasil Tani, dan Sewa Alat.
  - Memasukkan produk ke keranjang belanja dan simulasi checkout.
  - Menghitung tarif sewa alat.
  - **Tidak memiliki akses ke Dashboard Petani.**
- **Pengguna Petani (Mitra Koperasi)**:
  - Memiliki semua akses pembeli.
  - **Satu-satunya yang memiliki akses ke `dashboard-petani.html`**.
  - Dashboard difokuskan murni untuk **kelola data penjualan hasil tani mereka** (omzet bulanan, daftar pesanan masuk dari pembeli, ubah status pengiriman, dan tambah stok panen baru).
- **Admin Koperasi**:
  - Disediakan tab khusus di `login.html` untuk administrator koperasi.

> ⚡ **Tips Demo untuk Tim:** Pada halaman `login.html`, terdapat 3 tombol **"Shortcut Uji Coba Demo (1-Klik)"** di bagian bawah form agar tim Anda tidak perlu mengetik email & sandi secara manual saat presentasi!

---

## 🛠️ 4. Panduan Modifikasi Cepat untuk Tim Anda

### A. Mengubah Tema Warna & Desain dalam 1 Menit
Buka file `css/variables.css`. Semua warna utama diatur di sana:
```css
:root {
  --color-primary: #15803D;      /* Ganti warna hijau brand utama */
  --color-text-main: #111827;    /* Ganti warna teks utama */
  --color-bg-dark-pill: #111827; /* Ganti warna kapsul menu tengah */
  --radius-xl: 24px;             /* Ganti kelengkungan sudut kartu/foto */
}
```

### B. Menambah atau Mengganti Produk Hasil Tani
Buka file `js/data.js`. Tim cukup menambahkan objek baru ke array `KOPERASI_DATA.products`:
```javascript
{
  id: "PRD-007",
  name: "Melon Madu Super Manis",
  category: "buah",
  categoryName: "Buah Lokal",
  price: 28000,
  unit: "1 kg",
  farmer: "Pak Slamet (Desa Sukamaju)",
  rating: 5.0,
  sold: 45,
  stock: 30,
  image: "URL_FOTO_ANDA",
  description: "Melon dengan kadar manis tinggi langsung petik kebun.",
  freshness: "Petik Hari Ini",
  isOrganic: true
}
```

### C. Menambah Alat Mesin Pertanian (Alsintan) untuk Disewa
Di file `js/data.js`, tambahkan objek ke array `KOPERASI_DATA.rentals`:
```javascript
{
  id: "ALS-005",
  name: "Mesin Tanam Padi (Transplanter)",
  category: "tanam",
  categoryName: "Mesin Penanam",
  pricePerDay: 300000,
  power: "Yamaha 4.5 HP",
  capacity: "1.2 Ha / hari",
  status: "Tersedia",
  operatorAvailable: true,
  operatorFeePerDay: 120000,
  image: "URL_FOTO_ANDA",
  description: "Tanam padi otomatis 4 alur jarak teratur rapi.",
  terms: "Pengambilan di gudang alsintan koperasi."
}
```

---

## 🚀 5. Cara Menjalankan

1. Ekstrak atau buka folder `Template-koperasi`.
2. Klik dua kali file `index.html` pada browser apa pun (Chrome, Edge, Firefox, Safari).
3. Atau jalankan via ekstensi **Live Server** di VS Code jika menggunakan editor kode.
4. Tanpa perlu menjalankan perintah `npm install` atau konfigurasi build tool apa pun!

---

## 🌟 6. Keunggulan Teknis & Kepatuhan Standar Web

- **Native HTML5 `<dialog>`**: Modal detail produk, keranjang belanja, kalkulator sewa, dan form tambah panen menggunakan native `<dialog>` bawaan browser dengan backdrop bawaan dan light dismiss.
- **Tanpa Dependency Obscure**: 100% clean vanilla modern, mudah dipindahkan ke Laravel (Blade), PHP Native, React, Vue, Python Flask, atau Django jika tim Anda ingin menyambungkannya ke backend dan database SQL.
- **Responsif Penuh**: Mendukung tampilan desktop, tablet, dan smartphone dengan navigasi drawer otomatis.
