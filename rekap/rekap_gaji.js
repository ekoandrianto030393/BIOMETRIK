// rekap.js

document.addEventListener('DOMContentLoaded', () => {
    fetchRecapData();
});

/**
 * Mengambil data rekap absensi dari server (endpoint /rekap.js)
 * dan menampilkan hasilnya ke dalam tabel di rekap.html.
 */
async function fetchRecapData() {
    console.log('Fetching recap data from server...');

    try {
        const response = await fetch('/rekap.js');
        const result = await response.json();

        if (result.success && result.data) {
            console.log(`Successfully fetched ${result.data.length} records.`);
            renderRecapTable(result.data);
            updateRecapStats(result.data);
            initializeChart(result.data); // Inisialisasi Chart dengan data asli
        } else {
            document.getElementById('recapTableBody').innerHTML = '<tr><td colspan="5" class="text-center text-red-400 p-4">Server error atau data kosong.</td></tr>';
            console.error('Server returned unsuccessful response:', result);
        }
    } catch (error) {
        document.getElementById('recapTableBody').innerHTML = '<tr><td colspan="5" class="text-center text-red-400 p-4">Koneksi server gagal. Pastikan server.js berjalan di port 3000.</td></tr>';
        console.error('Fetch error:', error);
    }
}

/**
 * Mengisi tabel riwayat rekap.
 * @param {Array} data - Data rekap dari server.
 */
function renderRecapTable(data) {
    const tbody = document.getElementById('recapTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 p-4">Belum ada data rekap absensi.</td></tr>';
        return;
    }

    data.forEach((item, index) => {
        const row = tbody.insertRow();
        row.className = 'hover:bg-cyan-900/10 transition-colors';

        // 1. ID
        const idCell = row.insertCell();
        idCell.textContent = item.id_karyawan;
        
        // 2. Nama
        row.insertCell().textContent = item.nama;

        // 3. Periode
        row.insertCell().textContent = item.periode_bulan;

        // 4. Total Jam Kerja (Decimal)
        const jamDesimal = parseFloat(item.total_jam_kerja_decimal);
        const jamDesimalCell = row.insertCell();
        jamDesimalCell.textContent = `${jamDesimal.toFixed(2)} Jam`;
        jamDesimalCell.className = 'text-right font-bold';
        
        // 5. Total Jam Kerja (H:M:S)
        const jamHMSCell = row.insertCell();
        jamHMSCell.textContent = item.total_jam_kerja_hms;
        jamHMSCell.className = 'text-right neon-text-green font-bold';
    });
}

/**
 * Mengupdate statistik rekap di panel atas.
 * @param {Array} data - Data rekap dari server.
 */
function updateRecapStats(data) {
    // Menghitung statistik sederhana dari data yang ada
    const totalEntries = data.length;
    let totalJamKerja = 0;
    
    // Asumsi: Kita hanya menggunakan data dari 5 karyawan/periode terbaru untuk grafik
    const latestPeriods = data.slice(0, 5).reverse(); 

    data.forEach(item => {
        totalJamKerja += parseFloat(item.total_jam_kerja_decimal);
    });

    const avgJamKerja = totalEntries > 0 ? (totalJamKerja / totalEntries) : 0;
    
    document.getElementById('totalEntries').textContent = totalEntries;
    document.getElementById('totalJamKerja').textContent = `${totalJamKerja.toFixed(2)} Jam`;
    document.getElementById('avgJamKerja').textContent = `${avgJamKerja.toFixed(2)} Jam`;
}


// --- FUNGSI INTI (CHART.JS) ---
/**
 * Menginisialisasi dan merender grafik menggunakan Chart.js.
 * @param {Array} data - Data rekap dari server.
 */
function initializeChart(data) {
    const ctx = document.getElementById('rekapChart').getContext('2d');
    
    // Ambil data untuk 5 periode/karyawan terbaru untuk ditampilkan di grafik
    // Sederhanakan data untuk grafik: total jam kerja 5 karyawan/periode pertama
    const chartData = data.slice(0, 5).reverse(); 
    
    const labels = chartData.map(item => `${item.nama} (${item.periode_bulan})`);
    const dataValues = chartData.map(item => parseFloat(item.total_jam_kerja_decimal).toFixed(1));
    
    new Chart(ctx, {
        type: 'bar', // Mengubah ke bar chart agar lebih jelas untuk rekap
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Jam Kerja (Jam)',
                data: dataValues,
                backgroundColor: [
                    'rgba(0, 255, 255, 0.6)', // Cyan
                    'rgba(0, 255, 127, 0.6)', // Green
                    'rgba(255, 0, 255, 0.6)', // Magenta
                    'rgba(255, 165, 0, 0.6)', // Orange
                    'rgba(138, 43, 226, 0.6)' // Blue Violet
                ],
                borderColor: '#00FFFF',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Jam Kerja (Jam)',
                        color: '#00FF7F'
                    },
                    ticks: { color: '#00FF7F' },
                    grid: { color: 'rgba(0, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#00FFFF' },
                    grid: { color: 'rgba(0, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#00FFFF'
                    }
                }
            }
        }
    });
}