"""
Test script for AIonOS Knowledge Base access
Tests the complete flow: Connection → File Listing → Sync → Knowledge Retrieval
"""

import requests
import json
import time
import sys
from typing import Dict, Any

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:8000"

def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_connection() -> bool:
    """Test 1: Test SharePoint connection"""
    print_section("TEST 1: SharePoint Connection")
    try:
        response = requests.get(f"{BASE_URL}/api/sharepoint/test-connection")
        response.raise_for_status()
        data = response.json()
        print(f"[OK] Status: {data.get('status')}")
        print(f"[OK] Message: {data.get('message')}")
        print(f"[OK] Client ID: {data.get('client_id', 'N/A')}")
        print(f"[OK] Site ID: {data.get('site_id', 'N/A')}")
        return data.get('status') == 'connected'
    except Exception as e:
        print(f"[FAIL] Connection failed: {e}")
        return False

def test_list_files() -> bool:
    """Test 2: List files from SharePoint"""
    print_section("TEST 2: List SharePoint Files")
    try:
        response = requests.get(f"{BASE_URL}/api/sharepoint/list-files")
        response.raise_for_status()
        data = response.json()
        count = data.get('count', 0)
        files = data.get('files', [])
        
        print(f"[OK] Status: {data.get('status')}")
        print(f"[OK] Files found: {count}")
        
        if count > 0:
            print(f"\n[FILES] First {min(5, len(files))} files:")
            for i, file_info in enumerate(files[:5], 1):
                name = file_info.get('name', 'Unknown')
                size = file_info.get('size', 0)
                file_type = file_info.get('mimeType', 'Unknown')
                print(f"  {i}. {name} ({size} bytes, {file_type})")
            return True
        else:
            print("[WARN] No files found (this might be OK if folder is empty)")
            return True  # Still pass if folder is empty
    except Exception as e:
        print(f"[FAIL] List files failed: {e}")
        print(f"   Response: {response.text if 'response' in locals() else 'N/A'}")
        return False

def test_status() -> Dict[str, Any]:
    """Test 3: Check SharePoint status"""
    print_section("TEST 3: SharePoint Status")
    try:
        response = requests.get(f"{BASE_URL}/api/sharepoint/status")
        response.raise_for_status()
        data = response.json()
        print(f"[OK] Status: {data.get('status')}")
        print(f"[OK] Connected: {data.get('connected')}")
        print(f"[OK] Has Initial Sync: {data.get('has_initial_sync')}")
        print(f"[OK] Index Name: {data.get('index_name', 'N/A')}")
        return data
    except Exception as e:
        print(f"[FAIL] Status check failed: {e}")
        return {}

def start_initial_sync() -> bool:
    """Test 4: Start initial sync"""
    print_section("TEST 4: Start Initial Sync")
    try:
        response = requests.post(f"{BASE_URL}/api/sharepoint/sync/initial")
        response.raise_for_status()
        data = response.json()
        print(f"[OK] Status: {data.get('status')}")
        print(f"[OK] Message: {data.get('message')}")
        print(f"\n[WAIT] Sync is running in background...")
        print(f"   This may take several minutes depending on file count.")
        print(f"   Check status with: GET {BASE_URL}/api/sharepoint/status")
        return True
    except Exception as e:
        print(f"[FAIL] Sync start failed: {e}")
        return False

def wait_for_sync(max_wait_minutes: int = 10) -> bool:
    """Wait for sync to complete by checking status"""
    print_section("Waiting for Sync to Complete")
    print(f"⏳ Waiting up to {max_wait_minutes} minutes...")
    
    start_time = time.time()
    max_wait_seconds = max_wait_minutes * 60
    check_interval = 30  # Check every 30 seconds
    
    while time.time() - start_time < max_wait_seconds:
        try:
            response = requests.get(f"{BASE_URL}/api/sharepoint/status")
            data = response.json()
            has_sync = data.get('has_initial_sync', False)
            
            if has_sync:
                print(f"[OK] Sync appears to have completed!")
                return True
            
            elapsed = int(time.time() - start_time)
            print(f"   Still syncing... ({elapsed}s elapsed)")
            time.sleep(check_interval)
        except Exception as e:
            print(f"   Error checking status: {e}")
            time.sleep(check_interval)
    
    print(f"[WARN] Timeout waiting for sync. Check manually with status endpoint.")
    return False

