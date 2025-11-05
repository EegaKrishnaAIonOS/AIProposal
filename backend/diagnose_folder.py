"""
Diagnostic script to test different folder path formats
"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 80)
print("Folder Path Diagnostic Test")
print("=" * 80)

# Test 1: Check current status
print("\n[1] Checking current SharePoint status...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/status")
    data = response.json()
    print(f"   Status: {data.get('status')}")
    print(f"   Connected: {data.get('connected')}")
    print(f"   Has Sync: {data.get('has_initial_sync')}")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 2: List files
print("\n[2] Testing list-files endpoint...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/list-files")
    data = response.json()
    print(f"   Status: {data.get('status')}")
    print(f"   Files found: {data.get('count')}")
    
    if data.get('count') == 0:
        print("\n   [WARN] Still 0 files found!")
        print("\n   Possible issues:")
        print("   1. Backend server needs restart after .env update")
        print("   2. Folder path in .env might still be wrong")
        print("   3. Check backend logs for Graph API errors")
        print("   4. Verify folder exists in SharePoint")
        print("\n   Action required:")
        print("   - Update backend/.env: SHAREPOINT_FOLDER_PATH=/Bid/SXRepository")
        print("   - Restart backend server")
        print("   - Check backend terminal for error messages")
    else:
        print(f"\n   [SUCCESS] Found {data.get('count')} files!")
        files = data.get('files', [])[:5]
        for i, f in enumerate(files, 1):
            print(f"     {i}. {f.get('name')}")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 3: Connection test
print("\n[3] Testing connection...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/test-connection")
    data = response.json()
    print(f"   Status: {data.get('status')}")
    print(f"   Site ID: {data.get('site_id', 'N/A')[:50]}...")
except Exception as e:
    print(f"   [ERROR] {e}")

print("\n" + "=" * 80)
print("Next Steps:")
print("=" * 80)
print("1. Verify backend/.env has: SHAREPOINT_FOLDER_PATH=/Bid/SXRepository")
print("2. Restart the backend server (stop and start again)")
print("3. Check backend terminal logs for Graph API errors")
print("4. Re-run this diagnostic: python backend/diagnose_folder.py")
print("=" * 80)

