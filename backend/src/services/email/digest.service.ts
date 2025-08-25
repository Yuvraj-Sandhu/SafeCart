/**
 * Email Digest Service
 * 
 * Handles data preparation and business logic for email digest generation.
 * Fetches, formats, and prepares recall data for email templates.
 * 
 * Key Responsibilities:
 * - Fetch recalls from multiple sources (USDA, FDA)
 * - Format recall data for email template consumption
 * - Handle state-based filtering and sorting
 * - Provide fallback data for testing scenarios
 * - Prepare complete digest data for email rendering
 * 
 * @author Yuvraj
 */

import * as admin from 'firebase-admin';
import { RecallDigestData, WelcomeEmailData } from './render.service';

const db = admin.firestore();

/**
 * Recall data interface for email templates
 */
export interface RecallData {
  id: string;
  title: string;
  company: string;
  recallDate: string;
  recallInitiationDate?: string; // For relative time display
  classification: string;
  description: string;
  reason: string;
  primaryImage?: string;
  recallUrl?: string;
  source: 'USDA' | 'FDA';
  affectedStates?: string[];
}

/**
 * Email Digest Service Class
 * 
 * Provides methods for preparing email digest data from various recall sources.
 * Centralizes the business logic for digest generation and data formatting.
 */
export class EmailDigestService {

  /**
   * Fetch Recent Recalls for Email Digests
   * 
   * Retrieves and formats recent recalls from both USDA and FDA databases.
   * Used for daily digests, test emails, and immediate alerts.
   * 
   * @param state - Two-letter US state code for filtering
   * @param limit - Maximum number of recalls to return (default: 10)
   * @param daysBack - Number of days to look back (default: 7)
   * @returns Promise<RecallData[]> - Formatted recall objects ready for email templates
   * 
   * Business Logic:
   * - Splits limit between USDA and FDA sources for balanced coverage
   * - Prioritizes recalls by date (most recent first)
   * - Uses AI-enhanced titles when available, falls back to original
   * - Includes primary image based on display preferences
   * - Generates appropriate recall URLs for user access
   * 
   * Error Handling:
   * - Returns sample data if database queries fail (for testing)
   * - Logs errors for monitoring but doesn't crash
   * - Ensures email sending can proceed even with data issues
   * 
   * Performance Optimization:
   * - Parallel queries to USDA and FDA collections
   * - Limited result sets to prevent memory issues
   * - Efficient field selection and sorting
   */
  static async getRecentRecalls(
    state: string, 
    limit: number = 10,
    daysBack: number = 7
  ): Promise<RecallData[]> {
    try {
      // Calculate date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      const dateStr = dateThreshold.toISOString().split('T')[0];

      // Fetch recent USDA recalls for the state
      const usdaQuery = await db.collection('recalls')
        .where('affectedStatesArray', 'array-contains', state)
        .where('field_recall_date', '>=', dateStr)
        .orderBy('field_recall_date', 'desc')
        .limit(Math.ceil(limit / 2))
        .get();

      // Fetch recent FDA recalls for the state  
      const fdaQuery = await db.collection('fda_recalls')
        .where('affectedStatesArray', 'array-contains', state)
        .where('report_date', '>=', dateStr)
        .orderBy('report_date', 'desc')
        .limit(Math.floor(limit / 2))
        .get();

      const recalls: RecallData[] = [];

      // Process USDA recalls with proper field mapping
      usdaQuery.docs.forEach(doc => {
        const data = doc.data();
        recalls.push({
          id: doc.id,
          title: data.display?.previewTitle || data.llmTitle || data.field_title || 'Food Recall',
          company: EmailDigestService.extractCompanyName(data.field_summary),
          recallDate: data.field_recall_date,
          classification: data.field_risk_level || 'Class II',
          description: data.field_summary || 'No description available',
          reason: data.field_product_items || 'Contamination concerns',
          primaryImage: EmailDigestService.getPrimaryImage(data),
          recallUrl: data.display?.previewUrl || `https://safecart.app/recall/${doc.id}`,
          source: 'USDA' as const
        });
      });

      // Process FDA recalls with proper field mapping
      fdaQuery.docs.forEach(doc => {
        const data = doc.data();
        recalls.push({
          id: doc.id,
          title: data.display?.previewTitle || data.llmTitle || data.product_description || 'Food Recall',
          company: data.recalling_firm || 'Unknown Company',
          recallDate: data.report_date,
          classification: data.classification || 'Class II',
          description: data.product_description || 'No description available',
          reason: data.reason_for_recall || 'Safety concerns',
          primaryImage: EmailDigestService.getPrimaryImage(data),
          recallUrl: data.display?.previewUrl || `https://safecart.app/fda-recall/${doc.id}`,
          source: 'FDA' as const
        });
      });

      // Sort by date and return limited results
      return recalls
        .sort((a, b) => new Date(b.recallDate).getTime() - new Date(a.recallDate).getTime())
        .slice(0, limit);

    } catch (error) {
      console.error('Error fetching recent recalls for digest:', error);
      return EmailDigestService.getSampleRecalls(state);
    }
  }

