// scan.js

const video = document.getElementById('videoElement');
const statusMessage = document.getElementById('statusMessage');
const clock = document.getElementById('clock');
const canvas = document.getElementById('overlay');

// --- Global Vars & Config ---
const successOverlay = document.getElementById('successOverlay');
const overlayStatus = document.getElementById('overlayStatus');
const overlayMessage = document.getElementById('overlayMessage');
const userIdDisplay = document.getElementById('userIdDisplay'); 
const userStatusDisplay = document.getElementById('userStatusDisplay'); 
const lastActionDisplay = document.getElementById('lastActionDisplay');
const dataStream = document.getElementById('dataStream');
const graphElement = document.getElementById('graph');
const videoContainer = document.getElementById('videoContainer'); 
const matchThresholdBar = document.getElementById('matchThresholdBar'); 

let labeledDescriptors = null;
let detectionInterval = null; 
let isProcessing = false; 
let employeeMap = {};

const FACE_MATCHING_THRESHOLD = 0.6; 
const DETECTION_INTERVAL_MS = 1000; 
const COOLDOWN_MS_SUCCESS = 7000; 
const COOLDOWN_MS_FAIL = 5000;
const OVERLAY_DISPLAY_MS = 3000;


// --- UTILITY FUNCTIONS ---
setInterval(() => {
    clock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

// Text-to-Speech DINONAKTIFKAN
function speakStatus(text) {
    // Fungsi ini dikosongkan agar tidak ada suara
    return;
}

// Data Stream & Graph Simulation (Wajib disertakan di file Anda)
function generateRandomDataLine() {
    const chars = '01FfAaBbCcDdEe987654321';
    let result = '';
    const length = 20;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const timestamp = new Date().toLocaleTimeString('en-US', {hour12: false, second: '2-digit'});
    return `<p class="my-0.5 text-cyan-700">${timestamp}: <span class="text-amber-500">${result}</span></p>`;
}

function updateDataStream() {
    dataStream.innerHTML = generateRandomDataLine() + dataStream.innerHTML;
    const paragraphs = dataStream.querySelectorAll('p');
    if (paragraphs.length > 8) {
        dataStream.removeChild(paragraphs[paragraphs.length - 1]);
    }
}

function updateGraph() {
    const barHeight = Math.floor(Math.random() * 90) + 5;
    const bar = document.createElement('div');
    bar.className = 'graph-bar';
    bar.style.height = `${barHeight}%`;
    bar.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
    
    graphElement.appendChild(bar);

    if (graphElement.children.length > 30) { 
        graphElement.removeChild(graphElement.children[0]);
    }
}
setInterval(updateDataStream, 50); 
setInterval(updateGraph, 300);    


// Muat Data Wajah Terdaftar 
async function loadLabeledImages() {
    statusMessage.textContent = 'Memuat data wajah karyawan dari server...';
    try {
        const response = await fetch('/api/get_descriptors'); 
        const data = await response.json();
        
        if (!data.success || data.descriptors.length === 0) {
            statusMessage.textContent = '⚠️ Tidak ada wajah terdaftar. Hubungi Admin.';
            return null;
        }
        
        const labeledDescriptors = data.descriptors.map(item => {
            const descriptorArray = Object.values(JSON.parse(item.face_descriptor)).map(val => parseFloat(val));
            employeeMap[item.id_karyawan] = item.nama; 
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        statusMessage.textContent = `${labeledDescriptors.length} wajah terdaftar. Siap Absen.`;
        return labeledDescriptors;

    } catch (error) {
        statusMessage.textContent = `❌ Gagal memuat data wajah. Cek koneksi ke server/DB.`;
        return null;
    }
}


// 1. Initialisasi: Muat Model dan Start Kamera
async function initializeApp() {
    statusMessage.textContent = 'Memuat model Face-api.js...';
    
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        
        statusMessage.textContent = 'Model berhasil dimuat. Mengakses kamera...';
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
    } catch (err) {
        statusMessage.textContent = `❌ Gagal inisialisasi: ${err.name}. Pastikan Anda menggunakan localhost dan kamera tersedia.`;
    }
}

// 2. Setelah Kamera Siap
video.addEventListener('play', async () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    labeledDescriptors = await loadLabeledImages();
    
    // Set status awal kolom kanan
    userIdDisplay.textContent = 'MENUNGGU SCAN';
    userStatusDisplay.textContent = 'TIDAK TEROTORISASI';
    userStatusDisplay.classList.add('text-red-500');

    if (detectionInterval === null) {
        detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
    }
});


// 3. Deteksi dan Pengenalan Wajah Otomatis
async function detectFace() {
    if (isProcessing) return; 
    if (!labeledDescriptors) {
        labeledDescriptors = await loadLabeledImages();
        return;
    }
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height); 

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    // Reset Lock-on Visual
    videoContainer.classList.remove('scan-success'); 

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
        const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
        
        // Update Progress Bar Simulasi berdasarkan jarak
        const matchDistance = bestMatch.distance;
        const confidence = Math.max(0, (FACE_MATCHING_THRESHOLD - matchDistance) / FACE_MATCHING_THRESHOLD) * 100;
        matchThresholdBar.style.width = `${Math.max(10, Math.min(100, confidence))}%`;
        
        if (bestMatch.label !== 'unknown') {
            const recognizedId = bestMatch.label;
            const recognizedName = employeeMap[recognizedId] || recognizedId;
            
            // --- UPDATE KOLOM ANALISIS AWAL ---
            userIdDisplay.textContent = recognizedName; // Tampilkan NAMA
            userStatusDisplay.textContent = 'OTENTIKASI...'; 
            userStatusDisplay.classList.remove('text-red-500');
            userStatusDisplay.classList.add('text-amber-500'); 
            
            const box = resizedDetections.detection.box;
            // KOREKSI: Pastikan kotak deteksi dengan NAMA digambar sebelum penghapusan
            new faceapi.draw.DrawBox(box, { label: `${recognizedName}` }).draw(canvas); 
            // -------------------------------------------------------------

            // --- PENGHENTIAN ELEGAN ---
            clearInterval(detectionInterval); 
            detectionInterval = null; 
            context.clearRect(0, 0, canvas.width, canvas.height); // Hapus kotak/canvas setelah ID di-lock
            
            statusMessage.textContent = `Wajah ${recognizedName} terdeteksi. Memproses absensi...`;
            await processAttendance(recognizedId);

        } else {
            // Wajah tidak dikenal
            userIdDisplay.textContent = 'TIDAK DIKENAL'; 
            userStatusDisplay.textContent = 'AKSES DITOLAK'; 
            userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
            userStatusDisplay.classList.add('text-red-500');
            
            const box = resizedDetections.detection.box;
            new faceapi.draw.DrawBox(box, { label: `Tidak Dikenal` }).draw(canvas);
            statusMessage.textContent = 'Arahkan wajah Anda ke kamera... Wajah tidak dikenal.';
        }
    } else {
        // Reset Kolom Kanan saat tidak ada wajah
        userIdDisplay.textContent = 'MENUNGGU SCAN';
        userStatusDisplay.textContent = 'TIDAK TEROTORISASI';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        statusMessage.textContent = 'Arahkan wajah Anda ke kamera...';
        matchThresholdBar.style.width = '0%';
    }
}

