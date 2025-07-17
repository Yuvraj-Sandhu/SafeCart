# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install ImageMagick for PDF processing
RUN apk add --no-cache \
    imagemagick \
    imagemagick-dev \
    ghostscript

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create temp directory for image processing
RUN mkdir -p temp-images

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["npm", "start"]