"""
Direct test of SharePoint folder path resolution
Tests the path directly without relying on environment variables
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sharepoint_client import SharePointClient
import logging

# Enable logging
logging.basicConfig(level=logging.DEBUG)

print("=" * 80)
print("Direct SharePoint Folder Path Test")
print("=" * 80)

# Override folder path for this test
os.environ["SHAREPOINT_FOLDER_PATH"] = "/Bid/SXRepository"

try:
    print("\n[1] Creating SharePoint client...")
    client = SharePointClient()
    
    print(f"[INFO] Folder path from env: {client.folder_path}")
    print(f"[INFO] Site ID: {client.site_id}")
    print(f"[INFO] Drive ID: {client.drive_id}")
    
    print("\n[2] Testing path-based listing...")
    # Force path-based listing
    files = client._list_files_by_path("/Bid/SXRepository", recursive=False)
    
    print(f"\n[RESULT] Files found: {len(files)}")
    
    if len(files) > 0:
        print("\n[SUCCESS] Path-based listing works!")
        print(f"\nFirst 5 files:")
        for i, file_info in enumerate(files[:5], 1):
            name = file_info.get('name', 'Unknown')
            size = file_info.get('size', 0)
            print(f"  {i}. {name} ({size} bytes)")
    else:
        print("\n[WARN] No files found with path-based method")
        print("\n[3] Trying alternative: list_files_in_folder with path...")
        
        # Try the main method
        files2 = client.list_files_in_folder(recursive=False)
        print(f"[RESULT] Files found via main method: {len(files2)}")
        
        if len(files2) > 0:
            print("\n[SUCCESS] Main method works!")
            for i, file_info in enumerate(files2[:5], 1):
                name = file_info.get('name', 'Unknown')
                print(f"  {i}. {name}")
        else:
            print("\n[INFO] Check backend logs for detailed error messages")
            print("[INFO] The path might need to be tested in Graph Explorer")
            
except Exception as e:
    print(f"\n[ERROR] Test failed: {e}")
    import traceback
    traceback.print_exc()

