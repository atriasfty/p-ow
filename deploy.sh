#!/bin/bash

# Stop script on any error
set -e

# =================================================================
# Project Overwatch - Zero-Downtime Deployment Script
# v3.1 - With enhanced safety and self-documenting rollback
#
# This script uses a blue-green deployment strategy.
# 1. It creates a new 'release' directory for the new code.
# 2. It installs dependencies, builds, and migrates the DB.
# 3. It then atomically switches a 'current' symlink to the new release.
# 4. Finally, it reloads the apps with PM2 for zero downtime.
# =================================================================

# --- Configuration ---
# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directory structure
RELEASES_DIR="releases"
SHARED_DIR="shared"
# CURRENT_SYMLINK is set per-environment below (current-prod / current-staging)
# so that a staging deploy never touches prod's running processes.
RELEASES_TO_KEEP=3

# Database location (stored outside of releases to persist)
DATA_DIR="/root/data"

# Target Environment Argument
TARGET_ENV=$1
if [ -z "$TARGET_ENV" ]; then
    echo -e "${RED}[ERROR] Missing environment argument.${NC}"
    echo "Usage: ./deploy.sh [prod|staging]"
    exit 1
fi

if [ "$TARGET_ENV" == "prod" ]; then
    BRANCH="main"
    PORT="41729"
    SYNC_PORT="41730"
    APP_URL="https://pow.ciankelly.xyz"
    WS_URL=""
    DEFAULT_DB_URL="postgresql://pow:@localhost:5432/pow_prod"
    CURRENT_SYMLINK="current-prod"
elif [ "$TARGET_ENV" == "staging" ]; then
    BRANCH="staging"
    PORT="41731"
    SYNC_PORT="41732"
    APP_URL="https://staging.atriasafety.org"
    WS_URL="wss://powsyncstaging.atriasafety.org"
    DEFAULT_DB_URL="postgresql://pow:@localhost:5432/pow_staging"
    CURRENT_SYMLINK="current-staging"
else
    echo -e "${RED}[ERROR] Invalid environment. Use 'prod' or 'staging'.${NC}"
    exit 1
fi

export APP_ENV="$TARGET_ENV"
export PORT="$PORT"
export SYNC_PORT="$SYNC_PORT"

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE} MISTER NETANYAHU PLEASE LET THIS DEPLOYMENT WORK ${NC}"
echo -e "${BLUE} TARGETING ENVIRONMENT: ${YELLOW}${TARGET_ENV^^}${BLUE} (${BRANCH}) ${NC}"
echo -e "${BLUE}==================================================${NC}"

# --- Pre-flight Checks ---
# Check for required commands
if ! command -v git &> /dev/null; then
    echo -e "${RED}[ERROR] 'git' command not found. Please install it to proceed.${NC}"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] 'npm' command not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Check for ecosystem.config.js
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}[ERROR] ecosystem.config.js not found.${NC}"
    echo "Please ensure ecosystem.config.js exists in the project root before running."
    exit 1
fi

# PRE-FLIGHT CHECK: Verify Clerk keys exist in shared .env (if it exists)
if [ -f "shared/${TARGET_ENV}.env" ]; then
    echo -e "${YELLOW}[PRE-FLIGHT] Checking existing environment configuration...${NC}"
    if ! grep -q "CLERK_SECRET_KEY=" "shared/${TARGET_ENV}.env"; then
        echo -e "${RED}[WARNING] CLERK_SECRET_KEY not found in shared/${TARGET_ENV}.env${NC}"
    fi
    if ! grep -q "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" "shared/${TARGET_ENV}.env"; then
        echo -e "${RED}[WARNING] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found in shared/${TARGET_ENV}.env${NC}"
    fi
fi

# Install PM2 if missing
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing globally...${NC}"
    sudo npm install -g pm2
fi

