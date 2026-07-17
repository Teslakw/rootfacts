import UIHandler from '../ui/ui.handler.js';
import { APP_CONFIG } from './config.js';
import { logError, createDelay, isValidDetection } from './utils.js';
import CameraService   from '../services/camera.service.js';
import DetectionService from '../services/detection.service.js';
import FunFactService  from '../services/facts.service.js';

class RootFactsApp {
	constructor() {
		this.detector         = null;
		this.camera           = null;
		this.funFactGenerator = null;
		this.ui               = new UIHandler();
		this.isRunning        = false;
		this.currentLoopId    = null;
		this.config           = APP_CONFIG;
		this.currentFunFact   = '';
		this.currentFPS       = 30;

		this.ui.disableButton();

		this.bindEvents();
		this.init();

		// [Basic] Daftarkan Service Worker
		this.registerServiceWorker();
	}

	// [Basic] Bind semua event listener
	bindEvents() {
		this.ui.bindEvents({
			onToggleCamera: () => this.toggleCamera(),
			onCameraChange: () => {
				if (this.isRunning) {
					this.stopCamera();
					this.startCamera();
				}
			},
			// [Skilled] FPS change
			onFPSChange: (fps) => {
				this.currentFPS = fps;
				if (this.camera) this.camera.setFPS(fps);
			},
			// [Skilled] Copy fun fact
			onCopy: () => this.copyFunFact(),
		});
	}

	// [Basic] Inisialisasi aplikasi
	async init() {
		try {
			this.ui.updateHeaderStatus('Memuat model...', false);

			// Inisialisasi services
			this.camera           = new CameraService();
			this.detector         = new DetectionService();
			this.funFactGenerator = new FunFactService();

			// Muat kedua model secara paralel
			await Promise.all([
				this.detector.loadModel(),
				this.funFactGenerator.loadModel(),
			]);

			this.ui.updateHeaderStatus('Siap', false);
			this.ui.enableButton();
		} catch (error) {
			logError('Gagal menginisialisasi aplikasi', error);
			this.ui.updateHeaderStatus('Error', false);
			this.ui.showError(`Gagal menginisialisasi: ${error.message}`);
			this.ui.disableButton();
		}
	}

	// [Basic] Daftarkan Service Worker
	async registerServiceWorker() {
		if ('serviceWorker' in navigator) {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js');
				console.log('✅ Service Worker terdaftar:', registration.scope);
			} catch (error) {
				logError('Gagal mendaftarkan Service Worker', error);
			}
		}
	}

	// [Skilled] Salin fun fact ke clipboard
	async copyFunFact() {
		const text = this.ui.getFunFactText();
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			this.ui.setCopyButtonCopied();
			setTimeout(() => this.ui.resetCopyButton(), 2000);
		} catch (error) {
			logError('Gagal menyalin ke clipboard', error);
		}
	}

	// [Basic] Toggle kamera aktif/nonaktif
	toggleCamera() {
		if (this.isRunning) {
			this.stopDetection();
			this.stopCamera();
			this.ui.updateCameraUI(false);
			this.ui.switchToState('idle');
		} else {
			this.startCamera();
		}
	}

	// [Basic] Mulai kamera
	async startCamera() {
		try {
			await this.camera.startCamera();
			this.ui.updateCameraUI(true);
			this.startDetection();
		} catch (error) {
			logError('Gagal memulai kamera', error);
			this.ui.showError(error.message);
		}
	}

	// [Basic] Hentikan kamera
	stopCamera() {
		if (this.camera) this.camera.stopCamera();
	}

	// [Basic] Mulai loop deteksi
	startDetection() {
		this.isRunning     = true;
		const loopId       = Symbol();
		this.currentLoopId = loopId;
		this.detectLoop(loopId);
	}

	// [Basic] Hentikan deteksi
	stopDetection() {
		this.isRunning     = false;
		this.currentLoopId = null;
	}

	// [Basic] Loop deteksi utama
	async detectLoop(loopId) {
		while (this.isRunning && this.currentLoopId === loopId) {
			const video = document.getElementById('videoElement');
			if (video && video.readyState >= 2 && this.detector.isLoaded()) {
				try {
					const result = await this.detector.predict(video);

					if (isValidDetection(result)) {
						// Tampilkan state loading sebentar
						this.ui.switchToState('loading');
						await createDelay(this.config.analyzingDelay);

						// Jika masih running dan loopId sama, tampilkan hasil
						if (this.isRunning && this.currentLoopId === loopId) {
							const success = await this.generateAndShowResults(result);
							if (success) {
								// ✅ Setelah fun fact tampil → stop deteksi
								// User harus tekan tombol lagi untuk scan baru
								this.stopDetection();
								this.stopCamera();
								this.ui.updateCameraUI(false);
								break;
							}
						}
					}
				} catch (error) {
					logError('Error saat deteksi', error);
				}
			}

			// Tunggu sebelum deteksi berikutnya
			await createDelay(this.config.detectionRetryInterval);
		}
	}

	// [Basic] Generate dan tampilkan fun fact
	// Returns true jika berhasil, false jika error
	async generateAndShowResults(detectionResult) {
		try {
			// Tampilkan hasil deteksi dulu (fun fact loading)
			this.ui.showResults(detectionResult, null);

			// Generate fun fact
			this.ui.updateFunFactState('loading');
			const funFactData = await this.funFactGenerator.generateFunFact(
				detectionResult.className
			);

			// Tampilkan fun fact
			this.ui.updateFunFactState('success', funFactData);
			this.currentFunFact = funFactData.funFact;
			return true; // ✅ berhasil
		} catch (error) {
			logError('Gagal menampilkan hasil', error);
			this.ui.updateFunFactState('error');
			return false; // ❌ gagal
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const app = new RootFactsApp();

	if (typeof lucide !== 'undefined') {
		lucide.createIcons();
	}
});

export default RootFactsApp;
