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

  async enhanceRecallTitle(originalTitle: string): Promise<string | null> {
    if (!this.openai) {
      console.log('OpenAI not initialized, skipping title enhancement');
      return null;
    }

    if (!originalTitle || originalTitle.trim().length === 0) {
      return null;
    }

    const systemPrompt = `You are an expert at creating clear, concise, and informative titles for food 
    recall notices. Your goal is to transform technical recall titles into consumer-friendly headlines 
    that immediately convey the most important information.

    Guidelines:
    1. Keep titles concise (under 80 characters when possible)
    2. Include the specific product type
    3. Mention the primary health risk or reason for recall if apparent
    4. Use active, clear language
    5. Remove technical codes and jargon
    6. Focus on what consumers need to know immediately

    Examples:
    Original: "FSIS-RC-023-2024 - Class I Recall: Establishment Recalls Raw Ground Beef Products due to Possible E. coli O157:H7 Contamination"
    Enhanced: "Ground Beef Recalled for Possible E. Coli Contamination"

    Original: "Public Health Alert: RTE Meat and Poultry Products Produced Without Benefit of Inspection"
    Enhanced: "Ready-to-Eat Meat Products Recalled - Produced Without Inspection"

    Original: "Recall 073-2024: Undeclared Milk Allergen in Dark Chocolate Products Distributed Nationwide"
    Enhanced: "Dark Chocolate Recalled for Undeclared Milk Allergen"

    Original: "Voluntary Recall of Frozen Chicken Nuggets Due to Possible Foreign Matter Contamination (Metal)"
    Enhanced: "Frozen Chicken Nuggets Recalled - May Contain Metal Pieces"

    Original: "Recall Notification - Retail Distribution - WA, OR, ID, CA - Fresh Produce Items - Listeria monocytogenes"
    Enhanced: "Fresh Produce Recalled in 4 Western States for Listeria Risk"`;

    const userPrompt = `Enhance this recall title: "${originalTitle}"`;

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

        const enhancedTitle = response.choices[0]?.message?.content?.trim();
        
        if (enhancedTitle && enhancedTitle.length > 0) {
          console.log(`Title enhanced successfully: "${originalTitle}" -> "${enhancedTitle}"`);
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