echo -e "${YELLOW}[0/8] PRAYING TO MITER NETANYAHUUUUU...${NC}"
echo -e "${RED}PLEASE MISTER NETANYAHU IM SO CLOSE TO DEPLOYING IT PLEASE JUST NO TYPESCRIPT ERRORS AND NO PRISMA ERRORS${NC}"
# --- 1. Setup Directories ---
echo -e "${YELLOW}[1/8] Setting up directories...${NC}"
mkdir -p ${RELEASES_DIR}
mkdir -p ${SHARED_DIR}
mkdir -p ${DATA_DIR}
mkdir -p ${DATA_DIR}/uploads/forms  # Form file uploads (persists across deploys)

# Create a new directory for this release
RELEASE_NAME=$(date +"%Y%m%d%H%M%S")
NEW_RELEASE_DIR="${RELEASES_DIR}/${RELEASE_NAME}"
mkdir -p "${NEW_RELEASE_DIR}"
echo -e "New release directory: ${GREEN}${NEW_RELEASE_DIR}${NC}"

# --- 2. Fetch Code From GitHub ---
echo -e "${YELLOW}[2/8] Fetching code from GitHub...${NC}"
GIT_TMP_DIR="${RELEASES_DIR}/.git_tmp_${RELEASE_NAME}"
git clone -b ${BRANCH} https://github.com/atriasfty/p-ow.git "${GIT_TMP_DIR}"

if [ ! -d "${GIT_TMP_DIR}" ]; then
    echo -e "${RED}[ERROR] Failed to clone the repository. Check Git authentication.${NC}"
    exit 1
fi

# Move the contents to the release directory
shopt -s dotglob 2>/dev/null || true
mv "${GIT_TMP_DIR}/"* "${NEW_RELEASE_DIR}/" 2>/dev/null || true
shopt -u dotglob 2>/dev/null || true

# Cleanup git dir
rm -rf "${GIT_TMP_DIR}"
echo -e "${GREEN}Code successfully checked out from branch '${BRANCH}'.${NC}"

# --- 3. Environment Configuration ---
echo -e "${YELLOW}[3/8] Configuring environment...${NC}"
SHARED_ENV_FILE="${SHARED_DIR}/${TARGET_ENV}.env"

if [ ! -f "${SHARED_ENV_FILE}" ]; then
    echo -e "${YELLOW}No existing .env file found for ${TARGET_ENV^^}. Starting first-time setup...${NC}"
    
    echo -e "${BLUE}=== ENTERING SECRETS FOR: ${TARGET_ENV^^} ===${NC}"
    read -p "Discord Bot Token [${TARGET_ENV^^}]: " DISCORD_BOT_TOKEN
    read -p "Discord Client ID [${TARGET_ENV^^}]: " CLIENT_ID
    read -p "Discord Guild ID [${TARGET_ENV^^}]: " GUILD_ID
    read -p "Clerk Secret Key [${TARGET_ENV^^}]: " CLERK_SECRET_KEY
    read -p "Clerk Publishable Key [${TARGET_ENV^^}]: " NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    read -p "Roblox API Key - Open Cloud [${TARGET_ENV^^}]: " ROBLOX_API_KEY
    read -p "Discord Punishment Webhook URL [${TARGET_ENV^^}]: " DISCORD_PUNISHMENT_WEBHOOK
    read -p "Mistral API Key: " MISTRAL_API_KEY
    read -p "Garmin API Key: " GARMIN_API_KEY
    read -p "PostHog Project API Key: " POSTHOG_KEY
    read -p "PostHog Personal API Key - from PostHog Settings -> Personal API Keys: " POSTHOG_PERSONAL_KEY
    read -p "PostHog Project ID - number from PostHog URL e.g. 12345: " POSTHOG_PROJECT_ID
    
    read -p "Vision HMAC Secret (default: pow-vision-hmac-secret-2024): " VISION_HMAC_INPUT
    VISION_HMAC_SECRET=${VISION_HMAC_INPUT:-"pow-vision-hmac-secret-2024"}
    
    # Generate automatic internal secrets
    INTERNAL_SYNC_SECRET_GEN="$(openssl rand -base64 32)"
    VISION_JWT_SECRET_GEN="$(openssl rand -base64 32)"
    NEXTAUTH_SECRET_GEN="$(openssl rand -base64 32)"
    
    read -p "PostgreSQL connection string [${TARGET_ENV^^}] (default: ${DEFAULT_DB_URL}): " DB_URL_INPUT
    DATABASE_URL_VAL="${DB_URL_INPUT:-$DEFAULT_DB_URL}"

    # Write to the shared .env file
    cat > "${SHARED_ENV_FILE}" <<EOL
