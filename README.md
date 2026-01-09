# Msarch App

Aplikasi starter Next.js untuk manajemen proyek dan tugas karyawan.

## Prasyarat

- **Node.js**: Versi LTS dari [nodejs.org](https://nodejs.org/).
- **Editor Kode**: [Visual Studio Code](https://code.visualstudio.com/) sangat disarankan.
- **Synology NAS**: Dengan akses admin untuk menginstal paket.
- **Nama Domain**: Anda harus memiliki nama domain sendiri (misalnya: `domain-anda.com`).
- **Akun Cloudflare**: Buat akun gratis di [cloudflare.com](https://dash.cloudflare.com/sign-up).

## Deployment & Konfigurasi HTTPS di Synology NAS (Metode Cloudflare Tunnel)

Metode ini adalah cara paling modern dan aman untuk mempublikasikan aplikasi Anda. **Tidak memerlukan Port Forwarding sama sekali.** Cloudflare Tunnel akan membuat koneksi keluar yang aman dari NAS Anda ke jaringan Cloudflare.

---

### Langkah 1: Hubungkan Domain Anda ke Cloudflare

1.  **Login ke Cloudflare:** Buka [Dashboard Cloudflare](https://dash.cloudflare.com/).
2.  **Tambahkan Situs:** Klik **"Add a site"** dan masukkan nama domain Anda (misal: `domain-anda.com`). Pilih paket **Free**.
3.  **Ubah Nameserver:** Cloudflare akan menampilkan dua nameserver (misal: `chip.ns.cloudflare.com` dan `sue.ns.cloudflare.com`). **Salin keduanya.**
4.  Buka situs tempat Anda membeli domain (Niagahoster, Rumahweb, dll.), cari pengaturan **Nameserver** untuk domain Anda, dan ganti nameserver yang ada dengan dua nameserver dari Cloudflare.
5.  Kembali ke Cloudflare, klik **"Done, check nameservers"**. Proses ini mungkin memakan waktu beberapa menit hingga beberapa jam. Anda akan menerima email jika sudah selesai.

---

### Langkah 2: Buat Cloudflare Tunnel dan Dapatkan Token

1.  Di dashboard Cloudflare, setelah domain Anda aktif, klik menu **Zero Trust** di sidebar kiri.
2.  Di dalam Zero Trust, navigasi ke **Access -> Tunnels**.
3.  Klik **"Create a tunnel"**.
4.  Pilih **Cloudflared** sebagai tipe konektor, klik **Next**.
5.  Beri nama tunnel Anda, misalnya `msarch-tunnel`. Klik **"Save tunnel"**.
6.  Anda akan masuk ke halaman "Install connector". Di bawah bagian **"Run a connector"**, pilih **Docker**.
7.  Cloudflare akan memberikan Anda satu baris perintah Docker, contohnya:
    ```sh
    docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TOKEN_PANJANG_ANDA_DI_SINI>
    ```
8.  **Salin HANYA bagian token-nya saja.** Token ini adalah string yang sangat panjang setelah `--token`. **Ini sangat rahasia!**

---

### Langkah 3: Siapkan File Konfigurasi di NAS

1.  **Buat Struktur Folder:**
    - Buka **File Station** di NAS Anda.
    - Di bawah folder `docker`, buat folder baru bernama `msarch-app`.
    - **Pindahkan semua file dan folder proyek Anda** (`Dockerfile`, `package.json`, `src`, dll.) ke dalam folder `/docker/msarch-app/`.
    - **PENTING:** Pastikan folder `msarch-data` (yang berisi folder `database`, `uploads`, dll.) ada di dalam direktori proyek `/docker/msarch-app/`. Folder ini akan dibuat secara otomatis saat kontainer pertama kali berjalan, tetapi jika Anda memulihkan dari cadangan, tempatkan di sini.

2.  **Buat dan Isi File `.env`:**
    - Di dalam folder `/docker/msarch-app`, buat file baru bernama `.env`.
    - Salin dan tempel konten di bawah ini.
    - **PENTING:** Ganti `GANTI_DENGAN_TOKEN_CLOUDFLARE_ANDA` dengan token yang Anda salin dari Langkah 2.
    - **PENTING:** Ganti `subdomain.domain-anda.com` dengan alamat yang ingin Anda gunakan (misal: `app.msarch.com`).

    ```env
    # ==================================
    # Kredensial Cloudflare Tunnel
    # ==================================
    # Dapatkan dari dashboard Cloudflare Zero Trust > Access > Tunnels
    CLOUDFLARED_TOKEN="GANTI_DENGAN_TOKEN_CLOUDFLARE_ANDA"
    
    # ==================================
    # Kredensial Google OAuth 2.0
    # ==================================
    # Dapatkan dari Google Cloud Console: https://console.cloud.google.com/apis/credentials
    # PENTING: Saat membuat kredensial, tambahkan URI pengalihan di bawah ini.
    GOOGLE_CLIENT_ID="GANTI_DENGAN_CLIENT_ID_ANDA"
    GOOGLE_CLIENT_SECRET="GANTI_DENGAN_CLIENT_SECRET_ANDA"
    NEXT_PUBLIC_GOOGLE_REDIRECT_URI="https://subdomain.domain-anda.com/api/auth/google/callback"

    # ==================================
    # Kunci VAPID untuk Notifikasi Push
    # ==================================
    # Jalankan 'npx web-push generate-vapid-keys' di terminal komputer Anda
    VAPID_SUBJECT="mailto:email-anda@example.com"
    NEXT_PUBLIC_VAPID_PUBLIC_KEY="GANTI_DENGAN_PUBLIC_KEY_ANDA"
    VAPID_PRIVATE_KEY="GANTI_DENGAN_PRIVATE_KEY_ANDA"
    ```

---

### Langkah 4: Bangun dan Jalankan Aplikasi di Container Manager

1.  Buka **Container Manager** di Synology NAS.
2.  Navigasi ke **Project** dan klik **Create**.
3.  **Project Name**: `msarch-app`
4.  **Path**: Arahkan ke `/docker/msarch-app`.
5.  **Source**: Pilih **Create docker-compose.yml**.
6.  Salin dan tempel konfigurasi berikut ini ke dalam editor:

    ```yaml
    version: '3.8'
    services:
      # Layanan untuk aplikasi Next.js Anda
      app:
        build:
          context: .
          dockerfile: Dockerfile
        container_name: msarch-app-prod
        restart: unless-stopped
        env_file:
          - .env

      # Layanan untuk Cloudflare Tunnel
      tunnel:
        image: cloudflare/cloudflared:latest
        container_name: msarch-tunnel-connector
        restart: unless-stopped
        command: tunnel --no-autoupdate run
        environment:
          - TUNNEL_TOKEN=${CLOUDFLARED_TOKEN}
    ```
7.  Klik **Next**, lewati pengaturan Web Station, lalu klik **Done** untuk memulai proses build dan menjalankan kedua container.

---

### Langkah 5: Arahkan Lalu Lintas ke Aplikasi Anda

1.  Kembali ke halaman tunnel di **Cloudflare Zero Trust Dashboard**. Anda seharusnya melihat konektor Anda sekarang aktif. Klik **Next**.
2.  Di tab **Public Hostnames**, klik **"Add a public hostname"**.
3.  Isi formulir:
    *   **Subdomain:** `app` (atau subdomain lain yang Anda inginkan).
    *   **Domain:** Pilih domain Anda.
    *   **Service -> Type:** `HTTP`
    *   **Service -> URL:** `app:4000` (Ganti `app` sesuai nama service di `docker-compose.yml`)
4.  Klik **"Save hostname"**.

---

### Langkah 6: Akses Aplikasi Anda

Tunggu beberapa saat, lalu buka browser dan akses aplikasi Anda melalui alamat `https` yang baru saja Anda konfigurasikan.

**`https://app.domain-anda.com`**

Aplikasi Anda kini berjalan dengan aman, dapat diakses dari mana saja, dan semua fitur (lokasi, notifikasi, login Google) akan berfungsi dengan baik.
