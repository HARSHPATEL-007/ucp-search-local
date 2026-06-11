FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose API port
EXPOSE 4000

# Development mode with hot reload
CMD ["npm", "run", "dev"]
