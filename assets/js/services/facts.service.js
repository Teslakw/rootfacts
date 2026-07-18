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

	getVegetableHint(vegetable) {
		const hints = {
			beetroot: 'dark red root, rich in nitrates, used for borscht soup',
			paprika: 'colorful bell pepper, high in vitamin C, used in salads',
			cabbage: 'leafy green head, rich in vitamin K, used for coleslaw and kimchi',
			carrot: 'orange root, rich in beta-carotene and vitamin A, good for eyesight',
			cauliflower: 'white floret head, rich in choline, low-carb rice substitute',
			chilli: 'spicy hot pepper, contains capsaicin, boosts metabolism',
			corn: 'yellow kernels on a cob, rich in fiber, used for popcorn and tortillas',
			cucumber: 'green and hydrating, 95% water content, used in salads and pickles',
			eggplant: 'purple skin, contains nasunin antioxidant, used in ratatouille',
			garlic: 'pungent bulb, contains allicin, natural antibiotic properties',
			ginger: 'spicy rhizome root, contains gingerol, relieves nausea',
			lettuce: 'crispy leafy green, low calorie, base for salads and wraps',
			onion: 'layered bulb, rich in quercetin, makes you cry when cut',
			peas: 'small green pods, high in plant protein, sweet taste',
			potato: 'starchy tuber, rich in potassium, most consumed vegetable worldwide',
			turnip: 'white root vegetable, rich in glucosinolates, peppery taste',
			soybean: 'protein-rich legume, source of tofu and soy milk, contains isoflavones',
			spinach: 'dark leafy green, very rich in iron, famously eaten by Popeye'
		};
		return hints[vegetable.toLowerCase()] || 'nutritious vegetable with health benefits';
	}

	getPromptTemplates() {
		return {
			normal: (vegetable, hint) =>
				`${vegetable} is a vegetable (${hint}). ` +
				`Explain why ${vegetable} is good for health.`,
			funny: (vegetable, hint) =>
				`${vegetable} is a vegetable (${hint}). ` +
				`Tell one weird or surprising thing about ${vegetable}.`,
			professional: (vegetable, hint) =>
				`${vegetable} is a vegetable (${hint}). ` +
				`What specific nutrient makes ${vegetable} special?`,
			casual: (vegetable, hint) =>
				`${vegetable} is a vegetable (${hint}). ` +
				`How do people usually cook or eat ${vegetable}?`
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
			const hint = this.getVegetableHint(sanitized);
			const templates = this.getPromptTemplates();
			const promptGenerator = templates[tone] || templates['normal'];
			const prompt = promptGenerator(sanitized, hint);

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