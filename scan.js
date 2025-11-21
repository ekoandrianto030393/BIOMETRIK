// scan.js - FIX VERSION (Original Logic + Advanced Visuals)

const video = document.getElementById('videoElement');
const statusMessage = document.getElementById('statusMessage');
const clock = document.getElementById('clock');
const canvas = document.getElementById('overlay');

// --- Global Vars ---
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
const DETECTION_INTERVAL_MS = 100; // 10 FPS untuk animasi halus

// =============================================================================
// 1. MESIN RENDERING VISUAL BARU (HUD CANGGIH)
// =============================================================================

function drawTechBracket(ctx, x, y, w, h, color) {
    const lineLen = w / 5; 
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;

    // Gambar 4 Sudut
    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w, y + h - lineLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - lineLen, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + lineLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - lineLen); ctx.stroke();
    
    ctx.shadowBlur = 0; 
}

function drawHolographicMesh(ctx, landmarks) {
    const points = landmarks.positions;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; 
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)'; 

    // Definisi area wajah
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

    // Titik Node
    ctx.fillStyle = '#00FF7F'; 
    points.forEach((pt, i) => {
        if (i % 2 === 0) { 
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI); ctx.fill();
        }
    });
}

function drawDataTags(ctx, box, landmarks) {
    const tagX = box.right + 20;
    let tagY = box.top + 10;
    const fontSize = 12;
    
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'left';

    // Hitung kemiringan wajah
    const nose = landmarks.getNose()[0];
    const jaw = landmarks.getJawOutline()[8];
    const tilt = (nose.x - jaw.x).toFixed(2); 
    
    const dataLines = [
        { text: `ID_SIG: ${Math.floor(Math.random() * 99999)}`, color: '#00FFFF' },
        { text: `DIST: ${(1000 / box.width).toFixed(2)}m`, color: '#00FFFF' },
        { text: `AXIS: ${tilt}`, color: '#00FF7F' },
        { text: `SYNC: ACTIVE`, color: '#FF00FF' }
    ];

    // Garis penghubung
    ctx.beginPath(); ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.moveTo(box.right, box.top); ctx.lineTo(tagX - 10, box.top); ctx.stroke();

    dataLines.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, tagX, tagY + (i * 18));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(tagX - 8, tagY + (i * 18) - 8, 2, 10);
    });
}

// =============================================================================
// 2. FUNGSI UTILITAS (ASLI ANDA)
// =============================================================================

setInterval(() => {
    if(clock) clock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

function updateDataStream() {
    if(!dataStream) return;
    const chars = '01FfAaBbCcDdEe987654321';
    let result = '';
    for (let i = 0; i < 20; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    const timestamp = new Date().toLocaleTimeString('en-US', {hour12: false, second: '2-digit'});
    
    dataStream.innerHTML = `<p class="my-0.5 text-cyan-700">${timestamp}: <span class="text-amber-500">${result}</span></p>` + dataStream.innerHTML;
    if (dataStream.children.length > 8) dataStream.removeChild(dataStream.lastChild);
}

function updateGraph() {
    if(!graphElement) return;
    const barHeight = Math.floor(Math.random() * 90) + 5;
    const bar = document.createElement('div');
    bar.className = 'graph-bar';
    bar.style.height = `${barHeight}%`;
    bar.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
    graphElement.appendChild(bar);
    if (graphElement.children.length > 30) graphElement.removeChild(graphElement.firstChild);
}
setInterval(updateDataStream, 50); 
setInterval(updateGraph, 300);    

// =============================================================================
// 3. LOGIKA SISTEM & API
// =============================================================================

// Muat Data Wajah (FUNGSI ASLI ANDA)
async function loadLabeledImages() {
    statusMessage.textContent = 'Memuat database wajah...';
    try {
        const response = await fetch('/api/get_descriptors'); 
        const data = await response.json();
        
        if (!data.success || data.descriptors.length === 0) {
            statusMessage.textContent = '⚠️ Database Kosong/Error.';
            return null;
        }
        
        const descriptors = data.descriptors.map(item => {
            const descriptorArray = Object.values(JSON.parse(item.face_descriptor)).map(val => parseFloat(val));
            employeeMap[item.id_karyawan] = item.nama; 
            return new faceapi.LabeledFaceDescriptors(item.id_karyawan, [new Float32Array(descriptorArray)]);
        });

        statusMessage.textContent = `${descriptors.length} ID dimuat. Siap.`;
        return descriptors;

    } catch (error) {
        statusMessage.textContent = `❌ Error API: ${error.message}`;
        return null;
    }
}

// Inisialisasi (FUNGSI ASLI ANDA)
async function initializeApp() {
    statusMessage.textContent = 'Booting Neural Engine...';
    try {
        // Pastikan path model benar. Jika di root folder, gunakan './models'
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models')
        ]);
        
        statusMessage.textContent = 'Kamera initializing...';
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
    } catch (err) {
        statusMessage.textContent = `❌ Gagal Init: ${err.message}`;
        console.error(err);
    }
}

// Event Listener Video
video.addEventListener('play', async () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    labeledDescriptors = await loadLabeledImages();
    
    userIdDisplay.textContent = 'MENUNGGU SCAN';
    userStatusDisplay.textContent = 'LOCKED';
    userStatusDisplay.classList.add('text-red-500');

    if (detectionInterval === null) {
        detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
    }
});

// =============================================================================
// 4. DETEKSI WAJAH (MODIFIKASI VISUAL)
// =============================================================================

