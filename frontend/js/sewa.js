/**
 * ==============================================================================
 * SCRIPT SEWA ALAT MESIN PERTANIAN (sewa.js)
 * ------------------------------------------------------------------------------
 * Mengatur katalog alsintan, kalkulator estimasi tarif sewa interaktif,
 * dan modal konfirmasi pemesanan unit.
 * ==============================================================================
 */

let selectedRental = null;
let rentalDays = 1;
let includeOperator = false;
let includeDelivery = false;

document.addEventListener('DOMContentLoaded', () => {
  renderRentals();
  setupRentalModal();
});

// Render Katalog Alat Sewa
function renderRentals() {
  const grid = document.getElementById('rentalsGrid');
  if (!grid) return;

  grid.innerHTML = KOPERASI_DATA.rentals.map(item => `
    <article class="rental-card">
      <div class="rental-image-container">
        <span class="rental-status-badge">● ${item.status}</span>
        <img src="${item.image}" alt="${item.name}" loading="lazy">
      </div>
      
      <div class="rental-body">
        <span class="badge-tag" style="padding-left:0; margin-bottom: 0.35rem;">
          <span class="dot-green"></span> ${item.categoryName}
        </span>
        <h3 class="rental-title">${item.name}</h3>

        <div class="rental-specs-list">
          <div class="rental-spec-row">
            <span>Daya Mesin:</span>
            <strong>${item.power}</strong>
          </div>
          <div class="rental-spec-row">
            <span>Kapasitas Kerja:</span>
            <strong>${item.capacity}</strong>
          </div>
          <div class="rental-spec-row">
            <span>Opsi Operator:</span>
            <strong>${item.operatorAvailable ? 'Tersedia (+Rp ' + item.operatorFeePerDay.toLocaleString('id-ID') + '/hari)' : 'Hanya Sewa Unit'}</strong>
          </div>
        </div>

        <p class="rental-desc">${item.description}</p>

        <div class="rental-footer">
          <div class="rental-price-tag">
            ${formatRupiah(item.pricePerDay)} <span>/ hari</span>
          </div>
          <button class="btn btn-dark" onclick="openRentalCalculator('${item.id}')">
            Sewa Unit &rarr;
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// Setup Dialog Kalkulator
function setupRentalModal() {
  const modal = document.getElementById('rentalCalcModal');
  if (!modal) return;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

// Buka Kalkulator Tarif Sewa
function openRentalCalculator(rentalId) {
  selectedRental = KOPERASI_DATA.rentals.find(r => r.id === rentalId);
  const modal = document.getElementById('rentalCalcModal');
  const body = document.getElementById('rentalCalcBody');
  if (!selectedRental || !modal || !body) return;

  rentalDays = 1;
  includeOperator = false;
  includeDelivery = false;

  renderCalculatorContent();
  modal.showModal();
}

// Render Tampilan Dalam Kalkulator
function renderCalculatorContent() {
  const body = document.getElementById('rentalCalcBody');
  if (!selectedRental || !body) return;

  const basePrice = selectedRental.pricePerDay * rentalDays;
  const opPrice = (includeOperator && selectedRental.operatorAvailable) ? (selectedRental.operatorFeePerDay * rentalDays) : 0;
  const delivPrice = includeDelivery ? 50000 : 0;
  const totalPrice = basePrice + opPrice + delivPrice;

  body.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <span class="badge-tag" style="padding-left: 0;"><span class="dot-green"></span> Formulir Sewa Alsintan</span>
      <h2 style="font-size: 1.5rem; margin-top: 0.25rem;">${selectedRental.name}</h2>
      <p style="font-size: 0.85rem; color: #6B7280;">Tarif Dasar: ${formatRupiah(selectedRental.pricePerDay)} / hari</p>
    </div>

    <!-- Pilihan Durasi Hari -->
    <div class="form-group">
      <label class="form-label">Durasi Waktu Sewa (Hari):</label>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <input type="range" min="1" max="14" value="${rentalDays}" style="flex: 1; accent-color: #111827;" oninput="onDurationChange(this.value)">
        <span style="font-size: 1.1rem; font-weight: 700; min-width: 60px; text-align: right;">${rentalDays} Hari</span>
      </div>
    </div>

    <!-- Opsi Tambahan -->
    <div style="display: flex; flex-direction: column; gap: 0.65rem; margin: 1rem 0;">
      ${selectedRental.operatorAvailable ? `
        <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" ${includeOperator ? 'checked' : ''} onchange="toggleOperator(this.checked)" style="accent-color: var(--color-primary); width: 16px; height: 16px;">
          <span>Sertakan Operator Berpengalaman Koperasi (+${formatRupiah(selectedRental.operatorFeePerDay)}/hari)</span>
        </label>
      ` : ''}

      <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; cursor: pointer;">
        <input type="checkbox" ${includeDelivery ? 'checked' : ''} onchange="toggleDelivery(this.checked)" style="accent-color: var(--color-primary); width: 16px; height: 16px;">
        <span>Layanan Antar Unit Langsung ke Lokasi Sawah (+Rp 50.000 sekali jalan)</span>
      </label>
    </div>

    <!-- Ringkasan Perhitungan Biaya -->
    <div class="calc-summary-box">
      <div class="calc-row">
        <span>Sewa Unit (${rentalDays} Hari):</span>
        <strong>${formatRupiah(basePrice)}</strong>
      </div>
      ${opPrice > 0 ? `
        <div class="calc-row">
          <span>Jasa Operator (${rentalDays} Hari):</span>
          <strong>${formatRupiah(opPrice)}</strong>
        </div>
      ` : ''}
      ${delivPrice > 0 ? `
        <div class="calc-row">
          <span>Ongkos Antar Unit:</span>
          <strong>${formatRupiah(delivPrice)}</strong>
        </div>
      ` : ''}
      <div class="calc-row total">
        <span>Total Estimasi Biaya:</span>
        <span style="color: var(--color-primary);">${formatRupiah(totalPrice)}</span>
      </div>
    </div>

    <div style="font-size: 0.75rem; color: #9CA3AF; margin-bottom: 1.25rem;">
      ℹ️ Syarat: Menunjukkan Kartu Tanda Anggota / KTP saat pengambilan unit di gudang koperasi.
    </div>

    <button class="btn btn-dark" style="width: 100%; padding: 0.85rem;" onclick="submitRentalBooking()">
      Ajukan Pemesanan Sewa &rarr;
    </button>
  `;
}

function onDurationChange(val) {
  rentalDays = parseInt(val, 10);
  renderCalculatorContent();
}

function toggleOperator(val) {
  includeOperator = val;
  renderCalculatorContent();
}

function toggleDelivery(val) {
  includeDelivery = val;
  renderCalculatorContent();
}

function submitRentalBooking() {
  alert(`Permohonan Sewa Berhasil Diajukan!\n\nUnit: ${selectedRental.name}\nDurasi: ${rentalDays} Hari\nPetugas koperasi akan menghubungi Anda untuk konfirmasi jadwal serah terima.`);
  document.getElementById('rentalCalcModal')?.close();
  showToast('✓ Pengajuan sewa alat berhasil dikirim ke pengurus koperasi!');
}
