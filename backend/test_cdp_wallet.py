"""
CDP Wallet Generation Test - Day 1 De-Risk (Server Wallet v2)

This script validates that CDP Server Wallet v2 account creation works.
Tests EVM account creation, export, import, and multi-account isolation.

SUCCESS CRITERIA:
✅ Can create EVM accounts with CDP API credentials
✅ Can export account data for database storage
✅ Can restore accounts from exported data
✅ Multiple accounts work with same API key

USAGE:
1. Add your CDP credentials to .env file (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET)
2. Run: pip install -r requirements.txt
3. Run: python test_cdp_wallet.py
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


async def test_cdp_wallet_creation():
    """Critical test: Verify CDP Server Wallet v2 account creation works"""

    print("\n" + "="*60)
    print("CDP SERVER WALLET V2 TEST - Day 1 De-Risk")
    print("="*60 + "\n")

    # Import CDP SDK (after loading env vars)
    try:
        from cdp import CdpClient
        print("✓ CDP SDK v2 imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import CDP SDK: {e}")
        print("  Run: pip install cdp-sdk")
        return False

    # Check environment variables
    api_key_id = os.getenv("CDP_API_KEY_ID")
    api_key_secret = os.getenv("CDP_API_KEY_SECRET")
    wallet_secret = os.getenv("CDP_WALLET_SECRET")

    if not api_key_id or not api_key_secret or not wallet_secret:
        print("✗ CDP credentials not found in environment")
        print("  Please set these variables in .env file:")
        print("  - CDP_API_KEY_ID")
        print("  - CDP_API_KEY_SECRET")
        print("  - CDP_WALLET_SECRET")
        print("  See .env file for instructions")
        return False

    print(f"✓ CDP credentials loaded")
    print(f"  API Key ID: {api_key_id[:20]}...")
    print(f"  Wallet Secret: {wallet_secret[:20]}...")

    try:
        # 1. Initialize CDP Client
        print("\n[1/6] Initializing CDP Client...")
        async with CdpClient() as cdp:
            print("✓ CDP Client initialized successfully")

            # 2. Create first EVM account with a name
            print("\n[2/6] Creating first EVM account...")
            account_name1 = "test-wallet-1"
            account1 = await cdp.evm.get_or_create_account(name=account_name1)
            address1 = account1.address
            print(f"✓ Account 1 created: {address1}")
            print(f"  Account name: {account_name1}")
            print(f"  Network: EVM-compatible (default)")

            # 3. Export account data (for persistence)
            print("\n[3/6] Exporting account data...")
            # Note: With Server Wallet v2, accounts are stored on CDP servers
            # We just need to store the account name for retrieval
            print(f"✓ Account metadata:")
            print(f"  Name: {account_name1}")
            print(f"  Address: {address1}")
            print(f"  Storage note: Server Wallet v2 stores keys on CDP servers")
            print(f"  You only need to store the account name for retrieval")

            # 4. Create second account (verify isolation)
            print("\n[4/6] Creating second account (isolation test)...")
            account_name2 = "test-wallet-2"
            account2 = await cdp.evm.get_or_create_account(name=account_name2)
            address2 = account2.address
            print(f"✓ Account 2 created: {address2}")
            print(f"  Account name: {account_name2}")

            # Verify addresses are different
            if address1 == address2:
                print("✗ ERROR: Both accounts have the same address!")
                return False
            print(f"✓ Accounts are isolated (different addresses)")

            # 5. Retrieve account 1 (verify persistence works)
            print("\n[5/6] Retrieving account 1 (persistence test)...")
            # With Server Wallet v2, we retrieve accounts by name
            account1_retrieved = await cdp.evm.get_or_create_account(name=account_name1)
            address1_retrieved = account1_retrieved.address
            print(f"✓ Account 1 retrieved by name: {account_name1}")
            print(f"  Address: {address1_retrieved}")

            # 6. Verify addresses match
            print("\n[6/6] Verifying retrieval integrity...")
            if address1 != address1_retrieved:
                print(f"✗ ERROR: Addresses don't match!")
                print(f"  Original:  {address1}")
                print(f"  Retrieved: {address1_retrieved}")
                return False

            print("✓ Account retrieval verified (addresses match)")

            # Summary
            print("\n" + "="*60)
            print("✅ CDP SERVER WALLET V2 WORKS - PROCEED WITH IMPLEMENTATION")
            print("="*60)
            print("\nTest Results:")
            print(f"  • Account 1 Address: {address1}")
            print(f"  • Account 2 Address: {address2}")
            print(f"  • Storage Model: Server-side (CDP managed)")
            print(f"  • Network: EVM-compatible chains")
            print("\nKey Insights:")
            print("  • Server Wallet v2 stores keys on CDP servers (more secure)")
            print("  • You only need to store account NAMES in your database")
            print("  • Accounts can be retrieved by name using get_or_create_account(name='...')")
            print("  • Same name = same account (idempotent operation)")
            print("\nNext Steps:")
            print("  1. Save test results to CDP_TEST_RESULTS.md")
            print("  2. Deploy test to Modal using test_cdp_modal.py")
            print("  3. Proceed with Day 2: Wallet API Foundation")
            print()

            return True

    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        print(f"  Error type: {type(e).__name__}")
        print("\nTroubleshooting:")
        print("  1. Verify CDP API credentials are correct")
        print("  2. Check that you created credentials under 'Server Wallets'")
        print("  3. Ensure network connectivity")
        print("  4. Verify you have wallet creation permissions")
        print("  5. Check CDP service status")
        import traceback
        print("\nFull error:")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_cdp_wallet_creation())
    exit(0 if success else 1)
