import { logError } from '../core/utils.js';

class FunFactService {
	constructor() {
		this.generator      = null;
		this.isModelLoaded  = false;
		this.isGenerating   = false;
		this.config         = null;
		this.currentBackend = null;
	}

	async loadModel() {
		try {
			const { pipeline, env } = await import(
				'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
			);

			env.allowLocalModels = false;
			env.useBrowserCache  = true;

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

	sanitizeInput(input) {
		if (!input || typeof input !== 'string') return '';
		// Hapus karakter khusus (prompt injection prevention)
		const sanitized = input.replace(/[^a-zA-Z0-9\s]/g, '').trim();
		// Batasi maksimum 50 karakter
		return sanitized.substring(0, 50);
	}

	getPromptTemplates() {
		return {
			normal: (vegetable) => `Write a short, interesting fun fact about the vegetable ${vegetable} in one sentence.`,
			funny: (vegetable) => `Write a hilarious and funny fun fact about the vegetable ${vegetable} that will make someone laugh. Keep it to one sentence.`,
			professional: (vegetable) => `Provide an educational and scientifically accurate fun fact about the vegetable ${vegetable} in one sentence.`,
			casual: (vegetable) => `Hey! Give me a cool and casual fun fact about the vegetable ${vegetable} in one sentence.`
		};
	}

	async generateFunFact(vegetable, tone = 'normal') {
		if (!this.isModelLoaded || this.isGenerating) {
			throw new Error('Model belum siap atau sedang menghasilkan fakta');
		}

		if (!vegetable || typeof vegetable !== 'string') {
			throw new Error('Nama sayuran yang valid diperlukan');
		}

		const sanitized = this.sanitizeInput(vegetable);
		if (!sanitized) {
			throw new Error('Nama sayuran tidak valid setelah sanitasi');
		}

		this.isGenerating = true;
		try {
			const templates = this.getPromptTemplates();
			const promptGenerator = templates[tone] || templates['normal'];
			const prompt = promptGenerator(sanitized);

			const result = await this.generator(prompt, {
				max_new_tokens: 50,
				temperature:    0.6,
				do_sample:      true,
				repetition_penalty: 1.8,
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

	isReady() {
		return this.isModelLoaded && !this.isGenerating;
	}
}

export default FunFactService;