// 4. Kirim Permintaan Absensi ke Backend
async function processAttendance(karyawanId) {
    isProcessing = true; 
    
    statusMessage.classList.remove('text-red-600', 'text-green-600', 'font-extrabold');
    statusMessage.classList.add('text-gray-700', 'font-extrabold');
    statusMessage.innerHTML = 'Memproses absensi...';

    try {
        const response = await fetch('/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });

        const result = await response.json();
        
        // 1. Pewarnaan Status
        statusMessage.classList.remove('text-gray-700', 'text-red-600', 'text-green-600', 'font-extrabold');

        if (result.statusColor === 'red') {
            // Skenario GAGAL
            statusMessage.classList.add('text-red-600', 'font-extrabold');
            userStatusDisplay.classList.remove('text-amber-500', 'text-green-500');
            userStatusDisplay.classList.add('text-red-500');
            userStatusDisplay.textContent = 'AKSES DITOLAK';
            
            // --- ANIMASI GAGAL (Overlay Merah) ---
            overlayStatus.textContent = 'AKSES DITOLAK';
            overlayMessage.textContent = result.message;
            successOverlay.style.background = 'rgba(150, 0, 0, 0.85)'; // Merah
            successOverlay.style.opacity = 1;
            await new Promise(resolve => setTimeout(resolve, OVERLAY_DISPLAY_MS)); 
            successOverlay.style.opacity = 0;
            
        } else {
            // Skenario Sukses: TAMPILKAN ANIMASI OVERLAY HIJAU
            
            // 1. Tampilkan overlay selama 3 detik
            overlayStatus.textContent = 'AKSES DIBERIKAN'; 
            overlayMessage.textContent = result.message.replace('✅ ', ''); 
            successOverlay.style.background = 'rgba(0, 150, 0, 0.85)'; // Hijau
            successOverlay.style.opacity = 1;
            await new Promise(resolve => setTimeout(resolve, OVERLAY_DISPLAY_MS)); 
            successOverlay.style.opacity = 0;
            
            // 2. Update status utama
            statusMessage.classList.add('text-green-600', 'font-extrabold');
            userStatusDisplay.classList.remove('text-amber-500', 'text-red-500');
            userStatusDisplay.classList.add('text-green-500');
            userStatusDisplay.textContent = 'AKSES DIBERIKAN'; 
            
            // Update data nama dan waktu
            if (result.karyawanName) {
                userIdDisplay.textContent = result.karyawanName;
                lastActionDisplay.textContent = new Date().toLocaleTimeString('id-ID');
            }
        }
        
        statusMessage.innerHTML = result.message; 

        // 3. JEDA WAKTU (COOLDOWN)
        const cooldownTime = result.success ? COOLDOWN_MS_SUCCESS :7000; COOLDOWN_MS_FAIL; 7000;
        
        await new Promise(resolve => setTimeout(resolve, cooldownTime));

    } catch (error) {
        statusMessage.classList.remove('text-gray-700', 'text-green-600');
        statusMessage.classList.add('text-red-600', 'font-extrabold');
        statusMessage.innerHTML = '❌ Kesalahan koneksi atau server.';
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Reset status error
        userIdDisplay.textContent = 'KONEKSI GAGAL'; 
        userStatusDisplay.textContent = 'ERROR';
        userStatusDisplay.classList.add('text-red-500');

    } finally {
        isProcessing = false; 
        
        // 4. Reset Animasi Visual
        videoContainer.classList.remove('scan-success'); 
        matchThresholdBar.style.width = '0%'; 
        
        // 5. Kembali ke status scanning normal
        statusMessage.innerHTML = 'Arahkan wajah ke kamera untuk Absen...';
        statusMessage.classList.remove('text-red-600', 'text-green-600', 'font-extrabold');
        statusMessage.classList.add('text-gray-700');
        
        // Reset display saat scanning dilanjutkan
        userIdDisplay.textContent = 'MENUNGGU SCAN';
        userStatusDisplay.textContent = 'TIDAK TEROTORISASI';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        
        // 6. Restart interval deteksi
        if (detectionInterval === null) { 
            detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
        }
    }
}

initializeApp();