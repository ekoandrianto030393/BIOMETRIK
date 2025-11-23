/**
 * scan.js - FINAL VERSION + ADVANCED ANIMATION ELEMENTS
 * Didesain untuk sistem absensi biometrik futuristik.
 */

// --- GLOBAL DOM & VARS ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('overlay');
const videoContainer = document.getElementById('videoContainer');
const statusMessage = document.getElementById('statusMessage');
const clockDisplay = document.getElementById('clock');
const successOverlay = document.getElementById('successOverlay');
const overlayStatus = document.getElementById('overlayStatus');
const overlayMessage = document.getElementById('overlayMessage');
const userIdDisplay = document.getElementById('userIdDisplay');
const userStatusDisplay = document.getElementById('userStatusDisplay');
const lastActionDisplay = document.getElementById('lastActionDisplay');
const dataStream = document.getElementById('dataStream');
const graphElement = document.getElementById('graph');
const matchThresholdBar = document.getElementById('matchThresholdBar');
// NEW: Status Widget Elements
const networkStatus = document.getElementById('networkStatus');
const cameraStatus = document.getElementById('cameraStatus');
const dbStatus = document.getElementById('dbStatus');
const systemLog = document.getElementById('systemLog');


let labeledDescriptors = null;
let detectionInterval = null;
let isProcessing = false; // KUNCI UTAMA: true saat sedang kirim data/cooldown
let employeeMap = {};

const FACE_MATCHING_THRESHOLD = 0.6;
const DETECTION_INTERVAL_MS = 100;


// =============================================================================
// 1. MESIN RENDERING VISUAL (HUD)
// =============================================================================

/** Menggambar bracket futuristik di sekitar wajah. */
function drawTechBracket(ctx, x, y, w, h, color) {
    const lineLen = w / 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;

    // Kiri Atas
    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
    // Kanan Atas
    ctx.beginPath(); ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen); ctx.stroke();
    // Kanan Bawah
    ctx.beginPath(); ctx.moveTo(x + w, y + h - lineLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - lineLen, y + h); ctx.stroke();
    // Kiri Bawah
    ctx.beginPath(); ctx.moveTo(x + lineLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - lineLen); ctx.stroke();

    ctx.shadowBlur = 0;
}

/** Menggambar mesh holografik menggunakan landmark wajah. */
function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';

    const regions = [
        [0, 16, false], [17, 21, false], [22, 26, false], [27, 30, false],
        [31, 35, false], [36, 41, true], [42, 47, true], [48, 59, true], [60, 67, true]
    ];

    ctx.beginPath();
    regions.forEach(region => {
        const start = region[0];
        const end = region[1];
        const isLoop = region[2];
        ctx.moveTo(points[start].x, points[start].y);
        for (let i = start + 1; i <= end; i++) ctx.lineTo(points[i].x, points[i].y);
        if (isLoop) ctx.lineTo(points[start].x, points[start].y);
    });
    ctx.stroke();
    ctx.fill();
}

/** Menggambar data tag di samping wajah (simulasi data analisis). */
function drawDataTags(ctx, box, landmarks) {
    const tagX = box.right + 20;
    let tagY = box.top + 10;
    const fontSize = 12;

    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'left';

    const nose = landmarks.getNose()[0];
    const jaw = landmarks.getJawOutline()[8];
    const tilt = (nose.x - jaw.x).toFixed(2);

    const dataLines = [
        { text: `ID_SIG: ${Math.floor(Math.random() * 99999)}`, color: '#00FFFF' },
        { text: `DIST: ${(2500 / box.width).toFixed(2)}mm`, color: '#00FFFF' },
        { text: `AXIS: ${tilt}`, color: '#00FF7F' },
        { text: `SYNC: ACTIVE`, color: '#FF00FF' }
    ];

    ctx.beginPath(); ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.moveTo(box.right, box.top); ctx.lineTo(tagX - 10, box.top); ctx.stroke();

    dataLines.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, tagX, tagY + (i * 18));
    });
}

// =============================================================================
// 2. FUNGSI UTILITAS & ANIMASI CANGGIH
// =============================================================================

