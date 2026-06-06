"use client";

import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { driver, type DriveStep } from "driver.js";

type TourConfig = {
  title: string;
  intro: string;
  workflow: string[];
  terms: string[];
  tips: string[];
};

function joinGuide(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function findTourConfig(pathname: string) {
  return (
    tourByPath[pathname] ??
    Object.entries(tourByPath)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname.startsWith(`${path}/`))?.[1] ??
    tourByPath["/admin"]
  );
}

const tourByPath: Record<string, TourConfig> = {
  "/admin": {
    title: "Panduan Dasbor",
    intro: "Pantau ringkasan outlet, penjualan, stok kritis, dan modul kerja dari satu halaman.",
    workflow: [
      "Pilih outlet aktif di sidebar agar angka mengikuti outlet yang sedang dianalisis.",
      "Baca kartu ringkasan untuk melihat penjualan, stok kritis, dan aktivitas utama.",
      "Masuk ke menu detail bila angka terlihat tidak normal atau perlu tindakan.",
    ],
    terms: [
      "Outlet aktif = cabang yang menjadi konteks data di layar.",
      "Stok kritis = stok yang sudah menyentuh atau di bawah batas minimum produk.",
      "Ringkasan = agregasi cepat; detail tetap dicek dari menu laporan atau inventory.",
    ],
    tips: ["Pilih Semua Outlet hanya untuk monitoring lintas outlet.", "Gunakan outlet spesifik saat membuat transaksi atau master data."],
  },
  "/admin/cashier": {
    title: "Panduan Kasir",
    intro: "Gunakan menu ini untuk transaksi, shift, pembayaran, remahan, dan sinkronisasi offline.",
    workflow: [
      "Pilih outlet aktif, lalu buka shift sebelum mulai jualan.",
      "Cari produk/SKU, masukkan qty, lalu cek keranjang sebelum bayar.",
      "Pilih metode pembayaran. Untuk tunai, isi uang diterima agar kembalian dihitung.",
      "Tutup shift saat selesai. Jika ada selisih kas, isi alasan agar bisa direview owner/admin.",
    ],
    terms: [
      "Shift = sesi kerja kasir dari buka kas sampai tutup kas.",
      "SKU = varian item yang dijual, misalnya produk sama tapi ukuran/rasa beda.",
      "Void = membatalkan transaksi utuh.",
      "Refund = pengembalian dana setelah transaksi terjadi.",
      "Variance/selisih kas = beda antara kas sistem dan kas fisik.",
      "Offline sync = kirim transaksi dari kasir mobile saat koneksi kembali; web kasir tidak menyimpan offline.",
    ],
    tips: ["Pastikan shift aktif sebelum transaksi.", "Gunakan pencarian produk agar kasir tidak scroll terlalu jauh."],
  },
  "/admin/outlets": {
    title: "Panduan Outlet",
    intro: "Kelola cabang, alamat, logo, dan status aktif outlet.",
    workflow: [
      "Buat outlet saat ada cabang/lokasi kerja baru.",
      "Isi nama, kode outlet, alamat, dan logo bila dibutuhkan untuk struk.",
      "Atur logo default outlet bila banyak outlet memakai logo yang sama.",
      "Nonaktifkan outlet yang tidak dipakai agar tidak muncul di operasional.",
    ],
    terms: [
      "Kode Outlet = kode pendek untuk identifikasi cabang, bukan alamat.",
      "Logo Default Outlet = logo bawaan yang bisa dipakai outlet baru atau outlet tanpa logo khusus.",
      "Logo Khusus = logo yang hanya dipakai outlet tertentu.",
      "Storage lokal = penyimpanan file/gambar di folder upload server. Upload file lokal mengosongkan field URL manual.",
    ],
    tips: ["Gunakan logo default bila semua outlet memakai brand sama.", "Matikan fitur logo bila usaha tidak butuh logo di struk."],
  },
  "/admin/products": {
    title: "Panduan Produk",
    intro: "Kelola produk dan SKU. Master satuan dipisah ke menu Satuan agar halaman ini fokus.",
    workflow: [
      "Buat satuan terlebih dahulu di menu Satuan.",
      "Tambah produk, isi identitas, gambar, harga, HPP, dan satuan.",
      "Gunakan varian/SKU bila satu produk punya rasa, ukuran, atau kemasan berbeda.",
      "Nonaktifkan produk/varian lama bila sudah pernah dipakai transaksi.",
    ],
    terms: [
      "Produk = nama utama barang, misalnya Keripik Pisang.",
      "SKU = varian jual/stok, misalnya Keripik Pisang 250g.",
      "Kode SKU = kode internal untuk kasir, pencarian, laporan, dan audit stok. Kosongkan saat tambah produk bila ingin auto-generate.",
      "Barcode = kode fisik dari kemasan/barcode scanner; berbeda dari Kode SKU.",
      "HPP = harga pokok per satuan stok.",
      "Stok Minimum = batas stok rendah untuk peringatan.",
      "Global SKU = penghubung produk yang sama antar outlet saat katalog outlet dibuat terpisah.",
    ],
    tips: ["Buat satuan sebelum produk.", "Kode SKU boleh kosong saat tambah produk; sistem membuat kode otomatis."],
  },
  "/admin/units": {
    title: "Panduan Satuan",
    intro: "Kelola kode satuan seperti PCS, GR, KG, dan faktor konversinya.",
    workflow: [
      "Tentukan tipe satuan: berat, pcs/satuan, atau kemasan.",
      "Isi nama dan kode struk yang singkat.",
      "Isi faktor konversi jika satuan bukan satuan dasar.",
      "Nonaktifkan satuan salah agar tidak bisa dipilih produk baru.",
    ],
    terms: [
      "Kode Struk = tulisan satuan di kasir dan struk, misalnya PCS, GR, KG.",
      "Satuan Stok = satuan dasar perhitungan stok.",
      "Satuan Jual = satuan yang dipakai kasir saat menjual.",
      "Faktor Konversi = rasio dari satuan jual ke satuan stok.",
    ],
    tips: ["Gunakan kode singkat dan konsisten.", "Jangan hapus satuan yang sudah dipakai transaksi; nonaktifkan saja."],
  },
  "/admin/customers": {
    title: "Panduan Pelanggan",
    intro: "Kelola pelanggan, histori pembelian, loyalty, dan piutang.",
    workflow: [
      "Tambah pelanggan bila ingin mencatat histori atau transaksi piutang.",
      "Pilih pelanggan untuk melihat riwayat pembelian.",
      "Gunakan panel Piutang Pelanggan untuk mencatat pembayaran yang belum lunas.",
    ],
    terms: [
      "Kode Pelanggan = kode unik pelanggan untuk pencarian cepat.",
      "Piutang = transaksi yang belum dibayar lunas oleh pelanggan.",
      "Loyalty = poin atau nilai loyalitas pelanggan dari histori belanja.",
    ],
    tips: ["Kode pelanggan bisa dikosongkan bila sistem menyediakan kode dari nama.", "Catat nomor telepon agar pelanggan mudah dicari."],
  },
  "/admin/promotions": {
    title: "Panduan Pajak & Promo",
    intro: "Atur pajak, service charge, voucher, diskon transaksi, diskon item, dan periode promo.",
    workflow: [
      "Atur pajak/service charge bila usaha memakai biaya tambahan.",
      "Buat promo, tentukan tipe, target, periode, dan batas pemakaian.",
      "Nonaktifkan promo saat tidak berlaku lagi agar histori tetap aman.",
    ],
    terms: [
      "Service Charge = biaya layanan yang ditambahkan ke transaksi.",
      "Voucher = kode promo yang dimasukkan saat transaksi.",
      "Scope = cakupan promo, misalnya semua item, SKU tertentu, atau kategori tertentu.",
      "Buy X Get Y = beli jumlah tertentu, dapat bonus item tertentu.",
      "Max Redemption = batas maksimal promo dipakai.",
    ],
    tips: ["Gunakan periode mulai/berakhir agar promo otomatis berhenti.", "Pakai scope SKU/kategori agar promo tidak salah diterapkan."],
  },
  "/admin/inventory": {
    title: "Panduan Persediaan",
    intro: "Pantau stok, buat adjustment, pembelian, transfer, supplier, dan mutasi.",
    workflow: [
      "Pilih outlet aktif untuk melihat stok outlet tersebut.",
      "Gunakan tab Stok untuk saldo saat ini, Batch untuk lot/expired, Mutasi untuk histori perubahan.",
      "Cek Batch Gap bila saldo stok dan batch tidak sama.",
      "Rekonsiliasi manual bila gap valid dan perlu disamakan.",
    ],
    terms: [
      "Stok On Hand = stok fisik/sistem yang tersedia.",
      "Reserved = stok yang ditahan untuk proses tertentu.",
      "Batch/Lot = kelompok stok dari penerimaan tertentu.",
      "FEFO = First Expired First Out; batch kedaluwarsa lebih cepat keluar dulu.",
      "Batch Gap = selisih antara saldo stok utama dan total stok batch.",
      "Mutasi = histori naik/turun stok karena jual, beli, waste, transfer, atau adjustment.",
    ],
    tips: ["Batch dan balance harus sinkron agar FEFO akurat.", "Gunakan audit mutasi saat stok terasa tidak cocok."],
  },
  "/admin/transfers": {
    title: "Panduan Transfer",
    intro: "Pindahkan stok antar outlet dengan batch FEFO.",
    workflow: [
      "Pilih outlet sumber dan outlet tujuan.",
      "Pilih SKU, isi jumlah transfer, lalu simpan.",
      "Sistem mengurangi stok sumber dan menambah stok tujuan.",
      "Batch mengikuti FEFO agar lot tracking tetap rapi.",
    ],
    terms: [
      "Transfer Out = stok keluar dari outlet sumber.",
      "Transfer In = stok masuk ke outlet tujuan.",
      "FEFO Transfer = batch dengan expiry lebih dekat dipindahkan lebih dulu.",
      "Outlet-specific catalog = produk bisa berbeda per outlet, tapi global SKU menjaga relasi barang yang sama.",
    ],
    tips: ["Jangan pilih outlet sumber sama dengan tujuan.", "Pastikan stok sumber cukup sebelum transfer."],
  },
  "/admin/stock-opname": {
    title: "Panduan Stock Opname",
    intro: "Buat sesi opname, input hitungan fisik, submit, approve, lalu post selisih.",
    workflow: [
      "Buat sesi opname untuk outlet yang dicek.",
      "Isi hasil hitung fisik setiap item.",
      "Submit setelah semua item selesai dihitung.",
      "Owner/admin approve, lalu post agar selisih masuk stok.",
    ],
    terms: [
      "Draft = sesi baru dibuat dan belum selesai dihitung.",
      "Counted = hitungan fisik sudah diisi.",
      "Approved = hasil opname disetujui.",
      "Posted = selisih sudah masuk mutasi stok.",
      "System Qty = stok menurut sistem.",
      "Physical Qty = stok hasil hitung fisik.",
    ],
    tips: ["Kerjakan status berurutan: draft, counted, approved, posted.", "Post opname akan membuat adjustment stok dan tercatat di audit."],
  },
  "/admin/suppliers": {
    title: "Panduan Supplier",
    intro: "Kelola pemasok untuk pembelian dan penerimaan barang.",
    workflow: [
      "Tambah supplier sebelum membuat pembelian.",
      "Isi kode, nama, kontak, dan alamat supplier.",
      "Nonaktifkan supplier lama agar tidak dipakai pembelian baru.",
    ],
    terms: [
      "Supplier = pemasok barang.",
      "Kode Supplier = kode singkat untuk pencarian dan laporan pembelian.",
      "Nonaktif = data tetap ada, tapi tidak dipilih untuk transaksi baru.",
    ],
    tips: ["Kode supplier sebaiknya pendek dan unik.", "Jangan hapus supplier yang sudah punya histori pembelian."],
  },
  "/admin/purchases": {
    title: "Panduan Pembelian",
    intro: "Buat purchase order, terima barang, dan masuk batch stok.",
    workflow: [
      "Buat purchase order untuk supplier dan outlet tujuan.",
      "Isi item, qty, harga beli, lot, dan expiry bila ada.",
      "Receive saat barang benar-benar diterima.",
      "Catat pembayaran pembelian sampai status lunas bila perlu.",
    ],
    terms: [
      "Purchase Order/PO = dokumen pesanan pembelian.",
      "Receive = proses menerima barang dan menambah stok.",
      "Lot Code = kode batch dari penerimaan barang.",
      "Expiry Date = tanggal kedaluwarsa batch.",
      "Payment Status = status pembayaran PO: belum bayar, sebagian, lunas.",
    ],
    tips: ["Isi expiry untuk produk makanan agar FEFO berjalan.", "Receive akan menambah stok utama dan batch."],
  },
  "/admin/users": {
    title: "Panduan Pengguna",
    intro: "Kelola user, role, status aktif, dan akses outlet.",
    workflow: [
      "Buat user sesuai tugasnya: owner, admin outlet, cashier, warehouse, auditor.",
      "Tentukan outlet yang boleh diakses user.",
      "Nonaktifkan user yang sudah tidak bekerja agar tidak bisa login.",
    ],
    terms: [
      "Role = jabatan akses user.",
      "Owner = akses tertinggi.",
      "Admin Outlet = mengelola outlet tertentu.",
      "Cashier = kasir transaksi.",
      "Warehouse = fokus stok dan pembelian.",
      "Auditor = fokus lihat laporan/audit.",
      "Akses Outlet = batas cabang yang bisa dilihat/dikelola user.",
    ],
    tips: ["Beri akses outlet sesuai kebutuhan kerja.", "User nonaktif tidak bisa login tapi histori tetap aman."],
  },
  "/admin/reports": {
    title: "Panduan Laporan",
    intro: "Pantau penjualan, detail transaksi, remahan, koreksi sale, dan cetak ulang struk.",
    workflow: [
      "Pilih outlet dan periode laporan.",
      "Baca ringkasan terlebih dahulu, lalu buka detail transaksi bila perlu audit.",
      "Gunakan void/refund hanya sesuai aturan koreksi yang berlaku.",
      "Export bila data perlu direkap di luar sistem.",
    ],
    terms: [
      "Sales Summary = ringkasan penjualan per periode.",
      "Sales Detail = daftar transaksi rinci.",
      "Void Window = batas waktu pembatalan transaksi.",
      "Refund Window = batas waktu pengembalian dana.",
      "Waste/Reamahan = stok rusak, tumpah, sampling, atau tidak layak jual.",
    ],
    tips: ["Gunakan filter periode agar data cepat dimuat.", "Void/refund mengikuti aturan produk dan role."],
  },
  "/admin/financial-reports": {
    title: "Panduan Laporan Keuangan",
    intro: "Lihat laba rugi, arus kas, neraca sederhana, ekuitas, dan catatan.",
    workflow: [
      "Pilih outlet dan periode.",
      "Buka jenis laporan yang dibutuhkan: laba rugi, arus kas, neraca, atau ekuitas.",
      "Export laporan bila perlu dikirim ke owner/accounting.",
    ],
    terms: [
      "Laba Rugi = pendapatan dikurangi HPP dan beban.",
      "Arus Kas = uang masuk dan keluar.",
      "Neraca = posisi aset, liabilitas, dan ekuitas.",
      "COGS/HPP = harga pokok barang terjual.",
      "Jurnal = catatan akuntansi dari transaksi sistem.",
    ],
    tips: ["Data keuangan mengikuti transaksi POS, pembelian, inventory, dan kas.", "Pilih satu laporan sebelum export agar file lebih fokus."],
  },
  "/admin/receipt": {
    title: "Panduan Struk",
    intro: "Atur lebar kertas, logo, urutan blok, auto print, dan catatan footer.",
    workflow: [
      "Pilih ukuran kertas sesuai printer: 58mm atau 80mm.",
      "Atur blok struk seperti logo, outlet, item, total, pembayaran, dan footer.",
      "Simpan pengaturan lalu test print bila printer terhubung.",
    ],
    terms: [
      "Browser Print = cetak dari browser web.",
      "Bluetooth Print = cetak dari aplikasi Flutter/mobile ke printer bluetooth.",
      "Paper Width = lebar kertas thermal.",
      "Footer Note = catatan paling bawah struk.",
      "Auto Print = struk otomatis dicetak setelah transaksi selesai.",
    ],
    tips: ["Layout web dan mobile sudah disamakan, tapi printer fisik bisa berbeda hasil karena driver/printer.", "Paper size printer tetap perlu diset di driver thermal."],
  },
  "/admin/role-access": {
    title: "Panduan Role Access",
    intro: "Atur izin view/create/edit/delete/export/approve per role.",
    workflow: [
      "Pilih role yang ingin diatur.",
      "Centang izin menu sesuai tugas role tersebut.",
      "Simpan perubahan, lalu user role itu akan mengikuti akses baru.",
    ],
    terms: [
      "View = boleh melihat menu/data.",
      "Create = boleh membuat data baru.",
      "Edit = boleh mengubah data.",
      "Delete = boleh menghapus data bila sistem mengizinkan.",
      "Export = boleh mengunduh laporan/file.",
      "Approve = boleh menyetujui proses seperti variance shift, opname, atau waste approval.",
    ],
    tips: ["Berikan izin minimal sesuai tugas user.", "API backend mengikuti permission ini, bukan hanya tombol UI."],
  },
  "/admin/profile": {
    title: "Panduan Profil",
    intro: "Ubah profil akun dan password.",
    workflow: [
      "Ubah nama/foto profil bila diperlukan.",
      "Ganti password dari panel keamanan.",
      "Hubungi owner/admin bila akses outlet atau menu tidak sesuai.",
    ],
    terms: [
      "Profil = identitas akun yang tampil di sidebar dan sistem.",
      "Password = kunci login akun.",
      "Akses outlet/menu = hak akses yang diatur dari menu Users dan Role Access.",
    ],
    tips: ["Gunakan password kuat minimal 8 karakter.", "Akses outlet tidak diubah dari profil sendiri."],
  },
};

