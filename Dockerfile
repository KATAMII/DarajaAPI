FROM node:18-slim

# Install OpenSSL which is needed for Prisma
RUN apt-get update && apt-get install -y openssl

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy only the server files
COPY server/ ./

# Ensure the output directory for Prisma exists
RUN mkdir -p ./generated/prisma

# Generate Prisma client with the specific schema path 
RUN npx prisma generate

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Start the application
CMD ["npm", "start"] 