/** Menambahkan pesan ke log sistem dengan timestamp. */
function logSystem(message, color = 'text-green-500') {
    if (!systemLog) return;
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const newLog = document.createElement('p');
    newLog.className = `${color} my-0.5 text-xs`;
    newLog.innerHTML = `[${timestamp}] > ${message}`;

    // Animasi masuk (opacity)
    newLog.style.opacity = 0;
    setTimeout(() => newLog.style.opacity = 1, 10);

    systemLog.prepend(newLog);
    // Batasi log
    while (systemLog.children.length > 15) {
        systemLog.removeChild(systemLog.lastChild);
    }
}

/** Mengatur status visual dari message bar (dengan pulse effect). */
function setStatusVisual(message, colorClass, isPulsing = false) {
    statusMessage.textContent = message;
    statusMessage.className = 'text-xl font-bold transition-colors duration-300';
    statusMessage.classList.add(colorClass);

    if (isPulsing) {
        statusMessage.classList.add('animate-pulse');
    } else {
        statusMessage.classList.remove('animate-pulse');
    }
}

/** Update jam sistem */
setInterval(() => {
    if(clockDisplay) clockDisplay.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

/** Update stream data acak */
function updateDataStream() {
    if(!dataStream) return;
    const chars = '01FfAaBbCcDdEe987654321';
    let result = '';
    for (let i = 0; i < 20; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    const timestamp = new Date().toLocaleTimeString('en-US', {hour12: false, second: '2-digit'});

    dataStream.innerHTML = `<p class="my-0.5 text-cyan-700">${timestamp}: <span class="text-amber-500">${result}</span></p>` + dataStream.innerHTML;
    if (dataStream.children.length > 8) dataStream.removeChild(dataStream.lastChild);
}

/** Update waveform graph */
function updateGraph() {
    if(!graphElement) return;
    const barHeight = Math.floor(Math.random() * 90) + 5;
    const bar = document.createElement('div');
    bar.className = 'graph-bar';
    bar.style.height = `${barHeight}%`;
    const colors = ['#00FFFF', '#00FF7F', '#FF00FF'];
    bar.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    graphElement.appendChild(bar);
    if (graphElement.children.length > 30) graphElement.removeChild(graphElement.firstChild);
}
setInterval(updateDataStream, 50);
setInterval(updateGraph, 300);

// =============================================================================
// 3. LOGIKA SYSTEM & DETEKSI
// =============================================================================

/** Memuat deskriptor wajah dari API backend. */
async function loadLabeledImages() {
    setStatusVisual('Memuat database wajah...', 'text-cyan-500', true);
    dbStatus.textContent = 'LOADING...';
    dbStatus.classList.remove('text-green-500', 'text-red-500');
    dbStatus.classList.add('text-amber-500');
    logSystem('Database Sync Initiated.', 'text-cyan-500');
    
    try {
        const response = await fetch('/api/get_descriptors');
        const data = await response.json();

        if (!data.success || !data.descriptors || data.descriptors.length === 0) {
            setStatusVisual('⚠️ Database Kosong/Error. Hanya Deteksi Wajah.', 'text-red-500');
            dbStatus.textContent = 'OFFLINE';
            dbStatus.classList.remove('text-amber-500');
            dbStatus.classList.add('text-red-500');
            logSystem('Database load failed/empty.', 'text-red-500');
            return [];
        }

        const descriptors = data.descriptors.map(item => {
            const descriptorData = JSON.parse(item.face_descriptor);
            const descriptorArray = Object.values(descriptorData).map(val => parseFloat(val));
            employeeMap[item.id_karyawan] = item.nama;
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        setStatusVisual(`${descriptors.length} ID Karyawan dimuat. Siap.`, 'text-green-500');
        dbStatus.textContent = 'ACTIVE';
        dbStatus.classList.remove('text-amber-500', 'text-red-500');
        dbStatus.classList.add('text-green-500');
        logSystem(`Database loaded: ${descriptors.length} records.`, 'text-green-500');
        return descriptors;

    } catch (error) {
        setStatusVisual(`❌ Error API Load: ${error.message}`, 'text-red-500');
        dbStatus.textContent = 'FAULT';
        dbStatus.classList.remove('text-amber-500');
        dbStatus.classList.add('text-red-500');
        logSystem(`Error loading database: ${error.message}`, 'text-red-500');
        return [];
    }
}

/** Inisialisasi model Face-API.js dan Kamera. */
async function initializeApp() {
    setStatusVisual('Booting Neural Engine...', 'text-cyan-500', true);
    logSystem('Application boot sequence initiated.', 'text-cyan-500');

    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        
        logSystem('Neural Network Models Loaded.', 'text-green-500');
        setStatusVisual('Models Loaded. Starting Camera...', 'text-cyan-500', true);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        cameraStatus.textContent = 'ACTIVE';
        cameraStatus.classList.add('text-green-500');
        logSystem('Camera Stream Established.', 'text-green-500');

    } catch (err) {
        setStatusVisual(`❌ Gagal Init: Kamera atau Model Error.`, 'text-red-500');
        cameraStatus.textContent = 'FAULT';
        cameraStatus.classList.remove('text-green-500');
        cameraStatus.classList.add('text-red-500');
        logSystem(`FATAL: Init failure. ${err.message}`, 'text-red-500');
    }
}

/** Event Listener ketika kamera mulai bermain */
video.addEventListener('play', async () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    faceapi.matchDimensions(canvas, { width: video.videoWidth, height: video.videoHeight });

    labeledDescriptors = await loadLabeledImages();

    userIdDisplay.textContent = 'MENUNGGU SCAN';
    userStatusDisplay.textContent = 'STANDBY';

    if (detectionInterval === null) {
        detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
        setStatusVisual('SYSTEM READY. SCANNING...', 'text-gray-300', true);
        logSystem('Scanning Loop Activated.', 'text-green-500');
    }
});

/** Fungsi Utama Deteksi dan Pengenalan Wajah */
async function detectFace() {
    if (isProcessing) return;
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params) return;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if(!isProcessing) videoContainer.classList.remove('scan-success');

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        drawHolographicMesh(context, landmarks);
        drawDataTags(context, box, landmarks);

        // Update status umum menjadi 'Detected'
        setStatusVisual('SUBJECT DETECTED. PROCESSING BIOMETRICS...', 'text-amber-500', true);


        if (labeledDescriptors && labeledDescriptors.length > 0) {
            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);

            const matchDistance = bestMatch.distance;
            // Hitung Confidence (Jarak 0.0 = 100%, Jarak FACE_MATCHING_THRESHOLD = 0%)
            const confidenceRaw = Math.max(0, FACE_MATCHING_THRESHOLD - matchDistance); 
            const confidence = (confidenceRaw / FACE_MATCHING_THRESHOLD) * 100;
            
            // NEW: Animasi Match Bar yang lebih smooth
            if(matchThresholdBar) {
                 matchThresholdBar.style.width = `${Math.min(100, confidence)}%`;
                 // Warna bar berubah tergantung Confidence Level
                 if (confidence >= 70) matchThresholdBar.style.background = '#00FF7F'; // Hijau
                 else if (confidence >= 40) matchThresholdBar.style.background = '#FFD700'; // Emas/Kuning
                 else matchThresholdBar.style.background = '#FF0055'; // Merah
            }

            if (bestMatch.label !== 'unknown' && matchDistance <= FACE_MATCHING_THRESHOLD) {
                // --- WAJAH DIKENALI ---
                const recognizedId = bestMatch.label;
                const recognizedName = employeeMap[recognizedId] || `ID:${recognizedId}`;

                userIdDisplay.textContent = recognizedName;
                userStatusDisplay.textContent = 'VERIFYING...';
                userStatusDisplay.classList.remove('text-red-500');
                userStatusDisplay.classList.add('text-amber-500');
                drawTechBracket(context, box.x, box.y, box.width, box.height, '#00FF7F');
                setStatusVisual(`ID MATCH: ${recognizedName}. AUTHORIZING...`, 'text-cyan-400', true);

                isProcessing = true;
                await processAttendance(recognizedId);

            } else {
                 // --- WAJAH TIDAK DIKENALI ---
                userIdDisplay.textContent = 'UNKNOWN SUBJECT';
                userStatusDisplay.textContent = 'DENIED';
                userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
                userStatusDisplay.classList.add('text-red-500');
                drawTechBracket(context, box.x, box.y, box.width, box.height, '#FF0055');
                setStatusVisual('SUBJECT NOT AUTHORIZED. IDENTITY DENIED.', 'text-red-500');
            }
        } else {
             // --- TIDAK ADA DESKRIPTOR/DB KOSONG ---
             userIdDisplay.textContent = 'FACE DETECTED';
             userStatusDisplay.textContent = 'DB OFFLINE';
             drawTechBracket(context, box.x, box.y, box.width, box.height, '#FF00FF');
             setStatusVisual('WARNING: NO BIOMETRIC DATABASE FOUND.', 'text-red-500');
        }

    } else {
        // --- TIDAK ADA WAJAH ---
        userIdDisplay.textContent = 'SCANNING...';
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        setStatusVisual('SYSTEM READY. SCANNING...', 'text-gray-300', true);
        if(matchThresholdBar) matchThresholdBar.style.width = '0%';
    }
}

