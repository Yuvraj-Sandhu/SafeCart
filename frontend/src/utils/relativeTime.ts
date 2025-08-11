/**
 * Converts a date string to a relative time format
 * Examples: "2 days ago", "3 weeks ago", "1 month ago"
 * 
 * @param dateString - ISO date string or date in format YYYY-MM-DD
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 14) {
      return '1 week ago';
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} weeks ago`;
    } else if (diffInDays < 60) {
      return '1 month ago';
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `${months} months ago`;
    } else if (diffInDays < 730) {
      return '1 year ago';
    } else {
      const years = Math.floor(diffInDays / 365);
      return `${years} years ago`;
    }
  } catch (error) {
    console.error('Error parsing date:', error);
    return '';
  }
}