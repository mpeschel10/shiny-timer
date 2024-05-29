function main {
    if [ -z "$REMOTE_STAGING" ]; then
        echo "This script expects the REMOTE_STAGING environment variable to be set."
        return
    fi

    echo "Uploading to REMOTE_STAGING $REMOTE_STAGING"
    rsync -av --delete-excluded ./ \
        --include "serve/***" \
        --include "deploy/***" \
        --include server.mjs --include copyright --include .env \
        --exclude "/**" "$REMOTE_STAGING"
}

main