// =============================================================================
// 4. PROSES ABSENSI (HANDLER)
// =============================================================================

/** Mengirim data absensi ke server dan menangani respons (termasuk cooldown). */
async function processAttendance(karyawanId) {
    setStatusVisual('CONNECTING TO SERVER...', 'text-cyan-500', true);
    logSystem(`Sending attendance request for ID: ${karyawanId}`, 'text-amber-500');

    try {
        const response = await fetch('/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });

        const result = await response.json();
        const serverTimestamp = new Date().toLocaleTimeString('id-ID');

        if (result.success) {
            // --- SUKSES (HIJAU) ---
            setStatusVisual(result.message, 'text-green-500');
            userStatusDisplay.textContent = 'AUTHORIZED';
            userStatusDisplay.classList.remove('text-amber-500', 'text-red-500');
            userStatusDisplay.classList.add('text-green-500');
            videoContainer.classList.add('scan-success'); // Efek border hijau

            // Tampilkan Overlay Sukses
            if(successOverlay) {
                overlayStatus.textContent = 'ACCESS GRANTED';
                overlayMessage.textContent = result.message.replace(/✅\s*/, '');
                overlayStatus.style.color = '#00FF7F';
                successOverlay.style.background = 'rgba(0, 150, 0, 0.8)';
                successOverlay.style.opacity = 1;
                setTimeout(() => successOverlay.style.opacity = 0, 3500);
            }

            userIdDisplay.textContent = result.karyawanName || employeeMap[karyawanId] || karyawanId;
            lastActionDisplay.textContent = serverTimestamp;
            logSystem(`Attendance successful: ${userIdDisplay.textContent}`, 'text-green-500');


        } else {
            // --- GAGAL / DENIED (MERAH) ---
            setStatusVisual(`❌ ${result.message}`, 'text-red-500');
            userStatusDisplay.textContent = 'ACCESS DENIED';
            userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
            userStatusDisplay.classList.add('text-red-500');
            videoContainer.classList.remove('scan-success');

            // Tampilkan Overlay Denied
            if(successOverlay) {
                overlayStatus.textContent = 'ACCESS DENIED';
                overlayMessage.textContent = result.message;
                overlayStatus.style.color = '#FF0055';
                successOverlay.style.background = 'rgba(150, 0, 0, 0.8)';
                successOverlay.style.opacity = 1;
                setTimeout(() => successOverlay.style.opacity = 0, 4500);
            }
            logSystem(`Attendance denied: ${result.message}`, 'text-red-500');
        }

        // --- COOLDOWN (JEDA 5 DETIK) ---
        await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
        setStatusVisual('❌ SYSTEM ERROR: CONNECTION OFFLINE', 'text-red-500');
        userStatusDisplay.textContent = 'NETWORK FAULT';
        logSystem(`FATAL: Connection Error to /absensi.`, 'text-red-500');
        await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
        // --- RESET SISTEM (Setelah Cooldown) ---
        isProcessing = false;
        videoContainer.classList.remove('scan-success');

        setStatusVisual('SYSTEM READY. SCANNING...', 'text-gray-300', true);
        userIdDisplay.textContent = 'SCANNING...';
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        logSystem('System Cooldown finished. Scanning resumed.', 'text-cyan-500');
    }
}

// Start
initializeApp();