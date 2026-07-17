import {
	getCameraErrorMessage,
	logError
} from '../core/utils.js';

class CameraService {
	constructor() {
		this.stream = null;
		this.video = null;
		this.canvas = null;
		this.config = null;
		this.facingMode = 'environment'; // default kamera belakang

		this.initializeElements();
		this.init();
	}

	initializeElements() {
		this.video  = document.getElementById('videoElement');
		this.canvas = document.getElementById('canvasElement');
	}

	async init() {
		await this.loadCameras();
	}

	async loadCameras() {
		try {
			// Minta izin kamera agar enumerateDevices mengembalikan label
			const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
			tempStream.getTracks().forEach(t => t.stop());

			const devices = await navigator.mediaDevices.enumerateDevices();
			const videoDevices = devices.filter(d => d.kind === 'videoinput');

			const select = document.getElementById('camera-select');
			if (select && videoDevices.length > 0) {
				select.innerHTML = '';
				videoDevices.forEach((device, i) => {
					const option = document.createElement('option');
					option.value = device.deviceId;
					option.textContent = device.label || `Kamera ${i + 1}`;
					select.appendChild(option);
				});
			}
		} catch (error) {
			logError('Gagal memuat kamera', error);
			// Tidak throw — fallback ke default constraints saja
		}
	}

	async startCamera() {
		try {
			if (this.stream) this.stopCamera();

			const select = document.getElementById('camera-select');
			const deviceId = select?.value;

			const constraints = {
				video: deviceId
					? { deviceId: { exact: deviceId } }
					: { facingMode: { ideal: this.facingMode } }
			};

			this.stream = await navigator.mediaDevices.getUserMedia(constraints);
			if (this.video) {
				this.video.srcObject = this.stream;
				await this.video.play();
			}
		} catch (error) {
			logError('Gagal memulai kamera', error);
			const errorMessage = getCameraErrorMessage(error);
			throw new Error(errorMessage);
		}
	}

	stopCamera() {
		if (this.stream) {
			this.stream.getTracks().forEach(track => track.stop());
			this.stream = null;
		}
		if (this.video) {
			this.video.srcObject = null;
		}
	}

	setFPS(fps) {
		if (this.stream) {
			this.stream.getVideoTracks().forEach(track => {
				track.applyConstraints({ frameRate: fps });
			});
		}
	}

	isActive() {
		return this.stream !== null && this.stream.active;
	}

	isReady() {
		return this.video !== null && this.isActive();
	}
}

export default CameraService;
