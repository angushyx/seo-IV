FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and data
COPY . .

# Expose port
EXPOSE 3000

# Run in dev mode (supports hot-reload + API routes)
CMD ["npm", "run", "dev"]