async function detectFace() {
    // Cek apakah video sudah siap
    if (video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params) return;
    if (isProcessing) return; 

    // Load descriptors jika belum ada
    if (!labeledDescriptors) {
        // Jangan panggil loadLabeledImages terus menerus jika gagal sekali
        // Biarkan user merefresh atau coba lagi nanti
        return;
    }
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    const context = canvas.getContext('2d');
    
    // Pastikan canvas bersih
    context.clearRect(0, 0, canvas.width, canvas.height); 

    // Deteksi
    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    videoContainer.classList.remove('scan-success'); 

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const { box } = resizedDetections.detection;
        const { landmarks } = resizedDetections;

        // --- 1. GAMBAR MESH WAJAH ---
        drawHolographicMesh(context, landmarks);
        
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCHING_THRESHOLD);
        const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
        
        // Animasi bar confidence
        const matchDistance = bestMatch.distance;
        const confidence = Math.max(0, (FACE_MATCHING_THRESHOLD - matchDistance) / FACE_MATCHING_THRESHOLD) * 100;
        if(matchThresholdBar) matchThresholdBar.style.width = `${Math.max(10, Math.min(100, confidence))}%`;
        
        if (bestMatch.label !== 'unknown') {
            const recognizedId = bestMatch.label;
            const recognizedName = employeeMap[recognizedId] || recognizedId;
            
            userIdDisplay.textContent = recognizedName; 
            userStatusDisplay.textContent = 'VERIFYING...'; 
            userStatusDisplay.classList.remove('text-red-500');
            userStatusDisplay.classList.add('text-amber-500'); 
            
            // --- 2. GAMBAR BRACKET HIJAU (Dikenali) ---
            drawTechBracket(context, box.x, box.y, box.width, box.height, '#00FF7F'); 
            drawDataTags(context, box, landmarks);

            // Stop deteksi & Proses Absensi
            clearInterval(detectionInterval); 
            detectionInterval = null; 
            
            statusMessage.textContent = `ID MATCH: ${recognizedName}`;
            await processAttendance(recognizedId);

        } else {
            // Wajah tidak dikenal
            userIdDisplay.textContent = 'UNKNOWN'; 
            userStatusDisplay.textContent = 'DENIED'; 
            userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
            userStatusDisplay.classList.add('text-red-500');
            
            // --- 2. GAMBAR BRACKET MERAH (Tidak Dikenali) ---
            drawTechBracket(context, box.x, box.y, box.width, box.height, '#FF0055'); 
            drawDataTags(context, box, landmarks);
            
            statusMessage.textContent = 'UNKNOWN SUBJECT DETECTED';
        }
    } else {
        // Tidak ada wajah
        userIdDisplay.textContent = 'SCANNING...';
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        statusMessage.textContent = 'SEARCHING FOR BIOMETRIC DATA...';
        if(matchThresholdBar) matchThresholdBar.style.width = '0%';
    }
}

// =============================================================================
// 5. PROSES ABSENSI (FUNGSI ASLI ANDA)
// =============================================================================

async function processAttendance(karyawanId) {
    isProcessing = true; 
    statusMessage.innerHTML = 'UPLOADING DATA...';

    try {
        const response = await fetch('/absensi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan: karyawanId })
        });

        const result = await response.json();
        
        if (result.statusColor === 'red') {
            // GAGAL
            statusMessage.innerHTML = `❌ ${result.message}`;
            userStatusDisplay.textContent = 'ACCESS DENIED';
            
            if(successOverlay) {
                overlayStatus.textContent = 'ACCESS DENIED';
                overlayMessage.textContent = result.message;
                successOverlay.style.background = 'rgba(150, 0, 0, 0.9)'; 
                successOverlay.style.opacity = 1;
                setTimeout(() => successOverlay.style.opacity = 0, 3000);
            }
            
        } else {
            // SUKSES
            if(successOverlay) {
                overlayStatus.textContent = 'ACCESS GRANTED'; 
                overlayMessage.textContent = result.message.replace('✅ ', ''); 
                successOverlay.style.background = 'rgba(0, 150, 0, 0.9)'; 
                successOverlay.style.opacity = 1;
                setTimeout(() => successOverlay.style.opacity = 0, 3000);
            }
            
            statusMessage.innerHTML = result.message;
            userStatusDisplay.textContent = 'AUTHORIZED'; 
            userStatusDisplay.classList.add('text-green-500');
            
            // Efek Visual Sukses di Container Video
            videoContainer.classList.add('scan-success');

            if (result.karyawanName) {
                userIdDisplay.textContent = result.karyawanName;
                lastActionDisplay.textContent = new Date().toLocaleTimeString('id-ID');
            }
        }
        
        const cooldownTime = result.success ? 7000 : 5000; 
        await new Promise(resolve => setTimeout(resolve, cooldownTime));

    } catch (error) {
        statusMessage.innerHTML = '❌ CONNECTION ERROR';
        userIdDisplay.textContent = 'NET_ERR'; 
        await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
        isProcessing = false; 
        videoContainer.classList.remove('scan-success'); 
        
        statusMessage.innerHTML = 'SYSTEM READY. SCANNING...';
        userIdDisplay.textContent = 'SCANNING...';
        userStatusDisplay.textContent = 'LOCKED';
        userStatusDisplay.classList.remove('text-green-500', 'text-amber-500');
        userStatusDisplay.classList.add('text-red-500');
        
        if (detectionInterval === null) { 
            detectionInterval = setInterval(detectFace, DETECTION_INTERVAL_MS);
        }
    }
}

// Mulai Sistem
initializeApp();