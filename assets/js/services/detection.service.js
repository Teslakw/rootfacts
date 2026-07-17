import { logError, validateModelMetadata } from '../core/utils.js';

class DetectionService {
	constructor() {
		this.model  = null;
		this.labels = [];
		this.config = null;
	}

	// [Basic] Muat model TensorFlow.js (Teachable Machine Dicoding)
	async loadModel() {
		try {
			// Ambil dan validasi metadata model
			const metaResp = await fetch('/model/metadata.json');
			if (!metaResp.ok) throw new Error('metadata.json tidak ditemukan');
			const metadata = await metaResp.json();

			if (!validateModelMetadata(metadata)) {
				throw new Error('Metadata model tidak valid');
			}
			this.labels = metadata.labels;

			// Muat model Teachable Machine (tmImage global dari CDN)
			await tf.setBackend('webgl');
			await tf.ready();
			this.model = await tmImage.load(
				'/model/model.json',
				'/model/metadata.json'
			);
		} catch (error) {
			logError('Failed to load model', error);
			throw new Error(`Failed to load model: ${error.message}`);
		}
	}

	// [Basic] Prediksi pada elemen gambar/video
	async predict(imageElement) {
		let tensor = null;
		try {
			// Buat tensor eksplisit untuk manajemen memori
			tensor = tf.browser.fromPixels(imageElement);
			const predictions = await this.model.predict(imageElement);

			// Kembalikan dalam format { className, confidence, isValid }
			const confidenceThreshold = 70;
			const sorted = predictions
				.map(p => ({
					className:  p.className,
					confidence: Math.round(p.probability * 100),
					isValid:    Math.round(p.probability * 100) >= confidenceThreshold,
				}))
				.sort((a, b) => b.confidence - a.confidence);

			return sorted[0]; // Kembalikan prediksi terbaik
		} catch (error) {
			logError('Prediction error', error);
			throw new Error(`Prediksi gagal: ${error.message}`);
		} finally {
			// [Basic] Dispose tensor untuk menghindari memory leak
			if (tensor) tensor.dispose();
		}
	}

	// [Basic] Periksa apakah model sudah dimuat
	isLoaded() {
		return this.model !== null;
	}
}

export default DetectionService;
