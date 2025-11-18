-- TABEL 1: KARYAWAN (Untuk menyimpan wajah dan identitas)
CREATE TABLE karyawan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_karyawan VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    -- Menyimpan deskriptor wajah sebagai string JSON
    face_descriptor JSON NOT NULL, 
    tanggal_registrasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABEL 2: ABSENSI (Untuk mencatat waktu masuk dan pulang)
CREATE TABLE absensi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_karyawan VARCHAR(50) NOT NULL,
    tipe_absensi ENUM('MASUK', 'PULANG') NOT NULL,
    waktu_absensi DATETIME NOT NULL,
    -- Jam kerja dihitung dan diisi saat absensi PULANG
    jam_kerja DECIMAL(5, 2), 
    -- Menghubungkan ke tabel karyawan
    FOREIGN KEY (id_karyawan) REFERENCES karyawan(id_karyawan)
);