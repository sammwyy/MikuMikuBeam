# Dockerfile using Multi-Stage Build for Optimized Node.js Application

################################################################################
# STAGE 1: BUILDER - Used for installing dev dependencies and compiling/bundling
################################################################################
# Use a full Node.js image for building (contains compilers and tools)
FROM node:20-slim AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json first to leverage layer caching
# We skip package-lock.json to avoid cross-platform issues with optional dependencies
COPY package.json ./

# Install all dependencies (development and production)
# Note: If you are using 'bun install' or 'yarn install', replace 'npm install'
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the project (assuming 'npm run build' outputs to the './dist' directory)
RUN npm run build


################################################################################
# STAGE 2: PRODUCTION - Used for running the compiled application
################################################################################
# Use a minimal Node.js image for the final production image (smaller footprint)
FROM node:20-slim AS production

# Set environment to production
ENV NODE_ENV=production

# Set the working directory
WORKDIR /app

# --- SECURITY IMPROVEMENT: Create a non-root user ---
# Running as non-root user (UID 1001) limits potential damage if compromised
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 appuser

# Copy ONLY production dependencies from the builder stage
# We install them here to ensure the final image only contains what is needed
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

USER appuser

# Copy the compiled application files from the 'builder' stage
# This directory contains the final, runnable code
COPY --from=builder /app/dist ./dist

# Copy the starting file if it's not inside dist (e.g., if you have a top-level server.js)
# Example: COPY --from=builder /app/server.js ./

# Expose the port the app runs on (adjust if necessary)
EXPOSE 3000

# Command to run the application
# Using the direct node executable is often faster than 'npm run start'
CMD ["node", "dist/index.js"] 
# Alternative if 'npm run start' is required for complex setup:
# CMD ["npm", "run", "start"]