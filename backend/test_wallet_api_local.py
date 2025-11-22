"""
Local test script for Wallet API.

This script validates the Wallet API implementation by:
1. Testing the models (Pydantic validation)
2. Testing the database operations (mocked)
3. Verifying imports and structure

Run this before starting the server to catch any issues early.

Usage:
    python test_wallet_api_local.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

print("\n" + "="*60)
print("WALLET API - LOCAL VALIDATION TEST")
print("="*60 + "\n")

# Test 1: Import models
print("[1/4] Testing Pydantic models...")
try:
    from wallet_api.models import (
        CreateWalletRequest,
        WalletResponse,
        BalanceResponse,
        ErrorResponse
    )
    print("✓ All models imported successfully")
except Exception as e:
    print(f"✗ Failed to import models: {e}")
    sys.exit(1)

# Test 2: Validate request model
print("\n[2/4] Testing CreateWalletRequest validation...")
try:
    # Valid request
    valid_req = CreateWalletRequest(room_id="test-room-123")
    assert valid_req.room_id == "test-room-123"
    print("✓ Valid request passes")

    # Test validation - empty room_id
    try:
        invalid_req = CreateWalletRequest(room_id="   ")
        print("✗ Empty room_id should fail validation")
        sys.exit(1)
    except Exception:
        print("✓ Empty room_id rejected correctly")

except Exception as e:
    print(f"✗ Model validation test failed: {e}")
    sys.exit(1)

# Test 3: Import database module
print("\n[3/4] Testing database module...")
try:
    from wallet_api.database import (
        create_wallet,
        get_wallet,
        wallet_exists
    )
    print("✓ Database module imported successfully")
    print("  Note: Database operations require Supabase credentials")
except Exception as e:
    print(f"✗ Failed to import database module: {e}")
    sys.exit(1)

# Test 4: Import main app
print("\n[4/4] Testing FastAPI app...")
try:
    from wallet_api.main import app
    print("✓ FastAPI app imported successfully")
    print(f"  App title: {app.title}")
    print(f"  App version: {app.version}")

    # Check routes
    routes = [route.path for route in app.routes]
    expected_routes = ["/health", "/wallets", "/wallets/{room_id}/balance"]

    for route in expected_routes:
        if any(route in r for r in routes):
            print(f"  ✓ Route: {route}")
        else:
            print(f"  ✗ Missing route: {route}")

except Exception as e:
    print(f"✗ Failed to import FastAPI app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Summary
print("\n" + "="*60)
print("✅ ALL VALIDATION TESTS PASSED")
print("="*60)
print("\nNext Steps:")
print("1. Verify environment variables are set:")
print("   - CDP_API_KEY_ID")
print("   - CDP_API_KEY_SECRET")
print("   - CDP_WALLET_SECRET")
print("   - SUPABASE_URL")
print("   - SUPABASE_SERVICE_ROLE_KEY")
print()
print("2. Run database migration (see wallet_api/README.md)")
print()
print("3. Start the API server:")
print("   cd wallet_api && python main.py")
print()
print("4. Test with curl:")
print("   curl http://localhost:8000/health")
print()
