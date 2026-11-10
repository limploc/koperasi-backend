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
      name: "Jagung Manis Pipil Segar",
      category: "jagung",
      categoryName: "Jagung",
      price: 22000,
      originalPrice: 28000,
      discount: "21%",
      unit: "1 kg",
      farmer: "Pak Kasmir (Kelompok Jagung Subur)",
      rating: 4.8,
      sold: 185,
      stock: 45,
      image: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80",
      description: "Jagung manis segar petik langsung dari ladang binaan koperasi. Butiran padat, manis alami renyah, siap masak.",
      freshness: "Petik Hari Ini",
      isOrganic: true
    },
    {
      id: "PRD-002",
      name: "Jagung Kering Pipil Pakan",
      category: "jagung",
      categoryName: "Jagung",
      price: 16000,
      originalPrice: 20000,
      discount: "20%",
      unit: "1 kg",
      farmer: "Kelompok Tani Makmur Jaya",
      rating: 4.7,
      sold: 340,
      stock: 120,
      image: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=600&q=80",
      description: "Jagung kuning kadar air rendah hasil pengeringan standar koperasi. Sangat cocok untuk olahan pangan dan pakan ternak.",
      freshness: "Kering Sempurna",
      isOrganic: false
    },
    {
      id: "PRD-003",
      name: "Kelapa Butir Tua Pilihan",
      category: "kelapa",
      categoryName: "Kelapa",
      price: 12000,
      originalPrice: 15000,
      discount: "20%",
      unit: "1 butir",
      farmer: "Pak Joko (Kebun Kelapa Mandiri)",
      rating: 4.9,
      sold: 260,
      stock: 90,
      image: "https://images.unsplash.com/photo-1544378730-8b5104b18790?auto=format&fit=crop&w=600&q=80",
      description: "Kelapa tua pilihan santan pekat dari pohon kelapa pesisir anggota koperasi. Daging tebal, gurih, dan kadar minyak tinggi.",
      freshness: "Tua Pohon Pilihan",
      isOrganic: true
    },
    {
      id: "PRD-004",
      name: "Kelapa Muda Segar Alami",
      category: "kelapa",
      categoryName: "Kelapa",
      price: 18000,
      originalPrice: 24000,
      discount: "25%",
      unit: "1 butir",
      farmer: "Pak Joko (Kebun Kelapa Mandiri)",
      rating: 5.0,
      sold: 140,
      stock: 35,
      image: "https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80",
      description: "Kelapa muda segar kaya nutrisi dan elektrolit alami. Air kelapa segar manis dengan daging lembut menyegarkan.",
      freshness: "Petik Pagi Hari Ini",
      isOrganic: true
    },
    {
      id: "PRD-005",
      name: "Minyak Kelapa Murni (VCO)",
      category: "turunan",
      categoryName: "Turunan",
      price: 45000,
      originalPrice: 60000,
      discount: "25%",
      unit: "250 ml",
      farmer: "UMKM Sentra Olahan Koperasi",
      rating: 4.9,
      sold: 210,
      stock: 40,
      image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80",
      description: "Virgin Coconut Oil (VCO) kualitas premium diproses secara cold-press tanpa bahan kimia, kaya antioksidan dan asam laurat.",
      freshness: "Hasil Ekstraksi Baru",
      isOrganic: true
    },
    {
      id: "PRD-006",
      name: "Gula Semut Kelapa Organik",
      category: "turunan",
      categoryName: "Turunan",
      price: 28000,
      originalPrice: 36000,
      discount: "22%",
      unit: "500 gr",
      farmer: "Koperasi Nira Lestari",
      rating: 4.8,
      sold: 230,
      stock: 55,
      image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
      description: "Pemanis alami rendah indeks glikemik dari nira pohon kelapa murni. Aroma karamel khas dan butiran kristal halus.",
      freshness: "Kemasan Kedap Udara",
      isOrganic: true
    },
    {
      id: "PRD-007",
      name: "Tepung Maizena Jagung",
      category: "turunan",
      categoryName: "Turunan",
      price: 18000,
      originalPrice: 24000,
      discount: "25%",
      unit: "500 gr",
      farmer: "Unit Pengolahan Pangan Koperasi",
      rating: 4.7,
      sold: 155,
      stock: 60,
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
      description: "Tepung pati jagung murni berkualitas tinggi tanpa zat pemutih sintetis. Menghasilkan kekentalan masakan yang sempurna.",
      freshness: "Kemasan Higienis",
      isOrganic: true
    },
    {
      id: "PRD-008",
      name: "Beras Organik Pandan Wangi",
      category: "beras",
      categoryName: "Beras & Padi",
      price: 85000,
      originalPrice: 115000,
      discount: "26%",
      unit: "5 kg",
      farmer: "Pak Slamet (Kelompok Tani Subur)",
      rating: 4.9,
      sold: 142,
      stock: 35,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
      description: "Beras aromatik khas hasil budidaya organik tanpa pestisida sintetis. Butiran pulen wangi alami dan kaya serat pangan.",
      freshness: "Panen 5 hari lalu",
      isOrganic: true
    },
    {
      id: "PRD-009",
      name: "Beras Merah Pulen Organik",
      category: "beras",
      categoryName: "Beras & Padi",
      price: 78000,
      originalPrice: 98000,
      discount: "20%",
      unit: "5 kg",
      farmer: "Pak Slamet (Kelompok Tani Subur)",
      rating: 4.8,
      sold: 98,
      stock: 25,
      image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80",
      description: "Beras merah kaya antioksidan dan serat tinggi, tekstur pulen dan tidak keras saat dimasak.",
      freshness: "Panen Minggu Ini",
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
      originalPricePerDay: 320000,
      discount: "22%",
      rating: 4.9,
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
      originalPricePerDay: 850000,
      discount: "24%",
      rating: 5.0,
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
      originalPricePerDay: 120000,
      discount: "25%",
      rating: 4.8,
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
      name: "Mesin Perontok Padi Power Thresher",
      category: "panen",
      categoryName: "Mesin Panen",
      pricePerDay: 180000,
      originalPricePerDay: 230000,
      discount: "22%",
      rating: 4.8,
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
      memberId: "KOP-PET-0842",
      group: "Kelompok Tani Sumber Makmur",
      village: "Desa Sukamaju, Blok C-12",
      verified: true,
      membershipStatus: "Anggota Aktif Terverifikasi",
      balanceReady: 4250000, // Saldo penjualan panen yang telah di-ACC admin, siap dicairkan
      totalSalesAllTime: 8450000,
      monthlyTarget: 10000000,
      rating: 4.95,
      activeApprovedCount: 3,
      pendingApprovalCount: 1
    },
    // Riwayat transaksi penjualan hasil tani Pak Joko (Dikelola & di-ACC Admin Koperasi)
    salesOrders: [
      {
        orderId: "INV-2026-0891",
        customerName: "Ibu Megawati (Kec. Sukamaju)",
        items: "Tomat Ceri Hidroponik (4 kg), Cabai Rawit (2 kg)",
        totalAmount: 186000,
        date: "10 Nov 2026, 14:20",
        adminStatus: "Diproses Admin Gudang",
        logisticNote: "Sortir mutu selesai, bersiap dikirim kurir",
        paymentMethod: "Transfer QRIS Koperasi"
      },
      {
        orderId: "INV-2026-0890",
        customerName: "Restoran Dapur Sunda",
        items: "Alpukat Mentega Super (25 kg)",
        totalAmount: 875000,
        date: "09 Nov 2026, 09:15",
        adminStatus: "Dalam Pengantaran Kurir",
        logisticNote: "Diantar armada mobil pick-up koperasi",
        paymentMethod: "Kredit Koperasi Anggota"
      },
      {
        orderId: "INV-2026-0888",
        customerName: "Pak Hendra Wijaya",
        items: "Tomat Ceri Hidroponik (2 kg)",
        totalAmount: 48000,
        date: "08 Nov 2026, 17:40",
        adminStatus: "Selesai (Dana Masuk Saldo)",
        logisticNote: "Diterima pembeli, dana masuk ke saldo petani",
        paymentMethod: "QRIS"
      },
      {
        orderId: "INV-2026-0885",
        customerName: "Katering Sejahtera Makmur",
        items: "Cabai Rawit (10 kg), Alpukat (10 kg)",
        totalAmount: 800000,
        date: "07 Nov 2026, 11:30",
        adminStatus: "Selesai (Dana Masuk Saldo)",
        logisticNote: "Diterima pembeli, dana masuk ke saldo petani",
        paymentMethod: "Transfer Bank"
      },
      {
        orderId: "INV-2026-0882",
        customerName: "Ibu Kartika",
        items: "Tomat Ceri Hidroponik (1 kg)",
        totalAmount: 24000,
        date: "06 Nov 2026, 08:10",
        adminStatus: "Selesai (Dana Masuk Saldo)",
        logisticNote: "Ambil langsung di gerai koperasi",
        paymentMethod: "Tunai di Koperasi"
      }
    ],
    // Daftar komoditas hasil panen Pak Joko beserta Status ACC Admin
    myProducts: [
      {
        id: "PRD-003",
        name: "Tomat Ceri Hidroponik",
        price: 24000,
        unit: "500 gram",
        stock: 18,
        approvalStatus: "Disetujui Admin (Tayang)",
        adminNote: "Lolos sortir grade A. Tayang aktif di katalog toko.",
        soldCount: 95
      },
      {
        id: "PRD-004",
        name: "Alpukat Mentega Super Jumbo",
        price: 35000,
        unit: "1 kg",
        stock: 45,
        approvalStatus: "Disetujui Admin (Tayang)",
        adminNote: "Mutu panen prima, aktif di etalase toko online.",
        soldCount: 210
      },
      {
        id: "PRD-007",
        name: "Selada Keriting Organik",
        price: 15000,
        unit: "250 gram",
        stock: 25,
        approvalStatus: "Disetujui Admin (Tayang)",
        adminNote: "Sertifikasi organik terverifikasi oleh agronom koperasi.",
        soldCount: 64
      },
      {
        id: "PRD-010",
        name: "Singkong Mentega Super Gurih",
        price: 14000,
        unit: "2 kg",
        stock: 40,
        approvalStatus: "Menunggu ACC Admin",
        adminNote: "Pengajuan baru dikirim. Menunggu verifikasi fisik oleh admin gudang koperasi.",
        soldCount: 0
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
