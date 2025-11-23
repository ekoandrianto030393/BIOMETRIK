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
const fptsStatus = document.getElementById('fptsStatus');

// Overlay Elements
// Catatan: Elemen-elemen ini harus ada di admin.html
const overlay = document.getElementById('regSuccessOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const overlayRegId = document.getElementById('overlayRegId');


// --- 2. KONFIGURASI DAN VARIABEL GLOBAL ---
// Catatan: Ganti 'https://cdn...' menjadi './models' jika Anda mendownload model ke folder lokal
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models'; 
const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
let detectionInterval; 
let isDetecting = false; // Flag untuk mencegah multiple detection saat capture

// Utility function to add messages to the log stream
function addToLogStream(message, color = 'text-indigo-500') {
    const logStream = document.getElementById('logStream');
    if (!logStream) return;
    const p = document.createElement('p');
    // Asumsi CSS variables seperti --status-green dan --warning-red didefinisikan di HTML/CSS
    const resolvedColor = color.includes('--') ? color : color; 
    p.className = `text-xs ${resolvedColor}`;
    p.textContent = message;
    if (logStream.children.length > 15) {
        logStream.removeChild(logStream.children[0]);
    }
    logStream.appendChild(p);
    logStream.scrollTop = logStream.scrollHeight;
}


// --- 3. FUNGSI UTAMA INIALISASI ---

async function initializeApp() {
    statusMessage.textContent = 'Memuat model Face-api.js...';
    spindleLoading.classList.add('active');
    
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        addToLogStream("Log: Model AI berhasil dimuat. Siap.", 'var(--status-green)');
        statusMessage.textContent = 'Model dimuat. Mengakses kamera...';

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        video.addEventListener('loadedmetadata', () => {
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);
            
            detectionInterval = setInterval(updateDetection, 100); 
            
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

async function updateDetection() {
    if (!video.srcObject) return;
    
    // Deteksi wajah dan landmark (tanpa descriptor)
    const detection = await faceapi.detectSingleFace(video, detectionOptions).withFaceLandmarks();

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (detection) {
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize); 
        
        const resizedDetections = faceapi.resizeResults(detection, displaySize);

        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        
        const box = resizedDetections.detection.box;
        const confidence = resizedDetections.detection.score;
        const center = box.x + box.width / 2;
        
        const alignPercentage = ((center / displaySize.width) * 100).toFixed(0);
        
        const isAligned = Math.abs(center - displaySize.width / 2) < 50; 
        const isHighConfidence = confidence > 0.85;

        thresholdStatus.textContent = `${(confidence * 100).toFixed(0)}%`;
        thresholdFill.style.width = `${(confidence * 100)}%`;
        
        alignX.textContent = `${alignPercentage}%`; 

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
        fptsStatus.textContent = '[NO_TARGET]';
        fptsStatus.style.color = 'var(--warning-red)';
        thresholdStatus.textContent = '0%';
        thresholdFill.style.width = '0%';
        alignX.textContent = '--';
        submitRegisterBtn.disabled = true;
    }
}


// --- 5. FUNGSI SUBMIT PENDAFTARAN ---

[regIdKaryawan, regNama].forEach(input => {
    input.addEventListener('input', () => {
        if (!regIdKaryawan.value.trim() || !regNama.value.trim()) {
             submitRegisterBtn.disabled = true;
        }
    });
});

submitRegisterBtn.addEventListener('click', async () => {
    // Nonaktifkan loop deteksi sementara
    clearInterval(detectionInterval); 
    isDetecting = true; 
    submitRegisterBtn.disabled = true;
    
    const nama = regNama.value.trim();
    const idKaryawan = regIdKaryawan.value.trim().toUpperCase();

    statusMessage.textContent = `Menganalisis wajah ${idKaryawan}... MEMBUAT DESCRIPTOR. JANGAN BERGERAK!`;
    addToLogStream(`Log: PROSES Pendaftaran ${idKaryawan} dimulai.`, 'text-yellow-500');
    
    try {
        const detectionWithDescriptor = await faceapi.detectSingleFace(video, detectionOptions)
             .withFaceLandmarks()
             .withFaceDescriptor();
             
        // Bersihkan canvas dari overlay deteksi
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);


        if (!detectionWithDescriptor || !detectionWithDescriptor.descriptor) {
            statusMessage.textContent = '❌ Gagal membuat descriptor. Wajah hilang atau kualitas buruk.';
            addToLogStream('Log: GAGAL mendapatkan descriptor.', 'var(--warning-red)');
            return; 
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
                 descriptor: Array.from(detectionWithDescriptor.descriptor) 
             })
        });
        
        const result = await response.json();

        // --- LOGIKA ALERT OVERLAY BESAR ---
        
        // Atur ID Karyawan yang tampil di overlay
        overlayRegId.textContent = idKaryawan; 
        
        if (result.success) {
            addToLogStream(`Log: ${result.message}`, 'var(--status-green)');
            statusMessage.textContent = '✅ Pendaftaran Selesai. Masukkan data karyawan berikutnya.';

            // Tampilkan Overlay Sukses (HIJAU)
            overlay.style.setProperty('--overlay-color', 'var(--status-green)');
            overlayTitle.textContent = ':: TRANSMISSION COMPLETE ::';
            overlayMessage.textContent = 'DATA BIOMETRIK BERHASIL DIARSIPKAN';
            
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                overlay.classList.add('opacity-0', 'pointer-events-none');
            }, 4000); 

        } else {
            addToLogStream(`Log: Server Error: ${result.message}`, 'var(--warning-red)');
            statusMessage.textContent = '❌ Error Server. Cek Log Stream.';
            
            // Tampilkan Overlay Gagal (MERAH)
            overlay.style.setProperty('--overlay-color', 'var(--warning-red)');
            overlayTitle.textContent = ':: REGISTRATION FAILED ::';
            overlayMessage.textContent = result.message;

            overlay.classList.remove('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                overlay.classList.add('opacity-0', 'pointer-events-none');
            }, 5000);
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
        // Submit button akan di-enable lagi oleh updateDetection jika wajah terkunci
    }
});


// --- 6. PANGGIL INIALISASI ---
initializeApp();