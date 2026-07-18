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
				'Xenova/LaMini-Flan-T5-77M',
				{
					dtype: 'q4',
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
		const sanitized = input.replace(/[^a-zA-Z0-9\s]/g, '').trim();
		return sanitized.substring(0, 50);
	}

	getPromptTemplates() {
		return {
			normal: (vegetable) =>
				`${vegetable} is a vegetable that people eat for nutrition and health. ` +
				`Give one fact about ${vegetable} as a food or vegetable. ` +
				`Only discuss ${vegetable} as a vegetable.`,
			funny: (vegetable) =>
				`${vegetable} is a vegetable used in cooking. ` +
				`Give one surprising or fun fact about ${vegetable} as a food. ` +
				`Only discuss ${vegetable} as a vegetable.`,
			professional: (vegetable) =>
				`${vegetable} is a vegetable with nutritional value. ` +
				`Give one fact about ${vegetable} nutrition or health benefit. ` +
				`Only discuss ${vegetable} as a vegetable.`,
			casual: (vegetable) =>
				`${vegetable} is a vegetable used in meals. ` +
				`Give one cooking tip about ${vegetable}. ` +
				`Only discuss ${vegetable} as a vegetable.`
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
				max_new_tokens: 60,
				temperature: 0.3,
				do_sample: true,
				top_p: 0.85,
				repetition_penalty: 1.3
			});

			let factText = result?.[0]?.generated_text ?? '';

			// Bersihkan output dari prompt yang mungkin bocor
			factText = factText.replace(/^[\s:]+/, '').trim();

			// Validasi: pastikan fakta menyebutkan nama sayuran
			const vegLower = sanitized.toLowerCase();
			if (!factText.toLowerCase().includes(vegLower)) {
				factText = `${sanitized} is a healthy vegetable that provides vitamins and minerals.`;
			}

			// Validasi: pastikan tidak ada kata tidak relevan
			const irrelevantKeywords = [
				'population', 'people', 'human', 'society', 'census',
				'demographic', 'economic', 'gdp', 'birth rate', 'mortality'
			];
			const hasIrrelevant = irrelevantKeywords.some(kw =>
				factText.toLowerCase().includes(kw)
			);
			if (hasIrrelevant) {
				factText = `${sanitized} is a nutritious vegetable known for its health benefits.`;
			}

			return { funFact: factText };
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