# Use Node.js 20 (Debian-based for Playwright compatibility)
FROM node:20

# Install dependencies for Playwright and ImageMagick
RUN apt-get update && apt-get install -y \
    # ImageMagick and Ghostscript for PDF processing
    imagemagick \
    ghostscript \
    # Dependencies for Chromium (required by Playwright)
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxcb1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic link for ImageMagick compatibility
# Debian uses 'convert' but the code expects 'magick'
RUN ln -s /usr/bin/convert /usr/bin/magick

# Fix ImageMagick security policy to allow PDF processing
# Remove the restrictive PDF policy that blocks PDF operations
RUN sed -i '/policy domain="coder" rights="none" pattern="PDF"/d' /etc/ImageMagick-6/policy.xml || \
    echo "Policy file not found or already modified"

# Add a less restrictive PDF policy (read|write allowed)
RUN sed -i '/<policymap>/a \  <policy domain="coder" rights="read|write" pattern="PDF" />' /etc/ImageMagick-6/policy.xml || \
    echo "Could not add PDF policy"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers (only Chromium to save space)
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy JS files from ires-scripts to dist directory (they're not compiled by TypeScript)
RUN mkdir -p dist/services/fda/ires-scripts && \
    cp src/services/fda/ires-scripts/*.js dist/services/fda/ires-scripts/

# Create temp directory for image processing
RUN mkdir -p temp-images

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["npm", "start"]