# Generated by deploy.sh
DATABASE_URL="${DATABASE_URL_VAL}"
DATA_DIR="${DATA_DIR}"
PORT="${PORT}"
NEXT_PUBLIC_APP_ENV="${TARGET_ENV}"

# Discord Config
DISCORD_TOKEN="${DISCORD_BOT_TOKEN}"
DISCORD_BOT_TOKEN="${DISCORD_BOT_TOKEN}"
CLIENT_ID="${CLIENT_ID}"
GUILD_ID="${GUILD_ID}"
DISCORD_PUNISHMENT_WEBHOOK="${DISCORD_PUNISHMENT_WEBHOOK}"

# Internal Secrets
INTERNAL_SYNC_SECRET="${INTERNAL_SYNC_SECRET_GEN}"
VISION_JWT_SECRET="${VISION_JWT_SECRET_GEN}"
VISION_HMAC_SECRET="${VISION_HMAC_SECRET}"

# Roblox Config
ROBLOX_API_KEY="${ROBLOX_API_KEY}"

# Dashboard Config
DASHBOARD_URL="http://127.0.0.1:${PORT}"
NEXT_PUBLIC_APP_URL="${APP_URL}"
NEXTAUTH_URL="${APP_URL}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXT_PUBLIC_SYNC_URL="${WS_URL}"

# Clerk Auth
CLERK_SECRET_KEY="${CLERK_SECRET_KEY}"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}"

# AI Services
MISTRAL_API_KEY="${MISTRAL_API_KEY}"

# External APIs
GARMIN_API_URL="https://garminapi.ciankelly.xyz"
GARMIN_API_KEY="${GARMIN_API_KEY}"

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY="${POSTHOG_KEY}"
NEXT_PUBLIC_POSTHOG_HOST="https://a.atriasafety.org"
POSTHOG_PERSONAL_API_KEY="${POSTHOG_PERSONAL_KEY}"
POSTHOG_PROJECT_ID="${POSTHOG_PROJECT_ID}"

# Legal
NEXT_PUBLIC_LEGAL_URL="https://lacrp.ciankelly.xyz/project-overwatch-legal-documents"
EOL
    echo -e "${GREEN}New environment file created and saved in '${SHARED_DIR}/'.${NC}"