export function AdminTour(props: { pathname: string }) {
  const config = useMemo(() => findTourConfig(props.pathname), [props.pathname]);

  function startTour() {
    const candidates: DriveStep[] = [
      {
        element: "[data-tour='sidebar']",
        popover: { title: "Menu utama", description: "Pindah modul kerja dari sini. Menu mengikuti akses role." },
      },
      {
        element: "[data-tour='outlet-select']",
        popover: { title: "Outlet aktif", description: "Pilih outlet yang menjadi konteks data dan transaksi." },
      },
      {
        element: ".admin-content",
        popover: { title: config.title, description: config.intro },
      },
      {
        element: ".admin-content",
        popover: { title: "Alur kerja", description: joinGuide(config.workflow) },
      },
      {
        element: "[data-tour='section']",
        popover: { title: "Panel kerja", description: "Panel disusun dari ringkasan ke aksi utama agar alur kerja lebih cepat dibaca." },
      },
      {
        element: "[data-tour='list-controls']",
        popover: { title: "Cari dan filter", description: "Gunakan pencarian, filter status, sortir, dan ukuran halaman untuk mempersempit data." },
      },
      {
        element: ".admin-content",
        popover: { title: "Istilah penting", description: config.terms.join("\n") },
      },
      {
        element: "[data-tour='tour-button']",
        popover: { title: "Tips menu", description: config.tips.join("\n") },
      },
    ].filter((step) => typeof step.element !== "string" || document.querySelector(step.element));

    driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: "Selesai",
      nextBtnText: "Lanjut",
      prevBtnText: "Kembali",
      steps: candidates,
    }).drive();
  }

  return (
    <button
      type="button"
      data-tour="tour-button"
      className="fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground shadow-lg hover:bg-muted lg:bottom-5 lg:right-5"
      onClick={startTour}
    >
      <HelpCircle className="h-4 w-4" />
      Panduan
    </button>
  );
}