  /**
   * Prepare Complete Digest Data
   * 
   * Assembles all necessary data for a recall digest email.
   * Combines user information, recalls, and metadata for template rendering.
   * 
   * @param user - User object with email preferences
   * @param state - Specific state for this digest (user may be subscribed to multiple)
   * @param isTest - Whether this is a test email
   * @returns Promise<RecallDigestData> - Complete data for digest template
   * 
   * Use Cases:
   * - Daily automated digest preparation
   * - Test email generation
   * - Manual digest triggers
   * - Emergency alert preparation
   */
  static async prepareDigestData(
    user: {
      name: string;
      email: string;
      emailPreferences: {
        states: string[];
        unsubscribeToken?: string;
      };
    },
    state: string,
    isTest: boolean = false
  ): Promise<RecallDigestData> {
    // Fetch recalls for the specified state
    const recalls = await EmailDigestService.getRecentRecalls(
      state,
      isTest ? 5 : 20,  // Fewer recalls for test emails
      isTest ? 7 : 1    // Last week for tests, today for daily digest
    );

    return {
      user: {
        name: user.name,
        email: user.email,
        unsubscribeToken: user.emailPreferences.unsubscribeToken || 'pending'
      },
      state: state,
      recalls: recalls,
      digestDate: new Date().toISOString(),
      isTest: isTest
    };
  }

  /**
   * Prepare Test Digest Data
   * 
   * Special method for test emails that shows recalls from first subscribed state.
   * 
   * @param user - User object with email preferences
   * @returns Promise<RecallDigestData> - Test digest data
   */
  static async prepareTestDigestData(
    user: {
      name: string;
      email: string;
      emailPreferences: {
        states: string[];
        unsubscribeToken?: string;
      };
    }
  ): Promise<RecallDigestData> {
    // If user has no states selected, use California as default for testing
    const statesToTest = user.emailPreferences.states.length > 0 
      ? user.emailPreferences.states 
      : ['CA'];

    // For test emails, show recalls from first subscribed state
    const primaryState = statesToTest[0];
    const recalls = await EmailDigestService.getRecentRecalls(primaryState, 5, 7);

    // If subscribed to multiple states, add a note in the digest
    const stateDescription = statesToTest.length > 1 
      ? `${primaryState} (and ${statesToTest.length - 1} other state${statesToTest.length > 2 ? 's' : ''})`
      : primaryState;

    return {
      user: {
        name: user.name,
        email: user.email,
        unsubscribeToken: user.emailPreferences.unsubscribeToken || 'pending'
      },
      state: stateDescription,
      recalls: recalls,
      digestDate: new Date().toISOString(),
      isTest: true
    };
  }

  /**
   * Prepare Welcome Email Data
   * 
   * Assembles data for welcome email after user subscription.
   * 
   * @param user - New subscriber user object
   * @returns WelcomeEmailData - Complete data for welcome template
   */
  static prepareWelcomeData(user: any): WelcomeEmailData {
    // Format states list for welcome email
    const states = user.emailPreferences?.states || [];
    const stateDescription = states.length === 0 
      ? 'No states selected yet'
      : states.length === 1 
      ? states[0]
      : states.length === 2
      ? `${states[0]} and ${states[1]}`
      : `${states.slice(0, -1).join(', ')}, and ${states[states.length - 1]}`;

    return {
      user: {
        name: user.name,
        email: user.email,
        unsubscribeToken: user.emailPreferences?.unsubscribeToken || 'pending'
      },
      state: stateDescription  // This will show "CA, TX, and NY" for multiple states
    };
  }