else
    echo -e "${GREEN}Existing environment file found in '${SHARED_DIR}/'.${NC}"
    # Ensure DATABASE_URL is set (PostgreSQL — not auto-generated, prompt if missing)
    if ! grep -q "DATABASE_URL=" "${SHARED_ENV_FILE}" || grep -q 'DATABASE_URL=""' "${SHARED_ENV_FILE}"; then
        echo -e "${RED}[MISSING] DATABASE_URL not set in ${TARGET_ENV^^} .env${NC}"
        read -p "PostgreSQL connection string (e.g. postgresql://pow:pass@localhost:5432/pow_prod): " DB_URL_INPUT
        sed -i '/^DATABASE_URL=/d' "${SHARED_ENV_FILE}" 2>/dev/null || true
        echo "DATABASE_URL=\"${DB_URL_INPUT}\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "PORT=" "${SHARED_ENV_FILE}"; then
        echo "PORT=\"$PORT\"" >> "${SHARED_ENV_FILE}"
    fi
    
    # Check for missing secrets and prompt if needed
    echo "Checking for missing environment variables..."
    
    # Auto-generated secrets
    if ! grep -q "VISION_JWT_SECRET=" "${SHARED_ENV_FILE}" || grep -q 'VISION_JWT_SECRET=""' "${SHARED_ENV_FILE}"; then
        echo "Adding missing VISION_JWT_SECRET..."
        sed -i '/^VISION_JWT_SECRET=/d' "${SHARED_ENV_FILE}" 2>/dev/null || true
        echo "VISION_JWT_SECRET=\"$(openssl rand -base64 32)\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "NEXTAUTH_SECRET=" "${SHARED_ENV_FILE}" || grep -q 'NEXTAUTH_SECRET=""' "${SHARED_ENV_FILE}"; then
        echo "Adding missing NEXTAUTH_SECRET..."
        sed -i '/^NEXTAUTH_SECRET=/d' "${SHARED_ENV_FILE}" 2>/dev/null || true
        echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "INTERNAL_SYNC_SECRET=" "${SHARED_ENV_FILE}" || grep -q 'INTERNAL_SYNC_SECRET=""' "${SHARED_ENV_FILE}"; then
        echo "Adding missing INTERNAL_SYNC_SECRET..."
        sed -i '/^INTERNAL_SYNC_SECRET=/d' "${SHARED_ENV_FILE}" 2>/dev/null || true
        echo "INTERNAL_SYNC_SECRET=\"$(openssl rand -base64 32)\"" >> "${SHARED_ENV_FILE}"
    fi
    
    # VISION_HMAC_SECRET must match the hardcoded value in the Vision desktop app
    if ! grep -q "VISION_HMAC_SECRET=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Vision HMAC Secret (default: pow-vision-hmac-secret-2024): " VISION_HMAC_INPUT
        VAL=${VISION_HMAC_INPUT:-"pow-vision-hmac-secret-2024"}
        echo "VISION_HMAC_SECRET=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    
    # Discord Config
    if ! grep -q "DISCORD_TOKEN=" "${SHARED_ENV_FILE}" && ! grep -q "DISCORD_BOT_TOKEN=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Discord Bot Token [${TARGET_ENV^^}]: " VAL
        echo "DISCORD_TOKEN=\"$VAL\"" >> "${SHARED_ENV_FILE}"
        echo "DISCORD_BOT_TOKEN=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "CLIENT_ID=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Discord Client ID [${TARGET_ENV^^}]: " VAL
        echo "CLIENT_ID=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "GUILD_ID=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Discord Guild ID [${TARGET_ENV^^}]: " VAL
        echo "GUILD_ID=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "DISCORD_PUNISHMENT_WEBHOOK=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Discord Punishment Webhook URL [${TARGET_ENV^^}]: " VAL
        echo "DISCORD_PUNISHMENT_WEBHOOK=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    
    # Clerk Auth - CRITICAL: Always verify these are present
    CLERK_SECRET_MISSING=false
    CLERK_PUBLISHABLE_MISSING=false

    if ! grep -q "CLERK_SECRET_KEY=" "${SHARED_ENV_FILE}"; then
        CLERK_SECRET_MISSING=true
    fi
    if ! grep -q "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" "${SHARED_ENV_FILE}"; then
        CLERK_PUBLISHABLE_MISSING=true
    fi

    if [ "$CLERK_SECRET_MISSING" = true ] || [ "$CLERK_PUBLISHABLE_MISSING" = true ]; then
        echo -e "${RED}[CRITICAL] Clerk authentication keys are missing!${NC}"
        echo "Without these, the API routes will return 404 errors."
        echo ""
        if [ "$CLERK_SECRET_MISSING" = true ]; then
            read -p "Clerk Secret Key [${TARGET_ENV^^}] - CLERK_SECRET_KEY: " VAL
            echo "CLERK_SECRET_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
        fi
        if [ "$CLERK_PUBLISHABLE_MISSING" = true ]; then
            read -p "Clerk Publishable Key [${TARGET_ENV^^}] - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " VAL
            echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
        fi
    fi
    
    # External API Keys
    if ! grep -q "ROBLOX_API_KEY=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Roblox API Key - Open Cloud: " VAL
        echo "ROBLOX_API_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "MISTRAL_API_KEY=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Mistral API Key: " VAL
        echo "MISTRAL_API_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "GARMIN_API_KEY=" "${SHARED_ENV_FILE}"; then
        read -p "Missing Garmin API Key: " VAL
        echo "GARMIN_API_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "NEXT_PUBLIC_POSTHOG_KEY=" "${SHARED_ENV_FILE}"; then
        read -p "Missing PostHog Project API Key: " VAL
        echo "NEXT_PUBLIC_POSTHOG_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    
    # Auto-set URLs if missing or invalid based on branch target
    if ! grep -q "DASHBOARD_URL=" "${SHARED_ENV_FILE}"; then
        echo "DASHBOARD_URL=\"http://127.0.0.1:${PORT}\"" >> "${SHARED_ENV_FILE}"
    fi

    if grep -q "NEXT_PUBLIC_APP_URL=" "${SHARED_ENV_FILE}"; then
        sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"${APP_URL}\"|" "${SHARED_ENV_FILE}"
    else
        echo "NEXT_PUBLIC_APP_URL=\"${APP_URL}\"" >> "${SHARED_ENV_FILE}"
    fi

    if grep -q "NEXTAUTH_URL=" "${SHARED_ENV_FILE}"; then
        sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"${APP_URL}\"|" "${SHARED_ENV_FILE}"
    else
        echo "NEXTAUTH_URL=\"${APP_URL}\"" >> "${SHARED_ENV_FILE}"
    fi

    if [ -n "$WS_URL" ]; then
        if grep -q "NEXT_PUBLIC_SYNC_URL=" "${SHARED_ENV_FILE}"; then
            sed -i "s|^NEXT_PUBLIC_SYNC_URL=.*|NEXT_PUBLIC_SYNC_URL=\"${WS_URL}\"|" "${SHARED_ENV_FILE}"
        else
            echo "NEXT_PUBLIC_SYNC_URL=\"${WS_URL}\"" >> "${SHARED_ENV_FILE}"
        fi
    fi
    if ! grep -q "GARMIN_API_URL=" "${SHARED_ENV_FILE}"; then
        echo "GARMIN_API_URL=\"https://garminapi.ciankelly.xyz\"" >> "${SHARED_ENV_FILE}"
    fi
    if grep -q "NEXT_PUBLIC_POSTHOG_HOST=" "${SHARED_ENV_FILE}"; then
        sed -i "s|^NEXT_PUBLIC_POSTHOG_HOST=.*|NEXT_PUBLIC_POSTHOG_HOST=\"https://a.atriasafety.org\"|" "${SHARED_ENV_FILE}"
    else
        echo "NEXT_PUBLIC_POSTHOG_HOST=\"https://a.atriasafety.org\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "NEXT_PUBLIC_LEGAL_URL=" "${SHARED_ENV_FILE}"; then
        echo "NEXT_PUBLIC_LEGAL_URL=\"https://lacrp.ciankelly.xyz/project-overwatch-legal-documents\"" >> "${SHARED_ENV_FILE}"
    fi
    if ! grep -q "DATA_DIR=" "${SHARED_ENV_FILE}"; then
        echo "DATA_DIR=\"${DATA_DIR}\"" >> "${SHARED_ENV_FILE}"
    fi
    # PostHog Status Dashboard keys
    if ! grep -q "POSTHOG_PERSONAL_API_KEY=" "${SHARED_ENV_FILE}"; then
        read -p "Missing PostHog Personal API Key - for status dashboard: " VAL
        echo "POSTHOG_PERSONAL_API_KEY=\"$VAL\"" >> "${SHARED_ENV_FILE}"
    fi
    if grep -q "POSTHOG_PROJECT_ID=" "${SHARED_ENV_FILE}"; then
        sed -i "s|^POSTHOG_PROJECT_ID=.*|POSTHOG_PROJECT_ID=\"${VAL}\"|" "${SHARED_ENV_FILE}"
    else
        echo "POSTHOG_PROJECT_ID=\"${VAL}\"" >> "${SHARED_ENV_FILE}"
    fi

    if grep -q "NEXT_PUBLIC_APP_ENV=" "${SHARED_ENV_FILE}"; then
        sed -i "s|^NEXT_PUBLIC_APP_ENV=.*|NEXT_PUBLIC_APP_ENV=\"${TARGET_ENV}\"|" "${SHARED_ENV_FILE}"
    else
        echo "NEXT_PUBLIC_APP_ENV=\"${TARGET_ENV}\"" >> "${SHARED_ENV_FILE}"
    fi
    
    echo -e "${GREEN}All required environment variables verified.${NC}"
