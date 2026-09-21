# Laporan Analisis & Evaluasi — Fungsi Reporting 20FIT Ad Studio

| | |
| --- | --- |
| **Tanggal** | 2026-09-21 |
| **Ruang lingkup** | Sistem 20FIT Ad Studio, fokus pada fungsi *reporting* iklan |
| **Basis analisis** | Pembacaan langsung source code repo `Ad-Studio` |
| **Sifat dokumen** | Analisis teknis + rekomendasi. Angka pasti performa iklan 20FIT **tidak** tersedia dari kode dan tidak dikarang di sini. |

> **Catatan transparansi.** Analisis ini dibuat dari membaca kode, bukan dari
> data produksi, wawancara tim, atau deployment live. Hal-hal yang belum bisa
> saya pastikan ditandai eksplisit di [Bagian 9](#9-catatan-kejujuran--yang-perlu-dicek-ulang).

---

## 1. Ringkasan Eksekutif

20FIT Ad Studio saat ini adalah **tool produksi ad copy** (Next.js 14 + Supabase +
Claude API): generate copy Google Display/SEM/PMax & Meta, builder UTM, banner
maker, asset library. Kualitasnya rapi dan konsisten.

**Temuan utama:** yang selama ini disebut "reporting" di aplikasi ini sebenarnya
baru **pelacakan aktivitas produksi** — yaitu *berapa banyak copy yang di-generate* —
dan datanya disimpan di **localStorage browser** (per-perangkat, tidak dibagi ke
tim). **Belum ada reporting performa iklan** sama sekali: tidak ada impressions,
clicks, CTR, CPC, CPM, spend, konversi, CPA, atau ROAS; tidak ada integrasi ke
Google Ads / Meta; tidak ada tren waktu; tidak ada grafik; tidak ada export.

**Yang dikerjakan di PR ini** (lihat [Bagian 6](#6-yang-sudah-dibangun-di-pr-ini)):
modul **`/reports`** baru dengan dua tab —
1. **Performa Iklan** — input manual + import CSV (dari export Google Ads/Meta) untuk
   impressions, clicks, spend, konversi, revenue; KPI turunan otomatis (CTR, CPC,
   CPM, CVR, CPA, ROAS); tren harian; perbandingan platform; export CSV. Persistensi
   ke Supabase (`campaign_metrics`) bila dikonfigurasi, fallback localStorage untuk
   mode demo.
2. **Produksi Copy** — analitik atas riwayat generasi (tren mingguan, breakdown
   platform/bahasa, produk teratas).

**Rekomendasi prioritas berikutnya:** (P1) integrasi API resmi Google Ads & Meta
agar data performa masuk otomatis; (P1) migrasi riwayat generasi ke Supabase agar
lintas-perangkat & shareable; (P1) *feedback loop* variasi copy → performa; lalu
(P2) atribusi/funnel dengan menyambung ke CRM/GA4.

---

## 2. Metodologi & Batasan Analisis

- **Cara analisis:** menelusuri seluruh `app/`, `components/`, `lib/`, `i18n/`,
  dan `supabase/` pada repo.
- **Belum dilakukan / di luar jangkauan:** verifikasi ke deployment `ads.20fit.id`,
  membaca database produksi, mengukur performa nyata, atau menguji integrasi
  Supabase/Claude pada environment sebenarnya.
- **Konsekuensi:** semua pernyataan "kondisi sekarang" berasal dari kode. Estimasi
  effort bersifat kualitatif (S/M/L), bukan angka pasti.

---

## 3. Arsitektur & Modul Saat Ini (terverifikasi dari kode)

**Stack:** Next.js 14 (App Router), React 18, TypeScript strict, Supabase
(`@supabase/supabase-js`), Anthropic SDK, `html2canvas`. Deploy Railway di
`ads.20fit.id`. Design system "Glass Minimalist" (bilingual ID/EN, light/dark).

**Modul (nav):** Dashboard · Google Ads (Display, SEM, PMax) · Meta · Tools (UTM
Builder, Banner Maker) · Library (Asset Library, History, Settings).

**Model persistensi (penting untuk reporting):**

| Data | Disimpan di | Cakupan |
| --- | --- | --- |
| Riwayat generasi copy | **localStorage** (`lib/history.ts`) | per-browser, dibatasi 100 baris |
| UTM links | **localStorage** | per-browser, dibatasi 100 baris |
| Asset library | **Supabase** (via `/api/assets`, service role) | shared tim |
| Tabel `ad_generations`, `utm_links`, `banner_projects` | ada di schema Supabase | **belum dipakai app** — RLS owner-only, butuh Auth |

Setiap panggilan AI berjalan server-side (`/api/generate`) dengan rate limit dan
cache 1 jam. Integrasi bersifat opsional: app boot di "mode demo" tanpa konfigurasi.

---

## 4. Kondisi Fungsi "Reporting" Saat Ini (terverifikasi)

### 4.1 Dashboard (`app/page.tsx`)
Empat stat card yang seluruhnya dihitung dari localStorage (`getStats()` di
`lib/history.ts`):
- **Total Generated** = jumlah baris riwayat generasi.
- **Active Campaigns** = jumlah **nilai unik dari field `product`** yang diketik di
  brief (bukan campaign iklan sungguhan).
- **UTM Links** = jumlah link UTM tersimpan.
- **Assets** = jumlah asset (satu-satunya angka dari Supabase).

Ditambah grid platform (hitungan generasi per platform) dan tabel "Recent
Generations" (8 terbaru). Semua adalah **hitungan produksi**, bukan performa.

### 4.2 History (`app/history/page.tsx`)
Daftar copy yang pernah di-generate (brief, platform, bahasa, tanggal), dari
localStorage. Bisa dihapus. **Per-browser** — hilang bila cache dibersihkan, dan
tidak terlihat oleh rekan tim lain.

### 4.3 UTM Builder
Membuat URL berparameter UTM dan menyimpannya (localStorage). **Tidak** terhubung
ke data klik/konversi mana pun — jadi tidak ada umpan balik performa dari link.

**Kesimpulan Bagian 4:** aplikasi mengukur *output produksi konten*, bukan *hasil
iklan*.

---

## 5. Analisis Gap — Apa yang Belum Ada untuk "Reporting Ads"

| # | Gap | Dampak | Status setelah PR ini |
| --- | --- | --- | --- |
| 1 | Tidak ada metrik performa (impr, clicks, CTR, CPC, CPM, spend, konversi, CPA, ROAS) | Tidak bisa menilai efektivitas iklan sama sekali | **Sebagian tertutup** — via input manual/CSV |
| 2 | Tidak ada integrasi Google Ads / Meta API | Data harus dimasukkan manual | Belum (roadmap P1) |
| 3 | Persistensi hanya localStorage (history & UTM) | Data per-browser, tidak shareable, mudah hilang | **Sebagian** — metrik performa bisa ke Supabase |
| 4 | Tidak ada tren/time-series | Tidak bisa lihat perkembangan | **Tertutup** untuk metrik & produksi |
| 5 | Tidak ada visualisasi (grafik) | Sulit membaca pola | **Tertutup** — chart inline SVG |
| 6 | Tidak ada export (CSV/PDF) | Sulit dibagikan/olah lanjut | **Tertutup (CSV)** — PDF belum |
| 7 | Tidak ada keterkaitan generasi ↔ campaign ↔ metrik | Tidak bisa tahu copy mana yang menang | Belum (roadmap P1) |
| 8 | Tidak ada *feedback loop* hasil A/B variasi | Kualitas copy tak bisa dipelajari dari hasil | Belum (roadmap P1) |
| 9 | Tidak ada atribusi/funnel/konversi lanjutan | Tidak tahu kontribusi ke revenue nyata | Belum (roadmap P2) |
| 10 | Tidak ada filter/segmentasi periode & platform | Analisis kaku | **Tertutup** untuk metrik performa |
| 11 | Tidak ada multi-user/role & scheduled report | Kolaborasi & distribusi terbatas | Belum (roadmap P1–P2) |

---

## 6. Yang Sudah Dibangun di PR Ini

Modul **Reports** (`/reports`), tanpa menambah dependency baru (grafik dibuat dari
inline SVG/flexbox agar bundle tetap ringan dan mengikuti design token yang ada).

**Tab "Performa Iklan"** — ini inti "reporting ads" yang sebelumnya tidak ada:
- Input **manual** per baris: tanggal, platform, campaign, impressions, clicks,
  biaya (Rp), konversi, revenue (Rp).
- **Import CSV/TSV** (tempel atau file) dengan pemetaan header fleksibel + alias
  umum dari export Google Ads/Meta/Excel, plus parser angka yang menoleransi
  format `Rp`, ribuan (`.`/`,`), dan persen.
- **KPI turunan otomatis** (rumus standar industri, bukan angka karangan):
  - CTR = clicks ÷ impressions
  - CPC = biaya ÷ clicks
  - CPM = biaya ÷ impressions × 1.000
  - CVR = konversi ÷ clicks
  - CPA = biaya ÷ konversi
  - ROAS = revenue ÷ biaya
- **Tren harian** (spend & konversi), **perbandingan spend per platform**, **filter**
  platform + periode (semua / 7 hari / 30 hari / bulan ini), **tabel detail** dengan
  KPI per baris, dan **export CSV**.
- **Persistensi:** bila Supabase dikonfigurasi → server-side (`/api/metrics` +
  tabel `campaign_metrics`), sehingga **dibagi ke seluruh tim**; bila tidak →
  localStorage (mode demo). Badge sumber data ditampilkan di UI.
- Tersedia tombol **"Isi Contoh (Sample)"** — data ini **jelas ditandai contoh**
  (nama campaign berawalan `contoh_`) dan **bukan** angka 20FIT sungguhan; hanya untuk
  memperlihatkan tampilan report saat terisi.

**Tab "Produksi Copy"** — merapikan yang tadinya tersebar di Dashboard/History:
tren mingguan (8 minggu), breakdown platform & bahasa, produk teratas, export CSV.

**Pendukung:** migration `0002_campaign_metrics.sql` (RLS shared-team, ditulis via
service role seperti pola `ad_assets`), item nav **Insights → Reports**, string
i18n ID/EN lengkap, dan CSS di design system.

**Batasan yang dibangun ini secara jujur:**
- Data performa masih **manual/CSV**, belum otomatis dari API platform.
- Angka yang muncul sepenuhnya tergantung apa yang diinput/di-import; akurasi ada di
  tangan pengguna.
- Belum ada dedup (baris dobel bisa terjadi bila import berulang); belum ada edit
  baris (hanya tambah/hapus).

---

## 7. Roadmap Berprioritas

Estimasi effort **kualitatif** (S = kecil, M = sedang, L = besar); bukan komitmen waktu.

### P0 — Fondasi (langsung / sudah sebagian)
- **(Sudah)** Modul Reports + metrik performa manual/CSV + Supabase `campaign_metrics`.
- **Aktifkan Supabase di produksi** dan jalankan `0002_campaign_metrics.sql` agar data
  performa tersimpan durable & shareable. *(S)*

### P1 — Nilai tinggi berikutnya
- **Migrasi riwayat generasi ke Supabase** (server route service-role, meniru
  `/api/assets`) agar History & analitik produksi lintas-perangkat dan team-shared. *(M)*
- **Integrasi API resmi** untuk menarik performa otomatis:
  - **Google Ads API** dan **Meta Marketing/Insights API**. Butuh OAuth, kredensial,
    kemungkinan proses review/izin aplikasi, dan penanganan kuota. **Perlu dicek ke
    dokumentasi resmi** karena versi/limit API berubah dari waktu ke waktu
    (lihat Bagian 9). *(L)*
- **Feedback loop A/B:** tandai tiap variasi copy yang dipakai (mis. lewat
  `utm_content`) lalu tautkan ke metrik campaign, sehingga bisa tahu variasi mana yang
  menang → memperbaiki prompt generasi. *(M–L)*
- **Keterkaitan UTM ↔ campaign ↔ metrik** memakai konvensi penamaan campaign yang
  sudah ada di UTM Builder. *(M)*
- **Scheduled report** (email/PDF ringkasan mingguan). *(M)*

### P2 — Pendalaman
- **Atribusi & funnel** (klik → lead → member) — bergantung pada data konversi dari
  CRM 20FIT / GA4; perlu integrasi data eksternal. *(L)*
- **Budget pacing & alert anomali** (mis. CPA melonjak). *(M)*
- **Benchmark internal** antar-periode/platform (memakai data 20FIT sendiri, **bukan**
  benchmark industri karangan). *(M)*
- **Multi-user & role** (butuh Supabase Auth) untuk audit & pembatasan akses. *(M)*

---

## 8. Rekomendasi Teknis Spesifik

1. **Satukan persistensi ke Supabase.** localStorage baik untuk demo, tapi reporting
   tim butuh sumber data tunggal. Pola `/api/assets` (service role) sudah terbukti dan
   bisa diikuti untuk generasi & UTM.
2. **Aktifkan Supabase Auth** (pool user CRM, sesuai catatan PRD di README) untuk
   membuka per-user history, role, dan RLS yang bermakna.
3. **Standарdisasi campaign key.** Jadikan `utm_campaign` sebagai kunci yang
   menautkan generasi copy, link UTM, dan baris metrik — agar report bisa menyatu.
4. **Integrasi bertahap:** CSV import (sudah) → API resmi. CSV memberi nilai langsung
   tanpa menunggu setup OAuth.
5. **Jaga bundle tetap ringan:** grafik cukup inline SVG (sudah); pertimbangkan
   library chart hanya bila kebutuhan visual meningkat signifikan.

---

## 9. Catatan Kejujuran & Yang Perlu Dicek Ulang

- **Tidak ada benchmark industri atau angka performa 20FIT yang dikarang** di dokumen
  ini. Data contoh di aplikasi ditandai jelas sebagai *sample*.
- **Rumus KPI** (CTR, CPC, CPM, CVR, CPA, ROAS) adalah definisi standar yang umum
  dipakai; tetap sebaiknya dikonfirmasi agar cocok dengan definisi internal 20FIT
  (mis. apakah "konversi" = member baru, trial, atau lead).
- **Versi & batas API** Google Ads / Meta berubah seiring waktu. Sebelum implementasi
  integrasi, **cek dokumentasi resmi terbaru** masing-masing platform — saya tidak
  bisa menjamin detail API dari ingatan.
- **Status Supabase di produksi belum saya verifikasi.** Jika belum aktif, tab
  Performa berjalan di mode localStorage sampai env diisi dan migration dijalankan.
- **Estimasi effort (S/M/L) bersifat kasar**, untuk membantu prioritas — bukan
  perkiraan durasi yang presisi.
- Analisis ini berbasis kode pada satu titik waktu; bila kode berubah setelah tanggal
  di atas, sebagian temuan bisa bergeser.

---

*Dokumen ini dibuat untuk membantu tim marketing & developer 20FIT memprioritaskan
pengembangan reporting. Silakan revisi bagian mana pun yang perlu disesuaikan dengan
konteks internal yang tidak terlihat dari kode.*
