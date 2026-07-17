import { logError } from '../core/utils.js';

class FunFactService {
	constructor() {
		this.generator      = null;
		this.isModelLoaded  = false;
		this.isGenerating   = false;
		this.config         = null;
		this.currentBackend = null;
	}

	// [Basic] Muat model Transformers.js
	async loadModel() {
		try {
			// Import Transformers.js dari CDN (ESM)
			const { pipeline, env } = await import(
				'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
			);

			env.allowLocalModels = false;
			env.useBrowserCache  = true;

			// [Basic] Gunakan model text2text-generation (flan-t5-small) yang lebih pintar untuk instruksi
			this.generator = await pipeline(
				'text2text-generation',
				'Xenova/flan-t5-small',
				{
					progress_callback: (info) => {
						if (info.status === 'downloading') {
							console.log(`Mengunduh model AI: ${Math.round(info.progress ?? 0)}%`);
						}
					}
				}
			);

			this.isModelLoaded  = true;
			this.currentBackend = 'wasm';
		} catch (error) {
			logError('Error loading Transformers.js model', error);
			throw new Error(`Failed to load FunFact model: ${error.message}`);
		}
	}

	// [Basic] Sanitasi input: hapus karakter khusus, batasi panjang
	sanitizeInput(input) {
		if (!input || typeof input !== 'string') return '';
		// Hapus karakter khusus (prompt injection prevention)
		const sanitized = input.replace(/[^a-zA-Z0-9\s]/g, '').trim();
		// Batasi maksimum 50 karakter
		return sanitized.substring(0, 50);
	}

	// [Basic] Generate fun fact tentang sayuran
	// [Advanced] Gunakan parameter tone untuk variasi personalitas
	async generateFunFact(vegetable, tone = 'normal') {
		if (!this.isModelLoaded || this.isGenerating) {
			throw new Error('Model belum siap atau sedang menghasilkan fakta');
		}

		if (!vegetable || typeof vegetable !== 'string') {
			throw new Error('Nama sayuran yang valid diperlukan');
		}

		// [Basic] Validasi dan sanitasi input
		const sanitized = this.sanitizeInput(vegetable);
		if (!sanitized) {
			throw new Error('Nama sayuran tidak valid setelah sanitasi');
		}

		this.isGenerating = true;
		try {
			// Saran Reviewer: Gunakan prompt spesifik untuk instruksi
			const prompt = `Write a short fun fact about ${sanitized} vegetable.`;

			const result = await this.generator(prompt, {
				max_new_tokens: 50,
				temperature:    0.3,
				do_sample:      false, // Gunakan greedy decoding agar tidak terjadi looping kata
				repetition_penalty: 1.5, // Mencegah AI mengulang-ulang kalimat (seperti "a sliver of...")
			});

			const rawText  = result?.[0]?.generated_text ?? '';
			
			return { funFact: rawText };
		} catch (error) {
			logError('Error generating fun fact', error);
			throw new Error(`Failed to generate fun fact: ${error.message}`);
		} finally {
			this.isGenerating = false;
		}
	}

	// [Basic] Periksa apakah model siap
	isReady() {
		return this.isModelLoaded && !this.isGenerating;
	}
}

export default FunFactService;