fi

# FINAL VALIDATION: Absolutely ensure Clerk keys exist before proceeding
echo ""
echo -e "${YELLOW}[FINAL CHECK] Verifying critical Clerk authentication keys for ${TARGET_ENV^^}...${NC}"
if ! grep -q "CLERK_SECRET_KEY=" "${SHARED_ENV_FILE}"; then
    echo -e "${RED}[CRITICAL] CLERK_SECRET_KEY is MISSING from ${TARGET_ENV^^} .env file!${NC}"
    echo "This must be configured for the API to work correctly."
    read -p "Enter your Clerk Secret Key specifically for ${TARGET_ENV^^} - CLERK_SECRET_KEY: " CLERK_SK
    sed -i "/^CLERK_SECRET_KEY=/d" "${SHARED_ENV_FILE}" 2>/dev/null || true
    echo "CLERK_SECRET_KEY=\"${CLERK_SK}\"" >> "${SHARED_ENV_FILE}"
    echo -e "${GREEN}Added CLERK_SECRET_KEY for ${TARGET_ENV^^}${NC}"
fi

if ! grep -q "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" "${SHARED_ENV_FILE}"; then
    echo -e "${RED}[CRITICAL] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is MISSING from ${TARGET_ENV^^} .env file!${NC}"
    echo "This must be configured for the API to work correctly."
    read -p "Enter your Clerk Publishable Key specifically for ${TARGET_ENV^^} - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " CLERK_PK
    sed -i "/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=/d" "${SHARED_ENV_FILE}" 2>/dev/null || true
    echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\"${CLERK_PK}\"" >> "${SHARED_ENV_FILE}"
    echo -e "${GREEN}Added NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY for ${TARGET_ENV^^}${NC}"
