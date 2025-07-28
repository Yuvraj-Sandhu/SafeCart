/**
 * Utility functions for date formatting with timezone handling
 */

/**
 * Formats a date string to display in Eastern Time zone
 * Handles dates in YYYY-MM-DD format and prevents timezone shift issues
 * @param dateString - The date string to format (e.g., "2025-07-27")
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatRecallDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    // For YYYY-MM-DD format, we need to parse it carefully to avoid timezone shifts
    // Split the date string and create date with specific values
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create date in Eastern Time by using the date parts directly
    // This avoids the UTC parsing issue
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    // Format as MM/DD/YYYY
    const formattedMonth = (month).toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    
    return `${formattedMonth}/${formattedDay}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return dateString; // Return original if parsing fails
  }
}

/**
 * Alternative method using Intl.DateTimeFormat for proper timezone handling
 * @param dateString - The date string to format
 * @returns Formatted date string in Eastern Time
 */
export function formatRecallDateET(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    // Parse the date parts to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create a date at noon ET to avoid any date boundary issues
    const date = new Date(year, month - 1, day, 12, 0, 0);
    
    // Format in Eastern Time
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return dateString;
  }
}