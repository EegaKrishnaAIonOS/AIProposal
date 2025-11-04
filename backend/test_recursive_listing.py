"""
Test recursive listing with correct folder path
"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 80)
print("Testing Recursive File Listing")
print("=" * 80)

# Test 1: Check if we can see folders
print("\n[TEST 1] Testing folder listing (non-recursive)...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/list-files?recursive=false")
    data = response.json()
    print(f"   Status: {data.get('status')}")
    print(f"   Files (non-recursive): {data.get('count')}")
    print(f"   Folders: {data.get('total_folders', 0)}")
    
    folders = data.get('folders', [])
    if folders:
        print(f"\n   Found {len(folders)} subfolders:")
        for folder in folders[:5]:
            print(f"     - {folder.get('name')} (childCount: {folder.get('childCount', 0)})")
except Exception as e:
    print(f"   [ERROR] {e}")

# Test 2: Recursive listing
print("\n[TEST 2] Testing recursive file listing...")
try:
    response = requests.get(f"{BASE_URL}/api/sharepoint/list-files?recursive=true")
    data = response.json()
    print(f"   Status: {data.get('status')}")
    print(f"   Files found (recursive): {data.get('count')}")
    print(f"   Folders: {data.get('total_folders', 0)}")
    
    files = data.get('files', [])
    if files:
        print(f"\n   [SUCCESS] Found {len(files)} files!")
        print(f"\n   First 5 files:")
        for i, file_info in enumerate(files[:5], 1):
            name = file_info.get('name', 'Unknown')
            size = file_info.get('size', 0)
            file_type = file_info.get('mimeType', 'Unknown')
            print(f"     {i}. {name} ({size} bytes, {file_type})")
    else:
        print("\n   [WARN] Still 0 files found")
        print("\n   Troubleshooting:")
        print("   1. Check backend logs for errors")
        print("   2. Verify .env has: SHAREPOINT_FOLDER_PATH=/Bid/SXRepository")
        print("   3. Restart backend server to load code changes")
        print("   4. Check backend terminal for Graph API errors")
        
except Exception as e:
    print(f"   [ERROR] {e}")

print("\n" + "=" * 80)
print("Next Steps:")
print("=" * 80)
print("1. If folders > 0 but files = 0: Check backend logs for recursive traversal errors")
print("2. If folders = 0: Verify folder path is correct in .env")
print("3. Restart backend server to ensure code changes are loaded")
print("4. Check backend terminal output for detailed error messages")
print("=" * 80)

