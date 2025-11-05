"""
Quick test with corrected folder path: /Bid/SXRepository
"""

import os
import sys
import requests

# Set the correct folder path for this test
os.environ["SHAREPOINT_FOLDER_PATH"] = "/Bid/SXRepository"

BASE_URL = "http://localhost:8000"

print("=" * 80)
print("Testing with corrected folder path: /Bid/SXRepository")
print("=" * 80)

# Test 1: Connection
print("\n[TEST 1] Testing connection...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/test-connection")
    response.raise_for_status()
    data = response.json()
    print(f"[OK] Connection: {data.get('status')}")
except Exception as e:
    print(f"[FAIL] Connection failed: {e}")
    sys.exit(1)

# Test 2: List files with corrected path
print("\n[TEST 2] Listing files with path: /Bid/SXRepository...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/list-files")
    response.raise_for_status()
    data = response.json()
    count = data.get('count', 0)
    files = data.get('files', [])
    
    print(f"[OK] Status: {data.get('status')}")
    print(f"[OK] Files found: {count}")
    
    if count > 0:
        print(f"\n[SUCCESS] Found {count} files!")
        print(f"\nFirst 5 files:")
        for i, file_info in enumerate(files[:5], 1):
            name = file_info.get('name', 'Unknown')
            size = file_info.get('size', 0)
            file_type = file_info.get('mimeType', 'Unknown')
            print(f"  {i}. {name} ({size} bytes, {file_type})")
        print("\n[SUCCESS] Folder path is working correctly!")
    else:
        print("\n[WARN] Still 0 files found. Check:")
        print("  1. Folder path is correct: /Bid/SXRepository")
        print("  2. Folder exists in SharePoint")
        print("  3. Backend logs for errors")
except Exception as e:
    print(f"[FAIL] List files failed: {e}")
    if 'response' in locals():
        print(f"   Response: {response.text[:500]}")