fi

echo -e "${GREEN}[OK] Clerk keys verified and present in configuration.${NC}"
echo ""

# Show what DATABASE_URL is configured to (don't auto-overwrite)
echo "Verifying DATABASE_URL in .env..."
if grep -q "DATABASE_URL=" "${SHARED_ENV_FILE}"; then
    CURRENT_DB_URL=$(grep '^DATABASE_URL=' "${SHARED_ENV_FILE}")
    echo -e "${GREEN}DATABASE_URL configured: ${CURRENT_DB_URL}${NC}"
else
    echo -e "${RED}[ERROR] DATABASE_URL not found in ${SHARED_ENV_FILE}!${NC}"
    exit 1
fi

# Copy the shared .env to ALL required locations in the new release
echo "Copying .env to all required locations..."
cp "${SHARED_ENV_FILE}" "${NEW_RELEASE_DIR}/.env"
cp "${SHARED_ENV_FILE}" "${NEW_RELEASE_DIR}/dashboard/.env"
cp "${SHARED_ENV_FILE}" "${NEW_RELEASE_DIR}/dashboard/.env.local"
cp "${SHARED_ENV_FILE}" "${NEW_RELEASE_DIR}/bot/.env"
echo -e "${GREEN}Copied .env to: root, dashboard, dashboard/.env.local, and bot${NC}"

