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
		// Hapus karakter khusus (prompt injection prevention)
		const sanitized = input.replace(/[^a-zA-Z0-9\s]/g, '').trim();
		// Batasi maksimum 50 karakter
		return sanitized.substring(0, 50);
	}

	getPromptTemplates() {
		return {
			normal: (vegetable) =>
				`You are a vegetable expert. Answer ONLY about the vegetable "${vegetable}". ` +
				`Give one interesting fact about ${vegetable} as a vegetable, such as its nutrition, origin, or health benefit. ` +
				`Do NOT talk about anything unrelated to ${vegetable}. ` +
				`Fact about ${vegetable}:`,
			funny: (vegetable) =>
				`You are a vegetable expert. Answer ONLY about the vegetable "${vegetable}". ` +
				`Give one surprising or funny fact about ${vegetable} as a vegetable. ` +
				`Do NOT talk about anything unrelated to ${vegetable}. ` +
				`Funny fact about ${vegetable}:`,
			professional: (vegetable) =>
				`You are a vegetable nutrition expert. Answer ONLY about the vegetable "${vegetable}". ` +
				`What key nutrient or vitamin is ${vegetable} most known for? Focus on health benefits of ${vegetable}. ` +
				`Do NOT talk about anything unrelated to ${vegetable}. ` +
				`Nutrient fact about ${vegetable}:`,
			casual: (vegetable) =>
				`You are a vegetable expert. Answer ONLY about the vegetable "${vegetable}". ` +
				`How is ${vegetable} commonly used in cooking? Give a simple cooking tip about ${vegetable}. ` +
				`Do NOT talk about anything unrelated to ${vegetable}. ` +
				`Cooking tip about ${vegetable}:`
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
				max_new_tokens: 80,
				temperature: 0.3,
				do_sample: true,
				top_p: 0.85,
				repetition_penalty: 1.3,
				num_beams: 1
			});

			let factText = result?.[0]?.generated_text ?? '';

			// Bersihkan output dari prompt yang mungkin bocor
			factText = factText.replace(/^[\s:]+/, '').trim();

			// Validasi ketat: pastikan fakta menyebutkan nama sayuran
			const vegLower = sanitized.toLowerCase();
			if (!factText.toLowerCase().includes(vegLower)) {
				// Jika AI berhalusinasi total, buat fakta manual berbasis fakta umum sayuran
				factText = `${sanitized} is a healthy vegetable that contains important vitamins and minerals for your body.`;
			}

			// Validasi: pastikan tidak ada kata-kata yang tidak relevan (populasi, manusia, dll)
			const irrelevantKeywords = ['population', 'people', 'human', 'society', 'world population', 'census', 'demographic'];
			const hasIrrelevant = irrelevantKeywords.some(kw => factText.toLowerCase().includes(kw));
			if (hasIrrelevant) {
				factText = `${sanitized} is a nutritious vegetable known for its health benefits and culinary versatility.`;
			}

			// Tambahkan prefix berdasarkan tone
			if (tone === 'funny') {
				factText = `Here is a funny thought! 😂 ${factText}`;
			} else if (tone === 'casual') {
				factText = `Hey there! 🥦 Just a casual fact: ${factText}`;
			} else if (tone === 'professional') {
				factText = `Botanical Analysis 🔬: ${factText}`;
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
