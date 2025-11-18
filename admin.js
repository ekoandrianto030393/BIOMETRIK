// admin.js

// --- 1. DEFINISI ELEMEN DOM ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const statusMessage = document.getElementById('statusMessage');
const submitRegisterBtn = document.getElementById('submitRegisterBtn');
const spindleLoading = document.getElementById('spindleLoading');

// Input fields
const regIdKaryawan = document.getElementById('regIdKaryawan');
const regNama = document.getElementById('regNama');

// Real-time metrics displays
const thresholdStatus = document.getElementById('thresholdStatus');
const thresholdFill = document.getElementById('thresholdFill');
const alignX = document.getElementById('alignX');
const alignY = document.getElementById('alignY');
const fptsStatus = document.getElementById('fptsStatus');

// --- 2. KONFIGURASI DAN VARIABEL GLOBAL ---
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models';
// Opsi Deteksi Wajah (menggunakan TinyFaceDetector)
const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
let detectionInterval; // Variabel untuk menyimpan loop deteksi
let isDetecting = false; // Flag untuk mencegah multiple detection saat capture

// Utility function to add messages to the log stream
function addToLogStream(message, color = 'text-indigo-500') {
    const logStream = document.getElementById('logStream');
    if (!logStream) return;
    const p = document.createElement('p');
    p.className = `text-xs ${color}`;
    p.textContent = message;
    if (logStream.children.length > 15) {
        logStream.removeChild(logStream.children[0]);
    }
    logStream.appendChild(p);
    logStream.scrollTop = logStream.scrollHeight;
}


// --- 3. FUNGSI UTAMA INIALISASI ---

/**
 * Memuat model AI dan memulai stream kamera.
 */
async function initializeApp() {
    statusMessage.textContent = 'Memuat model Face-api.js...';
    spindleLoading.classList.add('active');
    
    try {
        // 3.1. Memuat Model dari CDN
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        addToLogStream("Log: Model AI berhasil dimuat. Siap.", 'var(--status-green)');
        statusMessage.textContent = 'Model dimuat. Mengakses kamera...';

        // 3.2. Mengakses Kamera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        video.addEventListener('loadedmetadata', () => {
            // Atur ukuran canvas agar sesuai dengan resolusi video saat dimuat
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);
            
            // 3.3. Mulai loop deteksi real-time
            detectionInterval = setInterval(updateDetection, 100); // Setiap 100ms (10 FPS)
            
            spindleLoading.classList.remove('active');
            statusMessage.textContent = 'SYSTEM READY. Silakan isi data dan tunjukkan wajah.';
            addToLogStream(`Log: Video Stream Aktif (${video.videoWidth}x${video.videoHeight}).`, 'var(--status-green)');
        });

    } catch (err) {
        spindleLoading.classList.remove('active');
        statusMessage.textContent = `❌ Gagal inisialisasi: ${err.name}. Cek konsol.`;
        addToLogStream(`Log: FATAL ERROR: ${err.name}. Akses kamera gagal.`, 'var(--warning-red)');
        console.error('Initialization error:', err);
    }
}

// --- 4. CONTINUOUS DETECTION LOOP ---

/**
 * Fungsi yang berjalan berulang untuk mendeteksi wajah dan menggambar overlay.
 */
async function updateDetection() {
    if (!video.srcObject) return;
    
    // Deteksi wajah dan landmark (tanpa descriptor)
    const detection = await faceapi.detectSingleFace(video, detectionOptions).withFaceLandmarks();

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (detection) {
        // Resize hasil deteksi agar sesuai dengan ukuran tampilan (CSS) video
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize); // Pastikan canvas sesuai ukuran
        
        const resizedDetections = faceapi.resizeResults(detection, displaySize);

        // Gambar kotak deteksi dan landmark
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        
        // Update Status Panel (F-PTS, Threshold)
        const box = resizedDetections.detection.box;
        const confidence = resizedDetections.detection.score;
        const center = box.x + box.width / 2;
        
        const alignPercentage = ((center / displaySize.width) * 100).toFixed(0);
        
        // Logika sederhana untuk Threshold dan Alignment
        const isAligned = Math.abs(center - displaySize.width / 2) < 50; // Jarak dari tengah
        const isHighConfidence = confidence > 0.85;

        thresholdStatus.textContent = `${(confidence * 100).toFixed(0)}%`;
        thresholdFill.style.width = `${(confidence * 100)}%`;
        
        alignX.textContent = `${alignPercentage}%`; // Menggunakan persentase horizontal

        if (isAligned && isHighConfidence) {
            fptsStatus.textContent = '[TARGET_LOCKED]';
            fptsStatus.style.color = 'var(--status-green)';
            if (regIdKaryawan.value.trim() && regNama.value.trim() && !isDetecting) {
                submitRegisterBtn.disabled = false;
            }
        } else {
            fptsStatus.textContent = '[SEARCHING_TARGET]';
            fptsStatus.style.color = 'var(--aether-blue)';
            submitRegisterBtn.disabled = true;
        }

    } else {
        // Jika tidak ada wajah terdeteksi
        fptsStatus.textContent = '[NO_TARGET]';
        fptsStatus.style.color = 'var(--warning-red)';
        thresholdStatus.textContent = '0%';
        thresholdFill.style.width = '0%';
        alignX.textContent = '--';
        submitRegisterBtn.disabled = true;
    }
}


