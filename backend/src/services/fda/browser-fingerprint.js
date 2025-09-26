/**
 * Browser Fingerprint Randomization Utility
 *
 * Provides rotating user agents, headers, and browser fingerprints
 * to avoid bot detection on FDA websites.
 */

class BrowserFingerprint {
  constructor() {
    // Real user agents from popular browsers (updated January 2025)
    this.userAgents = {
      chrome_windows: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      chrome_mac: [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      ],
      firefox_windows: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
      ],
      firefox_mac: [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0) Gecko/20100101 Firefox/120.0'
      ],
      edge_windows: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
      ],
      safari_mac: [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      ]
    };

    // Viewport sizes (common desktop resolutions)
    this.viewports = [
      { width: 1920, height: 1080 }, // Full HD - Most common
      { width: 1366, height: 768 },  // Popular laptop
      { width: 1440, height: 900 },  // MacBook
      { width: 1536, height: 864 },  // Common laptop
      { width: 1680, height: 1050 }, // Older MacBook Pro
      { width: 2560, height: 1440 }, // 2K
      { width: 1920, height: 1200 }, // WUXGA
      { width: 1600, height: 900 },  // HD+
    ];

    // Timezone configurations
    this.timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
      'America/Detroit',
      'America/Indiana/Indianapolis',
      'America/Kentucky/Louisville'
    ];

    // Language configurations
    this.languages = [
      'en-US,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.8',
      'en-GB,en;q=0.9,en-US;q=0.8',
      'en-US,en;q=0.9,fr;q=0.7'
    ];

    // Track last used configuration to ensure rotation
    this.lastUsedIndex = -1;
  }

  /**
   * Get all user agents as a flat array
   */
  getAllUserAgents() {
    const allAgents = [];
    for (const category of Object.values(this.userAgents)) {
      allAgents.push(...category);
    }
    return allAgents;
  }

  /**
   * Generate a random browser fingerprint
   * Ensures different configuration each time by tracking last used
   */
  getRandomFingerprint() {
    const allAgents = this.getAllUserAgents();

    // Ensure we don't use the same configuration twice in a row
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * allAgents.length);
    } while (randomIndex === this.lastUsedIndex && allAgents.length > 1);

    this.lastUsedIndex = randomIndex;
    const userAgent = allAgents[randomIndex];

    // Determine browser type from user agent
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isFirefox = userAgent.includes('Firefox');
    const isEdge = userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isWindows = userAgent.includes('Windows');
    const isMac = userAgent.includes('Mac');

    // Select appropriate viewport (with slight randomization)
    const baseViewport = this.viewports[Math.floor(Math.random() * this.viewports.length)];
    const viewport = {
      width: baseViewport.width + Math.floor(Math.random() * 10) - 5,  // ±5 pixels
      height: baseViewport.height + Math.floor(Math.random() * 10) - 5  // ±5 pixels
    };

    // Generate appropriate headers based on browser type
    const headers = this.generateHeaders(userAgent, isChrome, isFirefox, isEdge, isSafari);

    // Select random timezone and language
    const timezone = this.timezones[Math.floor(Math.random() * this.timezones.length)];
    const language = this.languages[Math.floor(Math.random() * this.languages.length)];

    return {
      userAgent,
      viewport,
      locale: 'en-US',
      timezoneId: timezone,
      deviceScaleFactor: isMac ? 2 : 1, // Retina display for Mac
      hasTouch: false,
      isMobile: false,
      permissions: ['geolocation', 'notifications'],
      extraHTTPHeaders: headers,
      screen: {
        width: viewport.width,
        height: viewport.height
      },
      // Additional browser-specific settings
      args: this.getBrowserArgs(isChrome, isFirefox, isEdge),
      ignoreDefaultArgs: isChrome ? ['--enable-automation'] : undefined,
      // Platform-specific color scheme
      colorScheme: Math.random() > 0.7 ? 'dark' : 'light',
      reducedMotion: Math.random() > 0.9 ? 'reduce' : 'no-preference'
    };
  }

  /**
   * Generate realistic headers based on browser type
   */
  generateHeaders(userAgent, isChrome, isFirefox, isEdge, isSafari) {
    const language = this.languages[Math.floor(Math.random() * this.languages.length)];

    // Base headers common to all browsers
    const headers = {
      'Accept-Language': language,
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'DNT': Math.random() > 0.5 ? '1' : undefined, // 50% chance of Do Not Track
    };

    if (isChrome || isEdge) {
      // Chrome/Edge specific headers
      const chromeVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] || '120';
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
      headers['Sec-Ch-Ua'] = `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "${isEdge ? 'Microsoft Edge' : 'Google Chrome'}";v="${chromeVersion}"`;
      headers['Sec-Ch-Ua-Mobile'] = '?0';
      headers['Sec-Ch-Ua-Platform'] = userAgent.includes('Windows') ? '"Windows"' : '"macOS"';
      headers['Sec-Fetch-Site'] = 'none';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-User'] = '?1';
      headers['Sec-Fetch-Dest'] = 'document';
    } else if (isFirefox) {
      // Firefox specific headers
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
      headers['Sec-Fetch-Site'] = 'none';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-User'] = '?1';
      headers['Sec-Fetch-Dest'] = 'document';
    } else if (isSafari) {
      // Safari specific headers
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    }

    // Remove undefined values
    return Object.fromEntries(
      Object.entries(headers).filter(([_, v]) => v !== undefined)
    );
  }

  /**
   * Get browser-specific launch arguments
   */
  getBrowserArgs(isChrome, isFirefox, isEdge) {
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];

    if (isChrome || isEdge) {
      return [
        ...baseArgs,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        `--window-size=${1920 + Math.floor(Math.random() * 200)},${1080 + Math.floor(Math.random() * 200)}`
      ];
    }

    return baseArgs;
  }

  /**
   * Get a fingerprint summary for logging
   */
  getFingerprintSummary(fingerprint) {
    const browserMatch = fingerprint.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/);
    const browser = browserMatch ? browserMatch[1] : 'Unknown';
    const platform = fingerprint.userAgent.includes('Windows') ? 'Windows' :
                     fingerprint.userAgent.includes('Mac') ? 'Mac' : 'Unknown';

    return `${browser} on ${platform}, ${fingerprint.viewport.width}x${fingerprint.viewport.height}, TZ: ${fingerprint.timezoneId}`;
  }
}

// Export singleton instance
module.exports = new BrowserFingerprint();