# CRITICAL VALIDATION: Verify Clerk keys are in the deployed .env files
echo ""
echo -e "${YELLOW}[VALIDATION] Verifying Clerk authentication keys in deployed files...${NC}"
CLERK_ISSUES=false

for ENV_LOCATION in "${NEW_RELEASE_DIR}/.env" "${NEW_RELEASE_DIR}/dashboard/.env" "${NEW_RELEASE_DIR}/dashboard/.env.local" "${NEW_RELEASE_DIR}/bot/.env"; do
    if [ -f "$ENV_LOCATION" ]; then
        if ! grep -q "CLERK_SECRET_KEY=" "$ENV_LOCATION"; then
            echo -e "${RED}[ERROR] CLERK_SECRET_KEY missing in $ENV_LOCATION${NC}"
            CLERK_ISSUES=true
        fi
        if ! grep -q "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" "$ENV_LOCATION"; then
            echo -e "${RED}[ERROR] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing in $ENV_LOCATION${NC}"
            CLERK_ISSUES=true
        fi
    else
        echo -e "${RED}[ERROR] .env file not found at $ENV_LOCATION${NC}"
        CLERK_ISSUES=true
    fi
done

if [ "$CLERK_ISSUES" = true ]; then
    echo ""
    echo -e "${RED}[CRITICAL] Clerk keys are missing or incomplete!${NC}"
    echo "Without these keys, API routes will return 404 errors."
    echo "Please update /shared/.env with the correct Clerk keys and run deploy.sh again."
    exit 1
fi

echo -e "${GREEN}[OK] All Clerk keys verified in deployed files.${NC}"

# --- 4. Install Dependencies ---
echo -e "${YELLOW}[4/8] Installing dependencies - this may take a moment...${NC}"

# Store the project root before changing directories
PROJECT_ROOT=$(pwd)

cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}"
npm install --silent --production=false 2>&1 | tail -5 || true
echo "Installing Dashboard dependencies..."
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard" && npm install --silent --production=false 2>&1 | tail -5 || true
echo "Installing Bot dependencies..."
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/bot" && npm install --silent --production=false 2>&1 | tail -5 || true
cd "${PROJECT_ROOT}"
echo -e "${GREEN}All dependencies installed.${NC}"

# --- 5. Database Setup ---
echo -e "${YELLOW}[5/8] Setting up database...${NC}"

# PROJECT_ROOT was already set in step 4

# Read DATABASE_URL from the shared env file so prisma uses the correct PostgreSQL connection
export DATABASE_URL=$(grep '^DATABASE_URL=' "${SHARED_ENV_FILE}" | sed 's/^DATABASE_URL="\(.*\)"$/\1/')
echo "DATABASE_URL: ${DATABASE_URL}"

# Apply any pending migrations (idempotent — safe to run on every deploy)
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard"
echo "Applying migrations..."
npx prisma migrate deploy
echo -e "${GREEN}Database setup complete.${NC}"

# Return to project root
cd "${PROJECT_ROOT}"

# Sync prisma schema to bot and generate clients
echo "Syncing Prisma schema to bot..."
PRISMA_SCHEMA="${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard/prisma/schema.prisma"

# Debug: Show what we're looking for
echo "Looking for prisma schema at: ${PRISMA_SCHEMA}"
ls -la "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/" 2>/dev/null || echo "Release dir not found"

if [ -f "${PRISMA_SCHEMA}" ]; then
    mkdir -p "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/bot/prisma"
    cp "${PRISMA_SCHEMA}" "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/bot/prisma/schema.prisma"
    echo "Prisma schema copied to bot."
else
    echo -e "${RED}[ERROR] Prisma schema not found at ${PRISMA_SCHEMA}${NC}"
    echo "Contents of release directory:"
    ls -la "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/"
    if [ -d "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard" ]; then
        echo "Contents of dashboard directory:"
        ls -la "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard/"
    fi
    exit 1
