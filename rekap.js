// rekap.js

const rekapBody = document.getElementById('rekapBody');
const statusMessage = document.getElementById('statusMessage');

async function loadRekapData() {
    statusMessage.textContent = 'Mengambil data bulanan dari server...';
    try {
        const response = await fetch('rekap.js');
        const result = await response.json();

        if (!result.success) {
            statusMessage.textContent = `❌ Gagal memuat data: ${result.message}`;
            return;
        }

        const data = result.data;
        rekapBody.innerHTML = ''; // Kosongkan data lama

        if (data.length === 0) {
            statusMessage.textContent = 'Belum ada data absensi Pulang yang tercatat untuk rekap bulanan.';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-100';

            // Format Periode Bulan dari YYYY-MM ke format lokal (misal: Oktober 2025)
            const [year, month] = item.periode_bulan.split('-');
            const date = new Date(year, month - 1, 1); 
            const formattedMonth = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.id_karyawan}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.nama}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedMonth}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-indigo-700">${parseFloat(item.total_jam_kerja).toFixed(2)} jam</td>
            `;
            rekapBody.appendChild(row);
        });

        statusMessage.textContent = `Total ${data.length} laporan bulanan berhasil dimuat.`;

    } catch (error) {
        statusMessage.textContent = 'Terjadi kesalahan koneksi saat memuat data rekap bulanan.';
        console.error('Error loading rekap data:', error);
    }
}

loadRekapData();