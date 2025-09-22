import OpenAI from 'openai';

class OpenAIService {
  private openai: OpenAI | null = null;
  private readonly maxRetries = 2;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('OpenAI API key not found. LLM title enhancement will be disabled.');
      return;
    }

    try {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      console.log('OpenAI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI service:', error);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async enhanceRecallTitle(originalTitle: string, recallReason?: string): Promise<string | null> {
    if (!this.openai) {
      console.log('OpenAI not initialized, skipping title enhancement');
      return null;
    }

    if (!originalTitle || originalTitle.trim().length === 0) {
      return null;
    }

    const systemPrompt = `You are an expert at creating clear, urgent, and informative titles for food recall notices.
    Your titles must immediately communicate the danger to consumers in plain language while including specific pathogens or contaminants.

    CRITICAL GUIDELINES:
    1. ALWAYS include the specific pathogen/contaminant name (e.g., "Listeria", "E. Coli", "Salmonella", "Metal Fragments")
    2. Lead with the product name/brand when known
    3. Be specific about the danger - never use generic terms like "health risk" or "safety concern"
    4. Keep under 80 characters while being informative
    5. Use urgent, active language that compels action
    6. Remove technical jargon but keep critical safety terms

    TITLE FORMULA:
    [Product/Brand] Recalled for [Specific Pathogen/Contaminant/Issue]

    EXCELLENT EXAMPLES:
    Title: "Ground Beef Recalled for E. Coli O157:H7 Contamination"
    Title: "Kirkland Ahi Tuna Recalled for Listeria monocytogenes Risk"
    Title: "Frozen Shrimp Products Recalled for Cesium-137 Radiation"
    Title: "BulkSupplements Inositol Recalled for Staphylococcus aureus"
    Title: "Baby Formula Recalled for Cronobacter sakazakii Bacteria"
    Title: "Peanut Butter Recalled - Contains Glass Fragments"
    Title: "Raw Milk Cheese Recalled for Brucella Contamination"

    BAD EXAMPLES (never do this):
    "Product Recalled for Possible Health Risk" - Too vague
    "Food Safety Alert" - No specific information
    "Voluntary Recall Notice" - Doesn't say what's wrong
    "Product May Be Contaminated" - Doesn't specify contamination type

    PATHOGEN/CONTAMINANT SEVERITY GUIDE:
    - Always use the scientific name for bacteria (E. coli, Listeria monocytogenes, Salmonella)
    - For chemicals, use the specific name (Cesium-137, Lead, Cadmium)
    - For allergens, be specific (Undeclared Peanuts, Hidden Milk Allergen)
    - For foreign objects, describe them (Metal Shavings, Glass Pieces, Plastic Fragments)`;

    let userPrompt = `Product Title: "${originalTitle}"`;
    if (recallReason && recallReason.trim().length > 0) {
      userPrompt += `\nRecall Reason: "${recallReason}"`;
    }
    userPrompt += `\n\nCreate a clear, specific recall title that tells consumers exactly what product is being recalled and why it's dangerous.`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          max_tokens: 100,
        });

        let enhancedTitle = response.choices[0]?.message?.content?.trim();
        
        if (enhancedTitle && enhancedTitle.length > 0) {
          // Remove surrounding quotes if present (GPT sometimes adds them)
          enhancedTitle = enhancedTitle.replace(/^["'](.*)["']$/, '$1');
          
          // console.log(`Title enhanced successfully: "${originalTitle}" -> "${enhancedTitle}"`);
          return enhancedTitle;
        }
        
        return null;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenAI API error (attempt ${attempt + 1}/${this.maxRetries + 1}):`, error);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * (attempt + 1)); // Exponential backoff
        }
      }
    }

    console.error(`Failed to enhance title after ${this.maxRetries + 1} attempts:`, lastError);
    return null;
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }
}

export const openAIService = new OpenAIService();