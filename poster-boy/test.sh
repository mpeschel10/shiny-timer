. ../.env
NATURAL_ROOT="localhost:$PORT"

[ "$(curl -s $NATURAL_ROOT/app-name.txt)" = shiny-timer ] || {
    cd ..
    node server.mjs &
    CHILD_PID=$!
    echo "Starting shiny-timer server..."
    sleep 1 # Should be long enough?
    cd poster-boy
}

[ -z "$PROXY_ROOT" ] && PROXY_ROOT="$NATURAL_ROOT"
[ "$(curl -s $PROXY_ROOT/app-name.txt)" = shiny-timer ] || {
    echo "shiny-timer sanity test failed. Is proxy server running?"
    [ -z "$CHILD_PID" ] || kill "$CHILD_PID"
    exit 2
}

# This seems like a leaky to clean up...
[ -z "$CHILD_PID" ] || kill "$CHILD_PID"