  /**
   * Extract Company Name from Summary
   * 
   * Attempts to extract company name from USDA recall summary text.
   * 
   * @param summary - USDA recall summary text
   * @returns string - Extracted company name or fallback
   */
  static extractCompanyName(summary?: string): string {
    if (!summary) return 'Unknown Company';
    
    // USDA summaries often start with company name
    const firstSentence = summary.split('.')[0];
    const words = firstSentence.split(' ');
    
    // Take first few words as company name (heuristic)
    return words.slice(0, Math.min(3, words.length)).join(' ') || 'Unknown Company';
  }

  /**
   * Get Primary Image URL
   * 
   * Determines the primary image to display based on user preferences.
   * 
   * @param recallData - Recall document data
   * @returns string | undefined - Primary image URL if available
   */
  static getPrimaryImage(recallData: any): string | undefined {
    // Check for uploaded images first
    if (recallData.display?.uploadedImages?.length > 0) {
      const primaryIndex = recallData.display.primaryImageIndex || 0;
      return recallData.display.uploadedImages[primaryIndex]?.storageUrl;
    }

    // Fall back to processed images
    if (recallData.processedImages?.length > 0) {
      const primaryIndex = recallData.display?.primaryImageIndex || 0;
      return recallData.processedImages[primaryIndex]?.storageUrl;
    }

    return undefined;
  }

  /**
   * Get Sample Recalls for Testing
   * 
   * Provides fallback recall data when database is unavailable.
   * Used for testing email templates without database dependency.
   * 
   * @param state - State for sample data
   * @returns RecallData[] - Array of sample recall objects
   */
  private static getSampleRecalls(state: string): RecallData[] {
    return [
      {
        id: 'sample-recall-1',
        title: 'Sample Salad Recall (Test Data)',
        company: 'Example Foods Inc.',
        recallDate: new Date().toISOString().split('T')[0],
        classification: 'Class I',
        description: 'This is sample recall data for testing your SafeCart email subscription. In a real digest, this would contain actual recall information.',
        reason: 'Potential Listeria contamination (sample data)',
        primaryImage: undefined,
        recallUrl: 'https://safecart.app',
        source: 'USDA' as const
      },
      {
        id: 'sample-recall-2',
        title: 'Sample Cookie Recall (Test Data)',
        company: 'Test Bakery Co.',
        recallDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        classification: 'Class II',
        description: 'Another sample recall for testing. Real recalls would include detailed product information and safety instructions.',
        reason: 'Undeclared allergens - peanuts (sample data)',
        primaryImage: undefined,
        recallUrl: 'https://safecart.app',
        source: 'FDA' as const
      }
    ];
  }

  /**
   * Batch Prepare Digest Data
   * 
   * Efficiently prepares digest data for multiple users in the same state.
   * Optimizes by fetching recalls once and reusing for all users.
   * 
   * @param users - Array of users in the same state
   * @param state - Common state for all users
   * @returns Promise<RecallDigestData[]> - Array of digest data for each user
   * 
   * Performance Optimization:
   * - Single recall fetch for multiple users
   * - Parallel data assembly
   * - Memory efficient for large user lists
   */
  static async batchPrepareDigestData(
    users: Array<{
      name: string;
      email: string;
      unsubscribeToken: string;
    }>,
    state: string
  ): Promise<RecallDigestData[]> {
    // Fetch recalls once for all users in the state
    const recalls = await EmailDigestService.getRecentRecalls(state, 20, 1);
    const digestDate = new Date().toISOString();

    // Prepare digest data for each user
    return users.map(user => ({
      user: {
        name: user.name,
        email: user.email,
        unsubscribeToken: user.unsubscribeToken
      },
      state,
      recalls,
      digestDate,
      isTest: false
    }));
  }
}

/**
 * Singleton Email Digest Service Instance
 * 
 * Pre-configured digest service for use throughout the application.
 * Provides centralized access to digest preparation methods.
 */
export const emailDigestService = EmailDigestService;