/**
 * Advanced Stealth Evasions for FDA Scrapers
 *
 * Collection of the most effective bot detection evasions
 * Based on research from:
 * - https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth
 * - https://github.com/ultrafunkamsterdam/undetected-chromedriver
 * - https://bot.sannysoft.com/
 */

class StealthEvasions {
  /**
   * Apply all stealth evasions to a browser context
   */
  static async applyAll(context) {
    console.log('Applying nuclear-level stealth evasions...');

    // Apply evasions to all new pages in this context
    await context.addInitScript(() => {
      // 1. Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // 2. Fix Chrome runtime
      Object.defineProperty(window, 'chrome', {
        writable: true,
        value: {
          runtime: {
            connect: () => {},
            sendMessage: () => {},
            onMessage: { addListener: () => {} }
          },
          loadTimes: () => {},
          csi: () => {},
          app: {}
        }
      });

      // 3. Fix permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // 4. Fix plugins to look real
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [
            {
              name: 'Chrome PDF Plugin',
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              item: (i) => arr[i],
              namedItem: (name) => arr.find(p => p.name === name)
            },
            {
              name: 'Chrome PDF Viewer',
              description: 'Portable Document Format',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              item: (i) => arr[i],
              namedItem: (name) => arr.find(p => p.name === name)
            },
            {
              name: 'Native Client',
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              item: (i) => arr[i],
              namedItem: (name) => arr.find(p => p.name === name)
            }
          ];
          arr.item = (i) => arr[i];
          arr.namedItem = (name) => arr.find(p => p.name === name);
          arr.refresh = () => {};
          return arr;
        }
      });

      // 5. Fix languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // 6. Fix WebGL vendor
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };

      // 7. Fix hairline feature
      Object.defineProperty(document, 'hasFocus', {
        value: () => true
      });

      // 8. Remove automation indicators
      ['__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
       '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_evaluate',
       '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
       '__selenium_unwrapped', '__fxdriver_unwrapped'].forEach(prop => {
        delete window[prop];
        delete document[prop];
      });

      // 9. Fix connection info
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          rtt: 100,
          downlink: 10,
          effectiveType: '4g',
          saveData: false
        })
      });

      // 10. Mock battery API
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      });

      // 11. Fix platform for consistency
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      });

      // 12. Remove puppeteer/playwright markers
      delete window._phantom;
      delete window.phantom;
      delete window.callPhantom;
      delete window.__playwright;
      delete window.__puppeteer;
      delete window.emit;

      // 13. Override toString methods to avoid detection
      window.navigator.permissions.query.toString = () => 'function query() { [native code] }';
      if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.sendMessage.toString = () => 'function sendMessage() { [native code] }';
      }

      // 14. Fix Notification permissions
      const originalNotification = window.Notification;
      Object.defineProperty(window, 'Notification', {
        writable: true,
        value: function(...args) {
          return new originalNotification(...args);
        }
      });
      window.Notification.permission = 'default';
      window.Notification.requestPermission = () => Promise.resolve('default');

      // 15. Mock media devices
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || (() => Promise.reject(new Error()));
      navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]);

      // 16. Fix console.debug to avoid detection
      const originalConsoleDebug = console.debug;
      console.debug = function(...args) {
        if (args[0] && args[0].includes && args[0].includes('asyncIterator')) {
          return;
        }
        return originalConsoleDebug.apply(this, args);
      };

      // 17. Add realistic window properties
      window.screenX = 0;
      window.screenY = 0;
      window.screenLeft = 0;
      window.screenTop = 0;
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.outerWidth = 1920;
      window.outerHeight = 1080;

      // 18. Fix hardwareConcurrency for realistic values
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      });

      // 19. Mock device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });

      // 20. Fix maxTouchPoints
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0
      });
    });

    // Additional context-level modifications (removed mouse-helper.js as it doesn't exist)

    console.log('Applied 20+ stealth evasions successfully');
  }

  /**
   * Add human-like behavior to a page
   */
  static async addHumanBehavior(page) {
    // Random mouse movements
    const mouseMove = async () => {
      const width = 1920;
      const height = 1080;

      await page.mouse.move(
        Math.random() * width,
        Math.random() * height,
        { steps: Math.floor(Math.random() * 10) + 5 }
      );
    };

    // Random scrolling
    const randomScroll = async () => {
      await page.evaluate(() => {
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        const scrollTo = Math.random() * maxScroll;
        window.scrollTo({
          top: scrollTo,
          behavior: 'smooth'
        });
      });
    };

    // Random delays between actions
    const humanDelay = () => {
      return new Promise(resolve => {
        const delay = Math.random() * 3000 + 1000; // 1-4 seconds
        setTimeout(resolve, delay);
      });
    };

    // Execute random behaviors
    if (Math.random() > 0.5) await mouseMove();
    if (Math.random() > 0.7) await randomScroll();
    await humanDelay();
  }

  /**
   * Check if stealth is working by running detection tests
   */
  static async testDetection(page) {
    const results = await page.evaluate(() => {
      const tests = {
        webdriver: navigator.webdriver === undefined,
        chrome: window.chrome !== undefined,
        permissions: window.navigator.permissions !== undefined,
        plugins: navigator.plugins.length > 0,
        languages: navigator.languages.length > 0,
        webgl: WebGLRenderingContext.prototype.getParameter !== undefined,
        notifications: window.Notification !== undefined,
        automation: window.navigator.webdriver === undefined
      };
      return tests;
    });

    const passed = Object.values(results).filter(v => v).length;
    const total = Object.keys(results).length;

    console.log(`Stealth Detection Test: ${passed}/${total} passed`);
    console.log('Results:', results);

    return passed === total;
  }
}

module.exports = StealthEvasions;