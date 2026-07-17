import { logError, validateModelMetadata } from '../core/utils.js';

class DetectionService {
	constructor() {
		this.model  = null;
		this.labels = [];
		this.config = null;
	}

	async loadModel() {
		try {
			const metaResp = await fetch('/model/metadata.json');
			if (!metaResp.ok) throw new Error('metadata.json tidak ditemukan');
			const metadata = await metaResp.json();

			if (!validateModelMetadata(metadata)) {
				throw new Error('Metadata model tidak valid');
			}
			this.labels = metadata.labels;

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

	async predict(imageElement) {
		let tensor = null;
		try {
			tensor = tf.browser.fromPixels(imageElement);
			const predictions = await this.model.predict(imageElement);

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
			if (tensor) tensor.dispose();
		}
	}

	isLoaded() {
		return this.model !== null;
	}
}

export default DetectionService;
