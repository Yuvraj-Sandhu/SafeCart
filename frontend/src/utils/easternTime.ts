/**
 * Utility functions for handling Eastern Time dates
 */

/**
 * Get current date/time in Eastern timezone
 */
export function getEasternDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
}

/**
 * Create a date in Eastern timezone
 */
export function createEasternDate(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): Date {
  // Create a date string and parse it as if it's in Eastern time
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Create date assuming local time
  const localDate = new Date(dateStr);
  
  // Get the timezone offset difference between local and Eastern
  const easternOffset = getEasternOffset();
  const localOffset = localDate.getTimezoneOffset() / 60;
  const offsetDiff = easternOffset - (-localOffset);
  
  // Adjust the date by the offset difference
  localDate.setHours(localDate.getHours() + offsetDiff);
  
  return localDate;
}

/**
 * Get Eastern timezone offset in hours (negative for EST/EDT)
 */
function getEasternOffset(): number {
  const now = new Date();
  const easternTime = now.toLocaleString("en-US", {timeZone: "America/New_York", timeZoneName: "short"});
  // EST is UTC-5, EDT is UTC-4
  return easternTime.includes("EST") ? -5 : -4;
}

/**
 * Get Last 30 Days date range in Eastern Time
 */
export function getLast30DaysEastern(): { startDate: Date; endDate: Date } {
  const today = getEasternDate();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const startDate = createEasternDate(
    thirtyDaysAgo.getFullYear(), 
    thirtyDaysAgo.getMonth(), 
    thirtyDaysAgo.getDate(), 
    0, 0, 0
  );
  
  const endDate = createEasternDate(
    today.getFullYear(), 
    today.getMonth(), 
    today.getDate(), 
    23, 59, 59
  );
  
  return { startDate, endDate };
}