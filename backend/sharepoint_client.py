"""
SharePoint Integration Module for Microsoft Graph API
Handles authentication, file discovery, delta queries, and content extraction
"""

import os
import time
import requests
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from msal import ConfidentialClientApplication
import base64

# Optional built-in defaults (env vars still take precedence)
# These are used only if corresponding environment variables are missing
DEFAULT_SHAREPOINT_SITE_ID = "aionos.sharepoint.com,e5bdab60-b975-4a67-b7e0a02437f27dd6,a21796fe-5c45-4cf3-b793-2113eeef9840"
DEFAULT_SHAREPOINT_DRIVE_ID = "b!YKu95XW5Z0q34KAkN_J91v6WF6JFXPNMt5MhE-7vmECCXBx0rfwuTokKklRaDanu"
DEFAULT_SHAREPOINT_FOLDER_ID = "01Y4E4XAAP7KOEGKTTL5GLSZF2FIPMW4SF"  # Agritech
DEFAULT_SHAREPOINT_FOLDER_PATH = "/Bid/SXRepository/Agritech"

class SharePointClient:
    """Client for interacting with SharePoint via Microsoft Graph API"""
    
    def __init__(self):
        self.logger = logging.getLogger("sharepoint.client")
        # Strictly use .env (no hardcoded defaults)
        self.client_id = os.getenv("SHAREPOINT_CLIENT_ID")
        self.client_secret = os.getenv("SHAREPOINT_CLIENT_SECRET")
        self.tenant_id = os.getenv("SHAREPOINT_TENANT_ID")
        # Either provide IDs directly OR provide URL/path to resolve dynamically
        # Environment variables take precedence; otherwise use the provided final defaults
        self.site_id = os.getenv("SHAREPOINT_SITE_ID") or DEFAULT_SHAREPOINT_SITE_ID
        self.drive_id = os.getenv("SHAREPOINT_DRIVE_ID") or DEFAULT_SHAREPOINT_DRIVE_ID
        self.folder_id = os.getenv("SHAREPOINT_FOLDER_ID") or DEFAULT_SHAREPOINT_FOLDER_ID
        self.site_url = os.getenv("SHAREPOINT_SITE_URL")  # optional when site_id provided
        self.folder_path = os.getenv("SHAREPOINT_FOLDER_PATH") or DEFAULT_SHAREPOINT_FOLDER_PATH

        # Validate required auth vars
        missing = [k for k,v in {
            'SHAREPOINT_CLIENT_ID': self.client_id,
            'SHAREPOINT_CLIENT_SECRET': self.client_secret,
            'SHAREPOINT_TENANT_ID': self.tenant_id,
        }.items() if not v]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        # Graph API endpoints
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.graph_endpoint = "https://graph.microsoft.com/v1.0"
        
        self.access_token: Optional[str] = None
        self.token_expires_at: float = 0
        
        # Initialize MSAL app
        self.app = ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=self.authority
        )
    
    def get_access_token(self) -> str:
        """
        Get or refresh access token using Client Credentials Flow
        """
        # Check if token is still valid (with 5 min buffer)
        if self.access_token and time.time() < (self.token_expires_at - 300):
            return self.access_token
        
        try:
            self.logger.debug("[graph] Acquiring Microsoft Graph access token via client credentials")
            # Request token
            scope = ["https://graph.microsoft.com/.default"]
            result = self.app.acquire_token_for_client(scopes=scope)
            
            if "access_token" in result:
                self.access_token = result["access_token"]
                # Calculate expiry (tokens typically last 1 hour)
                expires_in = result.get("expires_in", 3600)
                self.token_expires_at = time.time() + expires_in
                self.logger.info("[graph] Token acquired; expires_in=%s", expires_in)
                return self.access_token
            else:
                raise Exception(f"Failed to acquire token: {result.get('error_description', result)}")
        
        except Exception as e:
            self.logger.exception("Error acquiring SharePoint access token: %s", e)
            raise
    
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make authenticated request to Microsoft Graph API
        """
        token = self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        url = f"{self.graph_endpoint}{endpoint}"
        self.logger.debug("[graph] GET %s params=%s", endpoint, params)
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        return response.json()

    def _resolve_site_id_from_url(self) -> Optional[str]:
        """
        Resolve site-id from SHAREPOINT_SITE_URL if provided.
        Uses: GET /sites/{hostname}:/sites/{path}
        """
        if not self.site_url:
            return None
        try:
            self.logger.info("[graph] Resolving site id from url: %s", self.site_url)
            # Example: https://aionos.sharepoint.com/sites/AIonOSSolutionOfferings
            # hostname = aionos.sharepoint.com, path = /sites/AIonOSSolutionOfferings
            from urllib.parse import urlparse
            parsed = urlparse(self.site_url)
            hostname = parsed.netloc
            path = parsed.path  # includes leading /sites/...
            endpoint = f"/sites/{hostname}:{path}"
            data = self._make_request(endpoint)
            return data.get('id')
        except Exception as e:
            self.logger.exception("Error resolving site id from url: %s", e)
            return None

    def _ensure_site_drive(self):
        """
        Ensure site_id and drive_id are resolved when only site URL is provided.
        """
        if not self.site_id:
            self.site_id = self._resolve_site_id_from_url()
        if not self.site_id:
            raise ValueError("SHAREPOINT_SITE_ID or SHAREPOINT_SITE_URL must be set")
        if not self.drive_id:
            try:
                # Use default document library drive
                self.logger.debug("[graph] Fetching drives for site_id=%s", self.site_id)
                drives = self._make_request(f"/sites/{self.site_id}/drives")
                value = drives.get('value') or []
                if value:
                    # Prefer drive with 'documentLibrary' driveType
                    preferred = next((d for d in value if d.get('driveType') == 'documentLibrary'), value[0])
                    self.drive_id = preferred.get('id')
            except Exception as e:
                self.logger.exception("Error resolving drive id: %s", e)
        if not self.drive_id:
            raise ValueError("SHAREPOINT_DRIVE_ID must be set or resolvable from site")
    
    def list_files_in_folder(self, folder_id: Optional[str] = None, 
                            recursive: bool = True) -> List[Dict[str, Any]]:
        """
        List all files in a SharePoint folder
        """
        # Resolve site/drive if needed
        self._ensure_site_drive()

        # If folder_path is configured, prefer path-based listing (more reliable)
        if self.folder_path and not folder_id and not self.folder_id:
            self.logger.info("Listing files by path (preferred): %s (recursive=%s)", self.folder_path, recursive)
            return self._list_files_by_path(self.folder_path, recursive)

        # Otherwise, resolve target folder id (env-provided or resolved from path)
        resolved_folder_id: Optional[str] = None
        if self.folder_path and not folder_id and not self.folder_id:
            try:
                self.logger.info("Resolving folder id from path: %s", self.folder_path)
                item = self._make_request(f"/sites/{self.site_id}/drives/{self.drive_id}/root:{self.folder_path}:")
                resolved_folder_id = item.get('id')
            except Exception as e:
                self.logger.exception("Failed to resolve folder path to id: %s", e)
        target_folder_id = folder_id or resolved_folder_id or self.folder_id
        self.logger.info("Listing files by folder_id=%s (recursive=%s)", target_folder_id, recursive)
        
        all_files = []
        files_queue = [target_folder_id] if not recursive else []
        
        try:
            if recursive:
                # Get all items recursively
                endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{target_folder_id}/children"
                
                while True:
                    response_data = self._make_request(endpoint)
                    items = response_data.get("value", [])
                    
                    for item in items:
                        item_type = item.get("folder")
                        item_id = item.get("id")
                        item_name = item.get("name", "")
                        
                        # If it's a folder and we're being recursive, add to queue
                        if recursive and item_type:
                            files_queue.append(item_id)
                        
                        # If it's a file, add to results
                        elif not item_type:
                            file_info = {
                                "id": item_id,
                                "name": item_name,
                                "webUrl": item.get("webUrl", ""),
                                "lastModifiedDateTime": item.get("lastModifiedDateTime", ""),
                                "size": item.get("size", 0),
                                "mimeType": item.get("file", {}).get("mimeType", ""),
                                "downloadUrl": None
                            }
                            all_files.append(file_info)
                    
                    # Check if there's a next page
                    next_link = response_data.get("@odata.nextLink")
                    if not next_link:
                        break
                    
                    # Parse next link (remove graph endpoint prefix)
                    endpoint = next_link.replace(self.graph_endpoint, "")
                
                # Process folders in queue recursively
                processed_folders = set()
                while files_queue:
                    folder_id = files_queue.pop(0)
                    if folder_id in processed_folders:
                        continue
                    processed_folders.add(folder_id)
                    
                    try:
                        endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{folder_id}/children"
                        
                        while True:
                            response_data = self._make_request(endpoint)
                            items = response_data.get("value", [])
                            
                            for item in items:
                                item_type = item.get("folder")
                                item_id = item.get("id")
                                item_name = item.get("name", "")
                                
                                if item_type:
                                    files_queue.append(item_id)
                                else:
                                    file_info = {
                                        "id": item_id,
                                        "name": item_name,
                                        "webUrl": item.get("webUrl", ""),
                                        "lastModifiedDateTime": item.get("lastModifiedDateTime", ""),
                                        "size": item.get("size", 0),
                                        "mimeType": item.get("file", {}).get("mimeType", ""),
                                        "downloadUrl": None
                                    }
                                    all_files.append(file_info)
                            
                            next_link = response_data.get("@odata.nextLink")
                            if not next_link:
                                break
                            endpoint = next_link.replace(self.graph_endpoint, "")
                    
                    except Exception as e:
                        print(f"Error processing folder {folder_id}: {e}")
                        continue
            
            else:
                # Non-recursive listing
                if self.folder_path and not folder_id and not self.folder_id:
                    # Use path-based children endpoint directly
                    endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/root:{self.folder_path}:/children"
                else:
                    endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{target_folder_id}/children"
                response_data = self._make_request(endpoint)
                items = response_data.get("value", [])
                
                for item in items:
                    if not item.get("folder"):
                        file_info = {
                            "id": item.get("id"),
                            "name": item.get("name", ""),
                            "webUrl": item.get("webUrl", ""),
                            "lastModifiedDateTime": item.get("lastModifiedDateTime", ""),
                            "size": item.get("size", 0),
                            "mimeType": item.get("file", {}).get("mimeType", ""),
                            "downloadUrl": None
                        }
                        all_files.append(file_info)
            
            self.logger.info("Found %d files in SharePoint folder", len(all_files))
            return all_files
        
        except Exception as e:
            self.logger.exception("Error listing SharePoint files: %s", e)
            return []

    def _list_files_by_path(self, folder_path: str, recursive: bool) -> List[Dict[str, Any]]:
        """List files under a drive root path: /drive/root:/path:/children"""
        all_files: List[Dict[str, Any]] = []
        try:
            # Normalize path: ensure it starts with /
            if not folder_path.startswith('/'):
                folder_path = '/' + folder_path
            
            # Normalize spaces to URL-encoded where needed; Graph handles raw path in this endpoint
            endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/root:{folder_path}:/children"
            self.logger.debug("Listing path: %s (endpoint: %s)", folder_path, endpoint)
            
            while True:
                response_data = self._make_request(endpoint)
                items = response_data.get("value", [])
                self.logger.debug("Found %d items in path %s", len(items), folder_path)
                
                for item in items:
                    if item.get('folder'):
                        if recursive:
                            # Recurse into subfolder by constructing full path
                            name = item.get('name', '')
                            # Build full path: current path + folder name
                            if folder_path.endswith('/'):
                                next_path = f"{folder_path}{name}"
                            else:
                                next_path = f"{folder_path}/{name}"
                            self.logger.debug("Recursing into folder: %s (path: %s)", name, next_path)
                            all_files.extend(self._list_files_by_path(next_path, recursive))
                        # If not recursive, skip folders (only return files)
                    else:
                        # It's a file, add it
                        file_info = {
                            "id": item.get('id'),
                            "name": item.get('name', ''),
                            "webUrl": item.get('webUrl', ''),
                            "lastModifiedDateTime": item.get('lastModifiedDateTime', ''),
                            "size": item.get('size', 0),
                            "mimeType": item.get('file', {}).get('mimeType', ''),
                            "downloadUrl": None
                        }
                        all_files.append(file_info)
                        self.logger.debug("Added file: %s", file_info.get('name'))
                
                next_link = response_data.get("@odata.nextLink")
                if not next_link:
                    break
                endpoint = next_link.replace(self.graph_endpoint, "")
            
            self.logger.info("Found %d files in SharePoint path %s", len(all_files), folder_path)
            return all_files
        except Exception as e:
            self.logger.exception("Error listing by path %s: %s", folder_path, e)
            return []
    
    def get_delta_changes(self, delta_link: Optional[str] = None) -> tuple[List[Dict[str, Any]], str]:
        """
        Get changes since last delta query using Microsoft Graph Delta Query
        
        Returns:
            tuple: (list of changed items, next delta link)
        """
        try:
            self.logger.info("Starting delta query (has_link=%s)", bool(delta_link))
            if delta_link:
                endpoint = delta_link.replace(self.graph_endpoint, "")
            else:
                # Initial delta query
                self._ensure_site_drive()
                if self.folder_id:
                    endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{self.folder_id}/delta"
                elif self.folder_path:
                    # Delta for path requires item id; resolve item by path first
                    try:
                        self.logger.debug("Resolving item id for folder path: %s", self.folder_path)
                        item = self._make_request(f"/sites/{self.site_id}/drives/{self.drive_id}/root:{self.folder_path}:")
                        item_id = item.get('id')
                        endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{item_id}/delta"
                    except Exception as e:
                        raise ValueError(f"Unable to resolve folder path for delta: {e}")
                else:
                    raise ValueError("SHAREPOINT_FOLDER_ID or SHAREPOINT_FOLDER_PATH must be set for delta queries")
            
            changed_items = []
            next_delta_link = None
            
            while True:
                response_data = self._make_request(endpoint)
                items = response_data.get("value", [])
                
                for item in items:
                    # Delta can return items, folders, or deleted items
                    deleted_state = item.get("deleted")
                    
                    item_info = {
                        "id": item.get("id"),
                        "name": item.get("name", ""),
                        "webUrl": item.get("webUrl", ""),
                        "lastModifiedDateTime": item.get("lastModifiedDateTime", ""),
                        "size": item.get("size", 0),
                        "mimeType": item.get("file", {}).get("mimeType", ""),
                        "deleted": deleted_state is not None if deleted_state else False,
                        "downloadUrl": None
                    }
                    changed_items.append(item_info)
                
                # Get next delta link or continuation token
                next_link = response_data.get("@odata.nextLink")
                if not next_link:
                    # Check for deltaLink at the end
                    next_delta_link = response_data.get("@odata.deltaLink")
                    break
                endpoint = next_link.replace(self.graph_endpoint, "")
            
            self.logger.info("Delta query returned %d changed items", len(changed_items))
            return changed_items, next_delta_link
        
        except Exception as e:
            self.logger.exception("Error in delta query: %s", e)
            return [], None
    
    def get_file_download_url(self, file_id: str) -> Optional[str]:
        """
        Get temporary download URL for a file
        """
        try:
            self.logger.debug("Fetching download URL for file_id=%s", file_id)
            endpoint = f"/sites/{self.site_id}/drives/{self.drive_id}/items/{file_id}"
            params = {"select": "@microsoft.graph.downloadUrl"}
            
            response_data = self._make_request(endpoint, params=params)
            download_url = response_data.get("@microsoft.graph.downloadUrl")
            
            return download_url
        
        except Exception as e:
            self.logger.exception("Error getting download URL for file %s: %s", file_id, e)
            return None
    
    def download_file_content(self, file_id: str) -> Optional[bytes]:
        """
        Download file content as binary
        """
        try:
            self.logger.info("Downloading file content: file_id=%s", file_id)
            download_url = self.get_file_download_url(file_id)
            if not download_url:
                return None
            
            token = self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.get(download_url, headers=headers, timeout=60)
            response.raise_for_status()
            
            return response.content
        
        except Exception as e:
            self.logger.exception("Error downloading file %s: %s", file_id, e)
            return None
    
    def download_file_stream(self, file_id: str) -> Optional[Any]:
        """
        Download file as streaming response (for large files)
        """
        try:
            self.logger.info("Streaming download for file: file_id=%s", file_id)
            download_url = self.get_file_download_url(file_id)
            if not download_url:
                return None
            
            token = self.get_access_token()
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.get(download_url, headers=headers, stream=True, timeout=60)
            response.raise_for_status()
            
            return response
        
        except Exception as e:
            self.logger.exception("Error downloading file stream %s: %s", file_id, e)
            return None


# Singleton instance
_sharepoint_client = None

def get_sharepoint_client() -> SharePointClient:
    """Get or create SharePoint client singleton"""
    global _sharepoint_client
    if _sharepoint_client is None:
        _sharepoint_client = SharePointClient()
    return _sharepoint_client

