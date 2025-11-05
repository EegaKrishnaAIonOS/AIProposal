"""
SharePoint-to-Pinecone Ingestion Pipeline
Handles continuous learning via delta queries and vector store updates
"""

import os
import json
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

from sharepoint_client import get_sharepoint_client
from file_parsers import extract_text_from_bytes
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from pinecone import Pinecone

load_dotenv()

class SharePointIngestionPipeline:
    """Pipeline for ingesting SharePoint documents into Pinecone vector store"""
    
    def __init__(self):
        self.logger = logging.getLogger("sharepoint.pipeline")
        # Initialize components
        self.sharepoint = get_sharepoint_client()
        
        # Pinecone setup
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY")
        self.pinecone_index_name = os.getenv("PINECONE_INDEX_NAME")
        
        if not self.pinecone_api_key or not self.pinecone_index_name:
            raise ValueError("PINECONE_API_KEY and PINECONE_INDEX_NAME must be set")
        
        self.logger.info("Connecting to Pinecone index: %s", self.pinecone_index_name)
        self.pc = Pinecone(api_key=self.pinecone_api_key)
        self.index = self.pc.Index(self.pinecone_index_name)
        
        # Embedding model
        self.embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        # Text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        
        # Delta link storage (should be persisted to database in production)
        self.delta_link: Optional[str] = None
        self.delta_link_file = "sharepoint_delta_link.json"
        self._load_delta_link()
    
    def _load_delta_link(self):
        """Load saved delta link from disk"""
        try:
            if os.path.exists(self.delta_link_file):
                with open(self.delta_link_file, 'r') as f:
                    data = json.load(f)
                    self.delta_link = data.get('delta_link')
                    self.logger.info("Loaded delta link from %s", self.delta_link_file)
        except Exception as e:
            self.logger.exception("Error loading delta link: %s", e)
            self.delta_link = None
    
    def _save_delta_link(self):
        """Save delta link to disk"""
        try:
            with open(self.delta_link_file, 'w') as f:
                json.dump({'delta_link': self.delta_link}, f)
                self.logger.info("Saved delta link to %s", self.delta_link_file)
        except Exception as e:
            self.logger.exception("Error saving delta link: %s", e)
    
    def initial_sync(self) -> Dict[str, Any]:
        """
        Perform initial full sync of SharePoint folder to Pinecone
        
        Returns:
            Dictionary with sync statistics
        """
        self.logger.info("Starting initial SharePoint sync")
        stats = {
            'files_processed': 0,
            'chunks_created': 0,
            'vectors_uploaded': 0,
            'errors': 0,
            'start_time': datetime.utcnow().isoformat()
        }
        
        try:
            # List all files in SharePoint folder
            self.logger.info("[initial] Listing files from SharePoint (recursive)")
            files = self.sharepoint.list_files_in_folder(recursive=True)
            self.logger.info("[initial] Discovered %d files for ingestion", len(files))
            
            # Process each file
            for file_info in files:
                try:
                    self.logger.info("[initial] Processing file: name=%s id=%s size=%s url=%s", file_info.get('name'), file_info.get('id'), file_info.get('size'), file_info.get('webUrl'))
                    self.logger.debug("[initial] Download start: id=%s", file_info['id'])
                    # Download file
                    file_content = self.sharepoint.download_file_content(file_info['id'])
                    if not file_content:
                        stats['errors'] += 1
                        self.logger.warning("[initial] Skipping file due to download failure: %s", file_info.get('name'))
                        continue
                    self.logger.debug("[initial] Downloaded bytes=%d for %s", len(file_content or b""), file_info.get('name'))
                    
                    # Extract text
                    self.logger.debug("[initial] Extract text start: %s", file_info.get('name'))
                    text = extract_text_from_bytes(file_content, file_info['name'])
                    if not text or len(text.strip()) < 50:
                        self.logger.warning("[initial] Skipping %s: insufficient text extracted (chars=%d)", file_info.get('name'), len(text or ""))
                        continue
                    self.logger.debug("[initial] Extracted text chars=%d for %s", len(text), file_info.get('name'))
                    
                    # Chunk text
                    self.logger.debug("[initial] Chunking start: %s", file_info.get('name'))
                    chunks = self.text_splitter.split_text(text)
                    self.logger.info("[initial] Generated %d chunks for %s", len(chunks), file_info.get('name'))
                    
                    # Generate embeddings and upload
                    self.logger.debug("[initial] Embedding+Upsert start: %s", file_info.get('name'))
                    vectors = []
                    for chunk in chunks:
                        doc_id = str(uuid.uuid4())
                        embedding = self.embedding_model.embed_documents([chunk])[0]
                        
                        metadata = {
                            "source": "sharepoint",
                            "knowledge_base": "AIonOS",
                            "sharepoint_file_id": file_info['id'],
                            "filename": file_info['name'],
                            "web_url": file_info.get('webUrl', ''),
                            "last_modified": file_info.get('lastModifiedDateTime', ''),
                            "file_type": file_info.get('mimeType', ''),
                            "text": chunk
                        }
                        
                        vectors.append((doc_id, embedding, metadata))
                    
                    # Upload to Pinecone (batch upload)
                    if vectors:
                        self.logger.info("[initial] Upserting %d vectors for %s", len(vectors), file_info.get('name'))
                        self.index.upsert(vectors=vectors)
                        stats['chunks_created'] += len(chunks)
                        stats['vectors_uploaded'] += len(vectors)
                        self.logger.debug("[initial] Uploaded vectors for %s", file_info.get('name'))
                    
                    stats['files_processed'] += 1
                
                except Exception as e:
                    self.logger.exception("[initial] Error processing %s: %s", file_info.get('name', 'unknown'), e)
                    stats['errors'] += 1
                    continue
            
            # Get initial delta link for future incremental syncs
            try:
                _, delta_link = self.sharepoint.get_delta_changes()
                if delta_link:
                    self.delta_link = delta_link
                    self._save_delta_link()
                    self.logger.info("Initial delta link saved for incremental syncs")
            except Exception as e:
                self.logger.warning("Could not get delta link: %s", e)
            
            stats['end_time'] = datetime.utcnow().isoformat()
            self.logger.info("[initial] Completed: files=%d chunks=%d vectors=%d errors=%d", stats['files_processed'], stats['chunks_created'], stats['vectors_uploaded'], stats['errors'])
            
            return stats
        
        except Exception as e:
            self.logger.exception("[initial] Error in initial sync: %s", e)
            stats['errors'] += 1
            stats['end_time'] = datetime.utcnow().isoformat()
            return stats
    
    def incremental_sync(self) -> Dict[str, Any]:
        """
        Perform incremental sync using delta query
        
        Returns:
            Dictionary with sync statistics
        """
        self.logger.info("Starting incremental SharePoint sync")
        stats = {
            'files_processed': 0,
            'files_updated': 0,
            'files_deleted': 0,
            'chunks_created': 0,
            'vectors_uploaded': 0,
            'errors': 0,
            'start_time': datetime.utcnow().isoformat()
        }
        
        try:
            # Get changes since last delta query
            changed_items, next_delta_link = self.sharepoint.get_delta_changes(self.delta_link)
            self.logger.info("[incremental] Delta query returned %d changes", len(changed_items))
            
            # Process each change
            for item in changed_items:
                try:
                    if item.get('deleted'):
                        # Handle deleted files (optional: delete vectors from Pinecone)
                        # Note: Pinecone doesn't have an easy way to delete by metadata filter
                        # You might want to maintain a mapping of file_id to vector_ids
                        stats['files_deleted'] += 1
                        self.logger.info("[incremental] Detected deletion: %s", item.get('name'))
                        continue
                    
                    self.logger.info("[incremental] Processing change: name=%s id=%s url=%s", item.get('name'), item.get('id'), item.get('webUrl'))
                    self.logger.debug("[incremental] Download start: id=%s", item.get('id'))
                    # Download and process updated/new file
                    file_content = self.sharepoint.download_file_content(item['id'])
                    if not file_content:
                        stats['errors'] += 1
                        self.logger.warning("[incremental] Skipping due to download failure: %s", item.get('name'))
                        continue
                    self.logger.debug("[incremental] Downloaded bytes=%d for %s", len(file_content or b""), item.get('name'))
                    
                    # Extract text
                    self.logger.debug("[incremental] Extract text start: %s", item.get('name'))
                    text = extract_text_from_bytes(file_content, item['name'])
                    if not text or len(text.strip()) < 50:
                        self.logger.warning("[incremental] Skipping %s: insufficient text (chars=%d)", item.get('name'), len(text or ""))
                        stats['files_processed'] += 1
                        continue
                    
                    # Chunk text
                    self.logger.debug("[incremental] Chunking start: %s", item.get('name'))
                    chunks = self.text_splitter.split_text(text)
                    
                    # Generate embeddings and upload
                    self.logger.debug("[incremental] Embedding+Upsert start: %s (chunks=%d)", item.get('name'), len(chunks))
                    vectors = []
                    for chunk in chunks:
                        doc_id = str(uuid.uuid4())
                        embedding = self.embedding_model.embed_documents([chunk])[0]
                        
                        metadata = {
                            "source": "sharepoint",
                            "knowledge_base": "AIonOS",
                            "sharepoint_file_id": item['id'],
                            "filename": item['name'],
                            "web_url": item.get('webUrl', ''),
                            "last_modified": item.get('lastModifiedDateTime', ''),
                            "file_type": item.get('mimeType', ''),
                            "text": chunk
                        }
                        
                        vectors.append((doc_id, embedding, metadata))
                    
                    # Upload to Pinecone
                    if vectors:
                        self.logger.info("[incremental] Upserting %d vectors for %s", len(vectors), item.get('name'))
                        self.index.upsert(vectors=vectors)
                        stats['chunks_created'] += len(chunks)
                        stats['vectors_uploaded'] += len(vectors)
                        self.logger.debug("[incremental] Uploaded vectors for %s", item.get('name'))
                    
                    stats['files_processed'] += 1
                    stats['files_updated'] += 1
                
                except Exception as e:
                    self.logger.exception("[incremental] Error processing change for %s: %s", item.get('name', 'unknown'), e)
                    stats['errors'] += 1
                    continue
            
            # Save new delta link
            if next_delta_link:
                self.delta_link = next_delta_link
                self._save_delta_link()
                self.logger.info("Saved updated delta link")
            
            stats['end_time'] = datetime.utcnow().isoformat()
            self.logger.info("[incremental] Completed: processed=%d updated=%d deleted=%d chunks=%d vectors=%d errors=%d", stats['files_processed'], stats['files_updated'], stats['files_deleted'], stats['chunks_created'], stats['vectors_uploaded'], stats['errors'])
            
            return stats
        
        except Exception as e:
            self.logger.exception("Error in incremental sync: %s", e)
            stats['errors'] += 1
            stats['end_time'] = datetime.utcnow().isoformat()
            return stats


def run_initial_sync():
    """Run initial SharePoint sync (one-time setup)"""
    pipeline = SharePointIngestionPipeline()
    return pipeline.initial_sync()


def run_incremental_sync():
    """Run incremental SharePoint sync (scheduled job)"""
    pipeline = SharePointIngestionPipeline()
    return pipeline.incremental_sync()


if __name__ == "__main__":
    # For testing
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "incremental":
        print("Running incremental sync...")
        result = run_incremental_sync()
    else:
        print("Running initial sync...")
        result = run_initial_sync()
    
    print(f"\nSync Results: {json.dumps(result, indent=2)}")

