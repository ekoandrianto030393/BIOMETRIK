// server.js

const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// --- KONFIGURASI DATABASE ---
const dbConfig = {
    host: '127.0.0.1', 
    user: 'root', 
    password: '', 
    database: 'biometrik_absensi_wajah_db',
    timezone: '+07:00' 
};

const pool = mysql.createPool(dbConfig);


// --- MIDDLEWARES ---
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());

// --- KONFIGURASI WAKTU UTAMA (Dibuka Sepanjang Hari untuk Uji Coba) ---
const JAM_MASUK_START_H = 6;     
const JAM_MASUK_START_M = 30;
const JAM_MASUK_END_H = 19;      
const JAM_MASUK_END_M = 50;      

const JAM_PULANG_START_H = 20;    
const JAM_PULANG_START_M = 25;    


// --- FUNGSI UTILITAS WAKTU ---
/**
 * Mengembalikan string tanggal YYYY-MM-DD HH:MM:SS (WIB)
 * @param {Date} dateObj
 * @returns {string}
 */
function toSqlDatetime(dateObj) {
    // Karena pool.getConnection sudah mengatur timezone: '+07:00', kita cukup format tanggal
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Mengembalikan string tanggal YYYY-MM-DD (Awal hari ini)
 * @param {Date} dateObj
 * @returns {string}
 */
function getStartOfDaySQL(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} 00:00:00`;
}


// --- ENDPOINT API ---

// 1. GET: Mengambil semua face_descriptor karyawan
app.get('/api/get_descriptors', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT id_karyawan, nama, face_descriptor FROM karyawan'); 
        res.json({ success: true, descriptors: rows });
    } catch (error) {
        console.error('Error mengambil descriptor:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data descriptor. Cek koneksi database.' });
    } finally {
        if (connection) connection.release();
    }
});

// 2. POST: Mendaftar/Update Wajah Karyawan
app.post('/api/register_face', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id_karyawan, nama, descriptor } = req.body;

        if (!id_karyawan || !nama || !descriptor) {
            return res.status(400).json({ success: false, message: 'Data pendaftaran tidak lengkap.' });
        }

        const karyawanId = id_karyawan.toUpperCase();
        const descriptorJson = JSON.stringify(descriptor);

        const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM karyawan WHERE id_karyawan = ?', [karyawanId]);
        const exists = rows[0].count > 0;

        let message;
        if (exists) {
            await connection.execute('UPDATE karyawan SET nama = ?, face_descriptor = ? WHERE id_karyawan = ?', [nama, descriptorJson, karyawanId]);
            message = `Wajah karyawan **${karyawanId} (${nama})** berhasil diperbarui.`;
        } else {
            await connection.execute('INSERT INTO karyawan (id_karyawan, nama, face_descriptor) VALUES (?, ?, ?)', [karyawanId, nama, descriptorJson]);
            message = `Karyawan **${karyawanId} - ${nama}** berhasil didaftarkan.`;
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error pendaftaran wajah:', error);
        res.status(500).json({ success: false, message: 'Error Database Pendaftaran.' });
    } finally {
        if (connection) connection.release();
    }
});

// 3. POST: Proses Absensi (MASUK/PULANG)
app.post('/absensi', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id_karyawan } = req.body;
        const karyawanId = id_karyawan.toUpperCase();
        
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        
        const waktuAbsensi = toSqlDatetime(currentTime); // Format waktu saat ini
        const startOfDaySQL = getStartOfDaySQL(currentTime); // Format awal hari ini (00:00:00)
        
        let message = '';
        let statusColor = 'green';
        let jamKerja = null; // Akan diisi jika absensi PULANG
        
        if (!karyawanId) {
            return res.status(400).json({ success: false, message: 'ID Karyawan tidak valid.', statusColor: 'red' });
        }

        // --- 1. Ambil Nama Karyawan (PENGECEKAN KRITIS) ---
        const [karyawanDataRows] = await connection.execute(
            'SELECT nama FROM karyawan WHERE id_karyawan = ?',
            [karyawanId]
        );
        
        if (karyawanDataRows.length === 0) {
            statusColor = 'red';
            message = `Absensi GAGAL. ID **${karyawanId}** tidak terdaftar di sistem.`;
            return res.json({ success: false, message: message, statusColor: statusColor });
        }

        const karyawanName = karyawanDataRows[0].nama; 

        // --- 2. Tentukan Tipe Absensi Berikutnya ---
        // Cari absensi MASUK hari ini
        const [lastMasukRows] = await connection.execute(
            `SELECT waktu_absensi FROM absensi WHERE id_karyawan = ? AND tipe_absensi = 'MASUK' AND waktu_absensi >= ? ORDER BY waktu_absensi DESC LIMIT 1`,
            [karyawanId, startOfDaySQL]
        );
        const lastMasuk = lastMasukRows[0];
        
        // Cari absensi PULANG hari ini
        const [lastPulangRows] = await connection.execute(
            `SELECT waktu_absensi FROM absensi WHERE id_karyawan = ? AND tipe_absensi = 'PULANG' AND waktu_absensi >= ? ORDER BY waktu_absensi DESC LIMIT 1`,
            [karyawanId, startOfDaySQL]
        );
        const lastPulang = lastPulangRows[0];

        let tipeAbsensiBaru;
        
        if (lastMasuk && !lastPulang) {
            tipeAbsensiBaru = 'PULANG'; // Ada MASUK, belum ada PULANG -> Absen PULANG
        } else if (lastMasuk && lastPulang) {
            // Sudah Masuk dan Pulang hari ini. Absensi berikutnya akan menjadi MASUK (besok)
            // Namun, karena ini hanya absensi satu-kali per hari, kita tolak.
            statusColor = 'red';
            message = `Absensi GAGAL untuk **${karyawanName}**. Anda sudah Absen MASUK dan PULANG hari ini.`;
            return res.json({ success: false, message: message, statusColor: statusColor });
        }
        else {
             tipeAbsensiBaru = 'MASUK'; // Belum ada MASUK hari ini -> Absen MASUK
        }

        // --- 3. LOGIKA VALIDASI WAKTU ---
        const currentTotalMinutes = (currentHour * 60) + currentMinute;
        
        if (tipeAbsensiBaru === 'MASUK') {
            
            // Pengecekan Batasan waktu MASUK
            const targetStartMinutes = (JAM_MASUK_START_H * 60) + JAM_MASUK_START_M;
            const targetEndMinutes = (JAM_MASUK_END_H * 60) + JAM_MASUK_END_M; 

            if (currentTotalMinutes < targetStartMinutes || currentTotalMinutes > targetEndMinutes) {
                statusColor = 'red';
                message = `Absensi MASUK GAGAL. Di luar jendela waktu ${JAM_MASUK_START_H.toString().padStart(2, '0')}:${JAM_MASUK_START_M.toString().padStart(2, '0')} - ${JAM_MASUK_END_H.toString().padStart(2, '0')}:${JAM_MASUK_END_M.toString().padStart(2, '0')}.`;
                return res.json({ success: false, message: message, statusColor: statusColor });
            }

            // Lanjutkan Absensi MASUK
            await connection.execute(
                'INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi) VALUES (?, ?, ?)',
                [karyawanId, tipeAbsensiBaru, waktuAbsensi]
            );
            message = `✅ Absensi MASUK berhasil untuk **${karyawanName}** pada ${currentTime.toLocaleTimeString('id-ID')}.`;

        } else if (tipeAbsensiBaru === 'PULANG') {
            
            // Batasan waktu PULANG
            const targetStartMinutes = (JAM_PULANG_START_H * 60) + JAM_PULANG_START_M;
            
            if (currentTotalMinutes < targetStartMinutes) {
                statusColor = 'red';
                
                const startHourStr = JAM_PULANG_START_H.toString().padStart(2, '0');
                const startMinuteStr = JAM_PULANG_START_M.toString().padStart(2, '0');
                const startStr = `${startHourStr}:${startMinuteStr}`;
                
                message = `Absensi PULANG GAGAL untuk **${karyawanName}**. Absen PULANG baru dimulai jam ${startStr}.`;
                
                return res.json({ success: false, message: message, statusColor: statusColor });
            }

            // Hitung Jam Kerja
            if (lastMasuk) {
                // Konversi string tanggal/waktu SQL ke objek Date
                const waktuMasukMs = new Date(lastMasuk.waktu_absensi).getTime(); 
                const currentTimeMs = currentTime.getTime();                     
                const diff_ms = currentTimeMs - waktuMasukMs; 
                
                if (diff_ms < 0) {
                     statusColor = 'red';
                     message = `Absensi PULANG dibatalkan untuk ${karyawanName}. Waktu masuk tercatat setelah waktu pulang Anda saat ini.`;
                     return res.json({ success: false, message: message, statusColor: statusColor });
                }
                
                jamKerja = (diff_ms / (1000 * 60 * 60)).toFixed(2); // Dikonversi ke jam

                // Insert absensi PULANG
                await connection.execute(
                    'INSERT INTO absensi (id_karyawan, tipe_absensi, waktu_absensi, jam_kerja) VALUES (?, ?, ?, ?)',
                    [karyawanId, tipeAbsensiBaru, waktuAbsensi, jamKerja]
                );
                
                message = `✅ Absensi PULANG berhasil untuk **${karyawanName}**. Jam kerja hari ini: **${jamKerja} jam**`;
            } else {
                // Seharusnya tidak terjadi karena sudah di-filter di awal, tapi sebagai fallback
                statusColor = 'red';
                message = `Absensi GAGAL untuk ${karyawanName}. Anda belum melakukan Absensi MASUK hari ini.`;
                return res.json({ success: false, message: message, statusColor: statusColor });
            }
        }

        // --- Mengirim KEMBALI ID dan NAMA Karyawan ---
        res.json({ 
            success: true, 
            message: message, 
            statusColor: statusColor,
            karyawanName: karyawanName, 
            karyawanId: karyawanId      
        });

    } catch (error) {
        console.error('Error saat mencatat absensi:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat memproses absensi.', statusColor: 'red' });
    } finally {
        if (connection) connection.release();
    }
});


// 4. GET: Endpoint untuk Rekapitulasi Jam Kerja BULANAN
app.get('/api/rekap_jam_kerja', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const sql = `
            SELECT 
                k.id_karyawan,
                k.nama,
                DATE_FORMAT(a.waktu_absensi, '%Y-%m') AS periode_bulan,
                SUM(a.jam_kerja) AS total_jam_kerja
            FROM 
                absensi a
            JOIN 
                karyawan k ON a.id_karyawan = k.id_karyawan
            WHERE 
                a.tipe_absensi = 'PULANG' AND a.jam_kerja IS NOT NULL
            GROUP BY 
                k.id_karyawan, k.nama, periode_bulan
            ORDER BY 
                periode_bulan DESC, k.id_karyawan ASC;
        `;
        
        const [rekapData] = await connection.execute(sql);
        
        res.json({ success: true, data: rekapData });
    } catch (error) {
        console.error('Error saat mengambil rekap jam kerja bulanan:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data rekap bulanan.' });
    } finally {
        if (connection) connection.release();
    }
});


// Menjalankan Server
app.listen(PORT, '0.0.0.0', () => { 
    console.log(`💻 Server Node.js berjalan di http://localhost:${PORT}`);
    console.log(`Akses Aplikasi di http://127.0.0.1:${PORT}/scan.html`);
    console.log(`Buka Admin: http://localhost:${PORT}/admin.html`);
    console.log(`Buka Rekap Gaji: http://localhost:${PORT}/rekap.html`);
});