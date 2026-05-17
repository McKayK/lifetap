FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the backend code
COPY . .

# Expose the API port
EXPOSE 5000

# Run the server
CMD ["node", "src/index.js"]