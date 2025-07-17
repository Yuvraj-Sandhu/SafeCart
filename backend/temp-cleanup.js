
        const fs = require('fs');
        const path = require('path');
        const tempDir = 'C:\\Users\\yuvra\\Desktop\\SafeCart\\backend\\temp-images';
        
        setTimeout(() => {
          try {
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
              console.log('Temp directory cleaned up successfully');
            }
          } catch (err) {
            // Try Windows rmdir
            if (process.platform === 'win32') {
              try {
                require('child_process').execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'ignore' });
              } catch (e) {}
            }
          }
        }, 5000); // Wait 5 seconds after parent process exits
      