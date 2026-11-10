/**
 * ==============================================================================
 * DATABASE MOCK TERPUSAT (data.js)
 * ------------------------------------------------------------------------------
 * File ini menyimpan semua data mock untuk Toko, Sewa Alat, dan Dashboard Petani.
 * Tim Anda dapat dengan mudah mengubah nama barang, harga, foto, atau stok
 * hanya dengan mengedit array JavaScript di bawah ini tanpa mengubah HTML!
 * ==============================================================================
 */

const KOPERASI_DATA = {
  // --- KATALOG TOKO ONLINE (HASIL TANI ANGGOTA KOPERASI) ---
  products: [
    {
      id: "PRD-001",
      name: "Beras Organik Pandan Wangi",
      category: "beras",
      categoryName: "Beras & Padi",
      price: 85000,
      unit: "5 kg",
      farmer: "Pak Slamet (Kelompok Tani Subur)",
      rating: 4.9,
      sold: 142,
      stock: 35,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
      description: "Beras aromatik khas Cianjur hasil budidaya organik tanpa pestisida sintetis. Butiran pulen wangi alami dan kaya serat pangan.",
      freshness: "Panen 5 hari lalu",
      isOrganic: true
    },
    {
      id: "PRD-002",
      name: "Cabai Rawit Merah Super",
      category: "sayur",
      categoryName: "Sayuran Segar",
      price: 45000,
      unit: "1 kg",
      farmer: "Bu Ratna (Desa Sukamaju)",
      rating: 4.8,
      sold: 320,
      stock: 20,
      image: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80",
      description: "Cabai rawit merah petik segar langsung dari kebun dataran tinggi. Tingkat kepedasan tinggi dan tahan disimpan lebih lama.",
      freshness: "Petik Pagi Hari Ini",
      isOrganic: false
    },
    {
      id: "PRD-003",
      name: "Tomat Ceri Hidroponik",
      category: "sayur",
      categoryName: "Sayuran Segar",
      price: 24000,
      unit: "500 gram",
      farmer: "Pak Joko (Lapak Tani Hidroponik)",
      rating: 5.0,
      sold: 95,
      stock: 18,
      image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
      description: "Tomat ceri merah ranum manis dan segar, dibudidayakan di dalam green-house dengan nutrisi hidroponik terstandar.",
      freshness: "Dipetik Saat Order",
      isOrganic: true
    },
    {
      id: "PRD-004",
      name: "Alpukat Mentega Super Jumbo",
      category: "buah",
      categoryName: "Buah Lokal",
      price: 35000,
      unit: "1 kg",
      farmer: "Pak Joko (Lapak Tani Hidroponik)",
      rating: 4.9,
      sold: 210,
      stock: 45,
      image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80",
      description: "Daging buah tebal lembut pulen tanpa serat kasar. Sangat cocok untuk jus sehat, salad, atau dimakan langsung.",
      freshness: "Tua Pohon Siap Santap",
      isOrganic: true
    },
    {
      id: "PRD-005",
      name: "Bawang Merah Brebes Pilihan",
      category: "sayur",
      categoryName: "Sayuran Segar",
      price: 38000,
      unit: "1 kg",
      farmer: "Kelompok Tani Brebes Jaya",
      rating: 4.7,
      sold: 450,
      stock: 60,
      image: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80",
      description: "Bawang merah kering simpan berkualitas tinggi, aroma tajam khas Brebes, umbi padat dan tidak mudah busuk.",
      freshness: "Jemur Kering Sempurna",
      isOrganic: false
    },
    {
      id: "PRD-006",
      name: "Pupuk Kompos Kascing Organik",
      category: "pupuk",
      categoryName: "Pupuk & Nutrisi",
      price: 25000,
      unit: "10 kg",
      farmer: "Koperasi Tani Makmur Unit Pupuk",
      rating: 4.9,
      sold: 180,
      stock: 120,
      image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=600&q=80",
      description: "Pupuk organik dari kotoran cacing tanah terfermentasi, kaya mikroorganisme bermanfaat untuk menyuburkan tanah pertanian.",
      freshness: "Siap Pakai",
      isOrganic: true
    }
  ],

  // --- KATALOG SEWA ALAT MESIN PERTANIAN (ALSINTAN) ---
  rentals: [
    {
      id: "ALS-001",
      name: "Traktor Tangan Quick Kubota RD85",
      category: "olah-tanah",
      categoryName: "Olah Tanah",
      pricePerDay: 250000,
      power: "8.5 HP Diesel",
      capacity: "0.8 Ha / hari",
      status: "Tersedia",
      operatorAvailable: true,
      operatorFeePerDay: 100000,
      image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80",
      description: "Traktor bajak roda 2 handal untuk sawah basah maupun kering. Konsumsi solar irit dengan tenaga tarikan kuat.",
      terms: "Biaya solar ditanggung penyewa. Unit dapat diambil di gudang koperasi atau diantar."
    },
    {
      id: "ALS-002",
      name: "Drone Sprayer Pertanian T40",
      category: "perawatan",
      categoryName: "Perawatan & Semprot",
      pricePerDay: 650000,
      power: "Baterai Cerdas Dual",
      capacity: "5 - 8 Ha / jam",
      status: "Tersedia",
      operatorAvailable: true,
      operatorFeePerDay: 150000,
      image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=600&q=80",
      description: "Drone pemupukan cair dan pestisida presisi tinggi. Menghemat 80% air dan 30% obat tani dengan kabut ultra-halus merata.",
      terms: "Wajib didampingi operator berlisensi dari koperasi."
    },
    {
      id: "ALS-003",
      name: "Mesin Pompa Air Irigasi Alkon 3 Inch",
      category: "irigasi",
      categoryName: "Irigasi & Pompa",
      pricePerDay: 90000,
      power: "Honda GP160 5.5 HP",
      capacity: "1.000 Liter / menit",
      status: "Tersedia",
      operatorAvailable: false,
      operatorFeePerDay: 0,
      image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      description: "Pompa sedot air irigasi banjir dan sumur bor sawah. Termasuk selang spiral hisap 6 meter dan selang buang 20 meter.",
      terms: "Disertai kartu identitas anggota saat serah terima unit."
    },
    {
      id: "ALS-004",
      name: "Mesin Perontok Padi (Power Thresher)",
      category: "panen",
      categoryName: "Mesin Panen",
      pricePerDay: 180000,
      power: "Mesin Bensin 6.5 HP",
      capacity: "600 kg / jam",
      status: "Tersedia",
      operatorAvailable: true,
      operatorFeePerDay: 80000,
      image: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=600&q=80",
      description: "Mesin perontok bulir padi gabah cepat dan bersih. Mengurangi susut panen (losses) gabah hingga di bawah 1.5%.",
      terms: "Mudah dipindah menggunakan roda dorong di pematang sawah."
    }
  ],

  // --- DATA KHUSUS DASHBOARD PETANI (SIMULASI AKUN PAK JOKO) ---
  farmerDashboard: {
    farmerProfile: {
      name: "Pak Joko",
      group: "Kelompok Tani Sumber Makmur",
      village: "Desa Sukamaju, Blok C-12",
      verified: true,
      storeStatus: "Buka",
      totalRevenue: 8450000,
      monthlyTarget: 10000000,
      rating: 4.95,
      activeProductsCount: 4
    },
    // Riwayat transaksi penjualan hasil tani Pak Joko
    salesOrders: [
      {
        orderId: "INV-2026-0891",
        customerName: "Ibu Megawati",
        items: "Tomat Ceri Hidroponik (4 kg), Cabai Rawit (2 kg)",
        totalAmount: 186000,
        date: "10 Nov 2026, 14:20",
        status: "Diproses", // Menunggu, Diproses, Dikirim, Selesai
        paymentMethod: "Transfer QRIS Koperasi"
      },
      {
        orderId: "INV-2026-0890",
        customerName: "Restoran Dapur Sunda",
        items: "Alpukat Mentega Super (25 kg)",
        totalAmount: 875000,
        date: "09 Nov 2026, 09:15",
        status: "Dikirim",
        paymentMethod: "Kredit Koperasi Anggota"
      },
      {
        orderId: "INV-2026-0888",
        customerName: "Pak Hendra Wijaya",
        items: "Tomat Ceri Hidroponik (2 kg)",
        totalAmount: 48000,
        date: "08 Nov 2026, 17:40",
        status: "Selesai",
        paymentMethod: "QRIS"
      },
      {
        orderId: "INV-2026-0885",
        customerName: "Katering Sejahtera",
        items: "Cabai Rawit (10 kg), Alpukat (10 kg)",
        totalAmount: 800000,
        date: "07 Nov 2026, 11:30",
        status: "Selesai",
        paymentMethod: "Transfer Bank"
      },
      {
        orderId: "INV-2026-0882",
        customerName: "Ibu Kartika",
        items: "Tomat Ceri Hidroponik (1 kg)",
        totalAmount: 24000,
        date: "06 Nov 2026, 08:10",
        status: "Menunggu",
        paymentMethod: "COD di Koperasi"
      }
    ],
    // Daftar produk yang sedang dijual oleh Pak Joko
    myProducts: [
      {
        id: "PRD-003",
        name: "Tomat Ceri Hidroponik",
        price: 24000,
        unit: "500 gram",
        stock: 18,
        status: "Aktif",
        soldCount: 95
      },
      {
        id: "PRD-004",
        name: "Alpukat Mentega Super Jumbo",
        price: 35000,
        unit: "1 kg",
        stock: 45,
        status: "Aktif",
        soldCount: 210
      },
      {
        id: "PRD-007",
        name: "Selada Keriting Organik",
        price: 15000,
        unit: "250 gram",
        stock: 25,
        status: "Aktif",
        soldCount: 64
      },
      {
        id: "PRD-008",
        name: "Kacang Panjang Hijau Segar",
        price: 12000,
        unit: "1 ikat",
        stock: 0,
        status: "Habis",
        soldCount: 130
      }
    ]
  }
};

// Helper format Rupiah untuk seluruh aplikasi
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(number);
}