fi

echo "Generating Prisma Clients..."
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard" && npx prisma generate
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/bot" && npx prisma generate
cd "${PROJECT_ROOT}"
echo -e "${GREEN}Prisma clients generated.${NC}"

# --- 6. Build Projects ---
echo -e "${YELLOW}[6/8] Building Dashboard project...${NC}"
cd "${PROJECT_ROOT}/${NEW_RELEASE_DIR}/dashboard"
# If build fails, script will exit thanks to 'set -e'
npm run build
echo -e "${GREEN}Dashboard build complete.${NC}"
cd "${PROJECT_ROOT}"

# --- 7. Go Live! ---
echo -e "${YELLOW}[7/8] Activating new release...${NC}"

# Make sure we're in the project root
cd "${PROJECT_ROOT}"

# Create absolute path for symlink
FULL_NEW_RELEASE_PATH="${PROJECT_ROOT}/${NEW_RELEASE_DIR}"

# Atomically switch the 'current' symlink to the new release directory
# Remove old symlink first, then create new one
rm -f "${CURRENT_SYMLINK}"
ln -sfn "${FULL_NEW_RELEASE_PATH}" "${CURRENT_SYMLINK}"

echo -e "Symlink '${CURRENT_SYMLINK}' now points to ${GREEN}${FULL_NEW_RELEASE_PATH}${NC}"

# Verify symlink is correct
echo "Verifying symlink:"
ls -la "${CURRENT_SYMLINK}"

# Use PM2 to restart only the TARGET environment's apps.
# We export APP_ENV so ecosystem.config.js generates the right process names and cwd.
echo "Restarting applications for ${TARGET_ENV^^} with PM2..."
pm2 delete pow-dashboard-${TARGET_ENV} 2>/dev/null || true
pm2 delete pow-bot-${TARGET_ENV} 2>/dev/null || true
pm2 delete pow-sync-${TARGET_ENV} 2>/dev/null || true

# Clean up legacy PM2 naming (pre-per-env-symlink era)
if [ "$TARGET_ENV" == "prod" ]; then
    pm2 delete pow-dashboard 2>/dev/null || true
    pm2 delete pow-bot 2>/dev/null || true
    pm2 delete pow-sync 2>/dev/null || true
fi

# Start only this environment's processes.
# APP_ENV is already exported above; ecosystem.config.js reads it to build
# process names and the correct current-${TARGET_ENV} symlink path.
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}Applications reloaded successfully! Your new version is LIVE.${NC}"

# --- 8. Cleanup ---
echo -e "${YELLOW}[8/8] Cleaning up old releases...${NC}"
# Find all release directories, sort them by name (timestamp), and keep the newest ones.
OLD_RELEASES=$(ls -r1 "${RELEASES_DIR}" | tail -n +$((RELEASES_TO_KEEP+1)))
if [ -n "${OLD_RELEASES}" ]; then
    for release in ${OLD_RELEASES}; do
        echo "Deleting old release: ${RELEASES_DIR}/${release}"
        rm -rf "${RELEASES_DIR}/${release}"
    done
    echo -e "${GREEN}Cleanup complete.${NC}"
else
    echo "No old releases to clean up."
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}   🚀 DEPLOYMENT COMPLETE! 🚀   ${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 logs          - View live application logs"
echo "  pm2 status        - Show service status"
echo ""

# =================================================================
# EMERGENCY ROLLBACK INSTRUCTIONS
#
# If the new release is broken, you can quickly roll back.
#
# 1. List previous successful releases:
#    ls -l releases
#
# 2. Pick the timestamp of the last good version (e.g., 20251230120000)
#    and run this command to point 'current' back to it:
#
#    ln -sfn releases/PASTE_TIMESTAMP_HERE current
#
# 3. Reload the apps to switch back to the old code:
#    pm2 reload all
#
# =================================================================
