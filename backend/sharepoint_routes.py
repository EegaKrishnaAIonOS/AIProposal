"""
FastAPI routes for SharePoint integration
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging
from typing import Dict, Any
from pydantic import BaseModel
from datetime import datetime

from sharepoint_pipeline import run_initial_sync, run_incremental_sync, SharePointIngestionPipeline
from sharepoint_client import get_sharepoint_client

router = APIRouter()
logger = logging.getLogger("sharepoint.routes")

class SyncResponse(BaseModel):
    status: str
    message: str
    timestamp: str
    stats: Dict[str, Any] = {}


@router.post("/api/sharepoint/sync/initial", response_model=SyncResponse)
async def start_initial_sync(background_tasks: BackgroundTasks):
    """
    Start initial full sync of SharePoint folder to Pinecone
    Runs in background to avoid blocking the API
    """
    try:
        logger.info("API call: start initial SharePoint sync (background)")
        # Run in background
        background_tasks.add_task(run_initial_sync)
        
        return SyncResponse(
            status="started",
            message="Initial sync started in background. Check status endpoint for progress.",
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.exception("Failed to start initial sync: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to start initial sync: {str(e)}")


@router.post("/api/sharepoint/sync/incremental", response_model=SyncResponse)
async def start_incremental_sync(background_tasks: BackgroundTasks):
    """
    Start incremental sync using delta query
    Runs in background to avoid blocking the API
    """
    try:
        logger.info("API call: start incremental SharePoint sync (background)")
        # Run in background
        background_tasks.add_task(run_incremental_sync)
        
        return SyncResponse(
            status="started",
            message="Incremental sync started in background. Check status endpoint for progress.",
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.exception("Failed to start incremental sync: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to start incremental sync: {str(e)}")


@router.get("/api/sharepoint/test-connection")
async def test_sharepoint_connection():
    """
    Test SharePoint connection and authentication
    """
    try:
        logger.info("API call: test SharePoint connection")
        client = get_sharepoint_client()
        
        # Try to get access token
        token = client.get_access_token()
        if not token:
            raise Exception("Failed to acquire access token")
        
        return {
            "status": "connected",
            "message": "Successfully authenticated with SharePoint",
            "timestamp": datetime.utcnow().isoformat(),
            "client_id": client.client_id,
            "site_id": client.site_id
        }
    except Exception as e:
        logger.exception("SharePoint connection test failed: %s", e)
        raise HTTPException(status_code=500, detail=f"SharePoint connection failed: {str(e)}")


@router.get("/api/sharepoint/list-files")
async def list_sharepoint_files(recursive: bool = True):
    """
    List files in SharePoint folder (for testing)
    
    Args:
        recursive: If True, lists files from all subfolders. Default True.
    """
    try:
        logger.info("API call: list SharePoint files (recursive=%s)", recursive)
        client = get_sharepoint_client()
        
        # List files recursively to get files from all subfolders
        files = client.list_files_in_folder(recursive=recursive)
        
        # Also get folder structure for info
        folders_info = []
        if recursive:
            try:
                # Get immediate children to show folder structure
                if client.folder_path:
                    endpoint = f"/sites/{client.site_id}/drives/{client.drive_id}/root:{client.folder_path}:/children"
                    response_data = client._make_request(endpoint)
                    items = response_data.get("value", [])
                    for item in items:
                        if item.get('folder'):
                            folders_info.append({
                                "name": item.get('name'),
                                "id": item.get('id'),
                                "childCount": item.get('folder', {}).get('childCount', 0),
                                "size": item.get('size', 0)
                            })
            except Exception as e:
                logger.debug("Could not get folder info: %s", e)
        
        return {
            "status": "success",
            "count": len(files),
            "files": files[:20],  # Limit to first 20
            "folders": folders_info[:20],  # Show subfolders
            "total_folders": len(folders_info),
            "recursive": recursive,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.exception("Listing files failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.get("/api/sharepoint/status")
async def get_sharepoint_status():
    """
    Get current SharePoint integration status
    """
    try:
        logger.info("API call: get SharePoint status")
        pipeline = SharePointIngestionPipeline()
        
        # Check if delta link exists
        has_delta_link = pipeline.delta_link is not None
        
        # Try to get token to verify connection
        client = get_sharepoint_client()
        try:
            token = client.get_access_token()
            connected = token is not None
        except:
            connected = False
        
        return {
            "status": "ready" if connected else "disconnected",
            "connected": connected,
            "has_initial_sync": has_delta_link,
            "delta_link_configured": has_delta_link,
            "index_name": pipeline.pinecone_index_name,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "has_initial_sync": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