// --- 5. FUNGSI SUBMIT PENDAFTARAN ---

// Enable button when both fields are filled AND a face is detected (Logic handled in updateDetection)
[regIdKaryawan, regNama].forEach(input => {
    input.addEventListener('input', () => {
        // Hanya cek apakah field terisi. Status enable/disable diatur oleh updateDetection
        if (!regIdKaryawan.value.trim() || !regNama.value.trim()) {
             submitRegisterBtn.disabled = true;
        }
    });
});

submitRegisterBtn.addEventListener('click', async () => {
    // Nonaktifkan loop deteksi saat proses capture descriptor
    clearInterval(detectionInterval); 
    isDetecting = true; // Set flag
    submitRegisterBtn.disabled = true;
    
    const nama = regNama.value.trim();
    const idKaryawan = regIdKaryawan.value.trim().toUpperCase();

    statusMessage.textContent = `Menganalisis wajah ${idKaryawan}... MEMBUAT DESCRIPTOR. JANGAN BERGERAK!`;
    addToLogStream(`Log: PROSES Pendaftaran ${idKaryawan} dimulai.`, 'text-yellow-500');
    
    try {
        // Deteksi wajah + Landmark + EKSTRAK Descriptor
        const detectionWithDescriptor = await faceapi.detectSingleFace(video, detectionOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();
            
        // Bersihkan canvas agar tidak ada overlay saat alert muncul
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);


        if (!detectionWithDescriptor || !detectionWithDescriptor.descriptor) {
            statusMessage.textContent = '❌ Gagal membuat descriptor. Wajah hilang atau kualitas buruk.';
            addToLogStream('Log: GAGAL mendapatkan descriptor.', 'var(--warning-red)');
            return; // Lanjut ke bagian finally untuk reset
        }
        
        statusMessage.textContent = '✅ Descriptor Wajah berhasil di-ekstrak. Mengirim ke Server...';
        addToLogStream('Log: Descriptor berhasil di-ekstrak. Mengirim ke server...', 'text-yellow-500');

        // Kirim data ke Node.js Express API
        const response = await fetch('/api/register_face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_karyawan: idKaryawan,
                nama: nama,
                // Pastikan descriptor dikonversi ke array JS biasa
                descriptor: Array.from(detectionWithDescriptor.descriptor) 
            })
        });
        
        const result = await response.json();

        if (result.success) {
            alert(result.message);
            addToLogStream(`Log: ${result.message}`, 'var(--status-green)');
            statusMessage.textContent = '✅ Pendaftaran Selesai. Masukkan data karyawan berikutnya.';
        } else {
            alert(`Pendaftaran GAGAL: ${result.message}`);
            addToLogStream(`Log: Server Error: ${result.message}`, 'var(--warning-red)');
            statusMessage.textContent = '❌ Error Server. Cek Log Stream.';
        }
        
    } catch (error) {
        console.error('Registration Error:', error);
        alert('Terjadi kesalahan saat pendaftaran. Cek konsol.');
        statusMessage.textContent = '❌ Error Sistem. Cek konsol browser.';
    } finally {
        // Reset Form
        regIdKaryawan.value = '';
        regNama.value = '';
        
        // Re-enable detection loop dan reset flag
        isDetecting = false;
        detectionInterval = setInterval(updateDetection, 100);
        submitRegisterBtn.disabled = false;
    }
});


// --- 6. PANGGIL INIALISASI ---
initializeApp();