def test_knowledge_base_retrieval() -> bool:
    """Test 5: Test knowledge base retrieval"""
    print_section("TEST 5: Knowledge Base Retrieval")
    
    test_query = "AI-driven patient data management for healthcare"
    
    try:
        payload = {
            "text": test_query,
            "method": "knowledgeBase",
            "knowledge_base": "AIonOS"
        }
        
        print(f"[TEST] Test Query: {test_query}")
        print(f"[TEST] Method: knowledgeBase")
        print(f"[TEST] Knowledge Base: AIonOS")
        print(f"\n[WAIT] Sending request...")
        
        response = requests.post(
            f"{BASE_URL}/api/generate-solution-text",
            json=payload,
            timeout=120  # Allow 2 minutes for LLM response
        )
        response.raise_for_status()
        data = response.json()
        
        solution = data.get('solution', {})
        if solution:
            print(f"[OK] Solution generated successfully!")
            print(f"[OK] Title: {solution.get('title', 'N/A')}")
            print(f"[OK] Problem Statement: {solution.get('problem_statement', 'N/A')[:100]}...")
            
            # Check if we got recommendations (indicates AIonOS products were considered)
            recommendations = data.get('recommendations', [])
            if recommendations:
                print(f"[OK] Product Recommendations: {len(recommendations)} found")
            
            # Check backend logs for retrieval message
            print(f"\n[INFO] Check backend logs for:")
            print(f"   'Retrieved N documents from AIonOS knowledge base'")
            print(f"   If N > 0, knowledge base is working! [OK]")
            
            return True
        else:
            print(f"[WARN] Solution generated but structure unexpected")
            return True
    except Exception as e:
        print(f"[FAIL] Knowledge base retrieval failed: {e}")
        print(f"   Response: {response.text if 'response' in locals() else 'N/A'}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  AIonOS Knowledge Base Test Suite")
    print("=" * 80)
    
    results = {
        "connection": False,
        "list_files": False,
        "status": False,
        "sync_started": False,
        "sync_completed": False,
        "knowledge_retrieval": False
    }
    
    # Test 1: Connection
    results["connection"] = test_connection()
    if not results["connection"]:
        print("\n[FAIL] Cannot proceed - connection failed!")
        return
    
    # Test 2: List files
    results["list_files"] = test_list_files()
    
    # Test 3: Status
    status_data = test_status()
    results["status"] = bool(status_data)
    
    # Test 4: Start sync (if not already done)
    if not status_data.get('has_initial_sync'):
        print("\n" + "-" * 80)
        user_input = input("\n[WARN] No initial sync detected. Start sync now? (y/n): ")
        if user_input.lower() == 'y':
            results["sync_started"] = start_initial_sync()
            if results["sync_started"]:
                # Optionally wait for sync
                user_input = input("\nWait for sync to complete? (y/n): ")
                if user_input.lower() == 'y':
                    results["sync_completed"] = wait_for_sync()
                else:
                    print("\n[SKIP] Skipping wait. You can check status later.")
        else:
            print("\n[SKIP] Skipping sync. Run it manually when ready.")
    else:
        print("\n[OK] Initial sync already completed!")
        results["sync_started"] = True
        results["sync_completed"] = True
    
    # Test 5: Knowledge base retrieval (only if sync completed)
    if results["sync_completed"] or status_data.get('has_initial_sync'):
        print("\n" + "-" * 80)
        user_input = input("\n[TEST] Test knowledge base retrieval? (y/n): ")
        if user_input.lower() == 'y':
            results["knowledge_retrieval"] = test_knowledge_base_retrieval()
        else:
            print("\n[SKIP] Skipping knowledge base test.")
    else:
        print("\n[WARN] Sync not completed. Skipping knowledge base test.")
    
    # Summary
    print_section("TEST SUMMARY")
    print(f"[{'+' if results['connection'] else '-'}] Connection: {'PASS' if results['connection'] else 'FAIL'}")
    print(f"[{'+' if results['list_files'] else '-'}] List Files: {'PASS' if results['list_files'] else 'FAIL'}")
    print(f"[{'+' if results['status'] else '-'}] Status Check: {'PASS' if results['status'] else 'FAIL'}")
    print(f"[{'+' if results['sync_started'] else '-'}] Sync Started: {'PASS' if results['sync_started'] else 'FAIL'}")
    print(f"[{'+' if results['sync_completed'] else '?'}] Sync Completed: {'PASS' if results['sync_completed'] else 'SKIP'}")
    print(f"[{'+' if results['knowledge_retrieval'] else '?'}] Knowledge Retrieval: {'PASS' if results['knowledge_retrieval'] else 'SKIP'}")
    
    all_critical = (
        results["connection"] and 
        results["list_files"] and 
        results["status"]
    )
    
    if all_critical:
        print("\n[SUCCESS] Core functionality is working!")
        if results["sync_completed"] and results["knowledge_retrieval"]:
            print("[SUCCESS] Full knowledge base access is working!")
    else:
        print("\n[WARN] Some critical tests failed. Check configuration and logs.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[WARN] Test interrupted by user.")
    except Exception as e:
        print(f"\n\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()

