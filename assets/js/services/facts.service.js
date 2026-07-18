import { logError } from '../core/utils.js';

const VEGETABLE_CONTEXT = {
	Beetroot: "Beetroot is a dark red root vegetable, rich in nitrates and folate.",
	Paprika: "Paprika is a colorful fruit vegetable, high in vitamin C and vitamin A.",
	Cabbage: "Cabbage is a leafy green or purple vegetable, rich in vitamin K and fiber.",
	Carrot: "Carrot is an orange root vegetable, rich in beta-carotene and vitamin A.",
	Cauliflower: "Cauliflower is a white head vegetable, rich in choline and vitamin C.",
	Chilli: "Chilli is a spicy pepper vegetable, rich in capsaicin and vitamin C.",
	Corn: "Corn is a yellow grain vegetable, rich in fiber and antioxidants.",
	Cucumber: "Cucumber is a green hydrating vegetable, rich in water and vitamin K.",
	eggplant: "Eggplant is a purple fruit vegetable, rich in nasunin and fiber.",
	Garlic: "Garlic is a pungent bulb vegetable, rich in allicin and manganese.",
	Ginger: "Ginger is a spicy root vegetable, rich in gingerol and antioxidants.",
	Lettuce: "Lettuce is a leafy green vegetable, rich in vitamin K and folate.",
	Onion: "Onion is a pungent bulb vegetable, rich in quercetin and fiber.",
	Peas: "Peas are small green legume vegetables, rich in protein and fiber.",
	Potato: "Potato is a starchy tuber vegetable, rich in potassium and vitamin C.",
	Turnip: "Turnip is a white root vegetable, rich in vitamin C and glucosinolates.",
	Soybean: "Soybean is a protein-rich legume vegetable, rich in isoflavones.",
	Spinach: "Spinach is a dark leafy vegetable, rich in iron and vitamin K."
};

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

	buildContext(vegetable) {
		const key = Object.keys(VEGETABLE_CONTEXT).find(
			k => k.toLowerCase() === vegetable.toLowerCase()
		);
		if (key) {
			return VEGETABLE_CONTEXT[key];
		}
		return `${vegetable} is a healthy vegetable rich in vitamins and minerals.`;
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
			const context = this.buildContext(sanitized);

			const toneInstructions = {
				normal: "Give one interesting and accurate fact about this vegetable. Focus on nutrition, origin, or health benefit.",
				funny: "Give one surprising or fun fact about this vegetable. Keep it light and entertaining.",
				professional: "Give one scientific or nutritional fact about this vegetable. Focus on vitamins, minerals, or health effects.",
				casual: "Give one simple cooking tip or common use for this vegetable in meals."
			};

			const instruction = toneInstructions[tone] || toneInstructions['normal'];

			const prompt = `Context: ${context}\n` +
				`Task: ${instruction}\n` +
				`Rules:\n` +
				`- You must ONLY discuss the vegetable ${sanitized}\n` +
				`- Do NOT discuss population, people, society, economy, or any topic unrelated to ${sanitized}\n` +
				`- Do NOT make up information about topics other than this vegetable\n` +
				`Fact about ${sanitized} as a vegetable:`;

			const result = await this.generator(prompt, {
				max_new_tokens: 80,
				temperature: 0.3,
				do_sample: true,
				top_p: 0.85,
				repetition_penalty: 1.3
			});

			let factText = result?.[0]?.generated_text ?? '';

			// Bersihkan output
			factText = factText.replace(/^[\s:]+/, '').trim();

			// Validasi 1: pastikan fakta menyebutkan nama sayuran
			const vegLower = sanitized.toLowerCase();
			const mentionsVegetable = factText.toLowerCase().includes(vegLower);

			// Validasi 2: pastikan tidak ada kata tidak relevan
			const irrelevantKeywords = [
				'population', 'people', 'human', 'society', 'world population',
				'census', 'demographic', 'economic', 'gdp', 'birth rate',
				'death rate', 'life expectancy', 'mortality'
			];
			const hasIrrelevant = irrelevantKeywords.some(kw =>
				factText.toLowerCase().includes(kw)
			);

			// Validasi 3: pastikan minimal 20 karakter
			const isLongEnough = factText.length >= 20;

			// Jika validasi gagal, coba generate ulang dengan prompt lebih ketat
			if (!mentionsVegetable || hasIrrelevant || !isLongEnough) {
				const retryPrompt = `Write one sentence about ${sanitized} vegetable. ` +
					`Only mention ${sanitized}. No other topic. ` +
					`${sanitized} vegetable fact:`;

				const retryResult = await this.generator(retryPrompt, {
					max_new_tokens: 50,
					temperature: 0.1,
					do_sample: false
				});

				factText = retryResult?.[0]?.generated_text ?? '';
				factText = factText.replace(/^[\s:]+/, '').trim();

				// Validasi ulang
				const retryMentionsVegetable = factText.toLowerCase().includes(vegLower);
				const retryHasIrrelevant = irrelevantKeywords.some(kw =>
					factText.toLowerCase().includes(kw)
				);

				// Jika masih gagal, gunakan prompt paling dasar
				if (!retryMentionsVegetable || retryHasIrrelevant || factText.length < 15) {
					factText = `${sanitized} is a healthy vegetable that provides vitamins and minerals for the body.`;
				}
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