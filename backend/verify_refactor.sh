#!/bin/bash
# Verification script for the refactored AI Agent Launchpad
# Note: Run this script from the repository root directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"

echo "=================================="
echo "Refactoring Verification Script"
echo "=================================="
echo "Backend directory: $BACKEND_DIR"
echo ""

# Check that old web_endpoint decorators are gone
echo "1. Checking for old @modal.web_endpoint decorators..."
OLD_ENDPOINTS=$(grep -c "^@modal.web_endpoint" "$BACKEND_DIR/modal_app.py" 2>/dev/null || true)
if [ -z "$OLD_ENDPOINTS" ] || [ "$OLD_ENDPOINTS" = "0" ]; then
    echo "   ✅ No old @modal.web_endpoint decorators found"
else
    echo "   ❌ Found $OLD_ENDPOINTS old @modal.web_endpoint decorators"
    exit 1
fi
echo ""

# Check for new asgi_app decorator
echo "2. Checking for new @modal.asgi_app decorator..."
ASGI_APP=$(grep -c "^@modal.asgi_app()" "$BACKEND_DIR/modal_app.py")
if [ "$ASGI_APP" -eq 1 ]; then
    echo "   ✅ Found @modal.asgi_app() decorator"
else
    echo "   ❌ Expected 1 @modal.asgi_app() decorator, found $ASGI_APP"
    exit 1
fi
echo ""

# Check for Pydantic models
echo "3. Checking for Pydantic request/response models..."
PYDANTIC_MODELS=$(grep -c "class.*Request\|class.*Response" "$BACKEND_DIR/modal_app.py")
if [ "$PYDANTIC_MODELS" -ge 4 ]; then
    echo "   ✅ Found $PYDANTIC_MODELS Pydantic models"
else
    echo "   ❌ Expected at least 4 Pydantic models, found $PYDANTIC_MODELS"
    exit 1
fi
echo ""

# Check for FastAPI routes
echo "4. Checking for FastAPI routes..."
GET_ROUTES=$(grep -c "@web_app.get" "$BACKEND_DIR/modal_app.py")
POST_ROUTES=$(grep -c "@web_app.post" "$BACKEND_DIR/modal_app.py")
DELETE_ROUTES=$(grep -c "@web_app.delete" "$BACKEND_DIR/modal_app.py")
TOTAL_ROUTES=$((GET_ROUTES + POST_ROUTES + DELETE_ROUTES))

echo "   - GET routes: $GET_ROUTES"
echo "   - POST routes: $POST_ROUTES"
echo "   - DELETE routes: $DELETE_ROUTES"

if [ "$TOTAL_ROUTES" -ge 4 ]; then
    echo "   ✅ Found $TOTAL_ROUTES FastAPI routes (expected at least 4)"
else
    echo "   ❌ Expected at least 4 routes, found $TOTAL_ROUTES"
    exit 1
fi
echo ""

# Check for exception handlers
echo "5. Checking for exception handlers..."
EXCEPTION_HANDLERS=$(grep -c "@web_app.exception_handler" "$BACKEND_DIR/modal_app.py")
if [ "$EXCEPTION_HANDLERS" -ge 2 ]; then
    echo "   ✅ Found $EXCEPTION_HANDLERS exception handlers"
else
    echo "   ❌ Expected at least 2 exception handlers, found $EXCEPTION_HANDLERS"
    exit 1
fi
echo ""

# Check that ElizaOS server function is still there
echo "6. Checking ElizaOS server function..."
ELIZA_SERVER=$(grep -c "@modal.web_server" "$BACKEND_DIR/modal_app.py")
if [ "$ELIZA_SERVER" -eq 1 ]; then
    echo "   ✅ ElizaOS server function preserved"
else
    echo "   ❌ ElizaOS server function not found or duplicated"
    exit 1
fi
echo ""

# Check documentation updates
echo "7. Checking documentation updates..."
QUICKSTART_UPDATED=$(grep -c "agentica-platform-api.modal.run" "$BACKEND_DIR/QUICKSTART.md")
DEPLOYMENT_UPDATED=$(grep -c "agentica-platform-api.modal.run" "$BACKEND_DIR/DEPLOYMENT.md")

if [ "$QUICKSTART_UPDATED" -ge 3 ]; then
    echo "   ✅ QUICKSTART.md updated with new URLs"
else
    echo "   ⚠️  QUICKSTART.md may need more URL updates (found $QUICKSTART_UPDATED)"
fi

if [ "$DEPLOYMENT_UPDATED" -ge 3 ]; then
    echo "   ✅ DEPLOYMENT.md updated with new URLs"
else
    echo "   ⚠️  DEPLOYMENT.md may need more URL updates (found $DEPLOYMENT_UPDATED)"
fi
echo ""

# Check file sizes
echo "8. Comparing file sizes..."
if [ -f "$BACKEND_DIR/modal_app_old.py" ]; then
    OLD_SIZE=$(wc -l < "$BACKEND_DIR/modal_app_old.py")
    NEW_SIZE=$(wc -l < "$BACKEND_DIR/modal_app.py")
    REDUCTION=$((OLD_SIZE - NEW_SIZE))

    echo "   - Old: $OLD_SIZE lines"
    echo "   - New: $NEW_SIZE lines"

    if [ "$NEW_SIZE" -le "$OLD_SIZE" ]; then
        echo "   ✅ Refactored code is more concise (reduced by $REDUCTION lines)"
    else
        echo "   ⚠️  Refactored code is longer (increased by $((NEW_SIZE - OLD_SIZE)) lines)"
    fi
else
    echo "   ⚠️  modal_app_old.py not found for comparison"
fi
echo ""

# Summary
echo "=================================="
echo "✅ All verification checks passed!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Deploy: modal deploy backend/modal_app.py"
echo "2. Test:   modal run backend/modal_app.py"
echo "3. Verify: Check logs with 'modal app logs agentica-platform'"
echo ""
echo "API Documentation will be available at:"
echo "  - Swagger UI: https://YOUR_ORG--agentica-platform-api.modal.run/docs"
echo "  - ReDoc:      https://YOUR_ORG--agentica-platform-api.modal.run/redoc"
echo ""
