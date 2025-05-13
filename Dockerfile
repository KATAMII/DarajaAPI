FROM node:18-slim

# Install OpenSSL which is needed for Prisma
RUN apt-get update && apt-get install -y openssl

# Set working directory
WORKDIR /app

# Copy prisma schema files first
COPY server/prisma ./prisma/

# Copy package files for better caching
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy only the server files
COPY server/ ./

# Ensure the output directory for Prisma exists
RUN mkdir -p ./generated/prisma

# Generate Prisma client (add DATABASE_URL for generation time only)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN npx prisma generate
# Unset the dummy URL
ENV DATABASE_URL=""

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Start the application
CMD ["npm", "start"] 