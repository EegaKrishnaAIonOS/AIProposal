from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from database import get_db, Wishlist, ScrapedTenders

router = APIRouter()

# For now, we'll use a global user_id since we don't have user authentication
# In a real system, this would come from the authenticated user session
GLOBAL_USER_ID = "global_user"

@router.get('/api/wishlists')
def get_wishlists(
    page: int = Query(1, ge=1, le=100),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort: str = Query('created_at', regex='^(created_at|deadline|title)$'),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get paginated wishlist items for the current user"""
    try:
        # Build query for active wishlist items (not soft-deleted)
        query = db.query(Wishlist).filter(
            and_(
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.removed_at.is_(None)
            )
        )
        
        # Apply search filter
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Wishlist.title.ilike(search_term),
                    Wishlist.organization.ilike(search_term),
                    Wishlist.sector.ilike(search_term),
                    Wishlist.summary.ilike(search_term)
                )
            )
        
        # Apply sorting
        if sort == 'created_at':
            query = query.order_by(Wishlist.created_at.desc())
        elif sort == 'deadline':
            query = query.order_by(Wishlist.deadline.asc().nulls_last())
        elif sort == 'title':
            query = query.order_by(Wishlist.title.asc())
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        wishlist_items = query.offset(offset).limit(limit).all()
        
        # Convert to response format
        items = []
        for item in wishlist_items:
            items.append({
                'id': item.id,
                'tender_id': item.tender_id,
                'title': item.title,
                'organization': item.organization,
                'summary': item.summary,
                'value': item.value,
                'deadline': item.deadline.isoformat() if item.deadline else None,
                'url': item.url,
                'sector': item.sector,
                'source': item.source,
                'created_at': item.created_at.isoformat(),
                'raw_snapshot': item.raw_snapshot
            })
        
        total_pages = (total_count + limit - 1) // limit
        
        return {
            'items': items,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page,
            'limit': limit,
            'sort': sort,
            'search': search
        }
        
    except Exception as e:
        print(f"Error fetching wishlists: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch wishlists")

@router.post('/api/wishlists')
def add_to_wishlist(
    tender_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Add a tender to wishlist (idempotent)"""
    try:
        # Check if already wishlisted
        existing = db.query(Wishlist).filter(
            and_(
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.tender_id == tender_id,
                Wishlist.removed_at.is_(None)
            )
        ).first()
        
        if existing:
            return {
                'id': existing.id,
                'tender_id': existing.tender_id,
                'wishlisted': True,
                'message': 'Already in wishlist'
            }
        
        # Get tender data from scraped_tenders for snapshot
        tender = db.query(ScrapedTenders).filter(ScrapedTenders.tender_id == tender_id).first()
        
        if not tender:
            raise HTTPException(status_code=404, detail="Tender not found")
        
        # Create wishlist entry with snapshot
        wishlist_item = Wishlist(
            user_id=GLOBAL_USER_ID,
            tender_id=tender_id,
            title=tender.title,
            organization=tender.organization,
            summary=tender.description,  # Using description as summary
            value=tender.value,
            deadline=tender.deadline,
            url=tender.url,
            sector=tender.sector,
            source=tender.source,
            raw_snapshot=tender.raw_data
        )
        
        db.add(wishlist_item)
        db.commit()
        db.refresh(wishlist_item)
        
        return {
            'id': wishlist_item.id,
            'tender_id': wishlist_item.tender_id,
            'wishlisted': True,
            'message': 'Added to wishlist'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error adding to wishlist: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to wishlist")

@router.delete('/api/wishlists/{wishlist_id}')
def remove_from_wishlist(
    wishlist_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Remove a wishlist item (soft delete)"""
    try:
        wishlist_item = db.query(Wishlist).filter(
            and_(
                Wishlist.id == wishlist_id,
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.removed_at.is_(None)
            )
        ).first()
        
        if not wishlist_item:
            raise HTTPException(status_code=404, detail="Wishlist item not found")
        
        # Soft delete
        wishlist_item.removed_at = datetime.utcnow()
        db.commit()
        
        return {
            'id': wishlist_item.id,
            'tender_id': wishlist_item.tender_id,
            'wishlisted': False,
            'message': 'Removed from wishlist'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error removing from wishlist: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove from wishlist")

@router.post('/api/wishlists/toggle')
def toggle_wishlist(
    tender_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Toggle wishlist status for a tender"""
    try:
        # Check if already wishlisted
        existing = db.query(Wishlist).filter(
            and_(
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.tender_id == tender_id,
                Wishlist.removed_at.is_(None)
            )
        ).first()
        
        if existing:
            # Remove from wishlist
            existing.removed_at = datetime.utcnow()
            db.commit()
            return {
                'tender_id': tender_id,
                'wishlisted': False,
                'wishlist_id': existing.id,
                'message': 'Removed from wishlist'
            }
        else:
            # Add to wishlist - try database first, then fresh data
            tender = db.query(ScrapedTenders).filter(ScrapedTenders.tender_id == tender_id).first()
            
            if not tender:
                # Try to get from fresh scraped data
                from scraper_service import fetch_all_sources
                try:
                    fresh_data = fetch_all_sources(limit_per_source=50, ttlh_only=True, max_pages=1) or {}
                    tender_data = None
                    for source_data in fresh_data.values():
                        for item in source_data:
                            if item.get('tender_id') == tender_id:
                                tender_data = item
                                break
                        if tender_data:
                            break
                    
                    if not tender_data:
                        raise HTTPException(status_code=404, detail="Tender not found")
                    
                    # Create a temporary tender object
                    class TempTender:
                        def __init__(self, data):
                            self.tender_id = data.get('tender_id')
                            self.title = data.get('title')
                            self.organization = data.get('organization')
                            self.description = data.get('description')
                            self.value = data.get('value')
                            # Parse deadline if it's a string
                            deadline = data.get('deadline')
                            if deadline and isinstance(deadline, str):
                                try:
                                    self.deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                                except:
                                    self.deadline = None
                            else:
                                self.deadline = deadline
                            self.url = data.get('url')
                            self.sector = data.get('sector')
                            self.source = data.get('source')
                            self.raw_data = data.get('raw')
                    
                    tender = TempTender(tender_data)
                except Exception as e:
                    print(f"Error fetching fresh data: {e}")
                    raise HTTPException(status_code=404, detail="Tender not found")
            
            try:
                wishlist_item = Wishlist(
                    user_id=GLOBAL_USER_ID,
                    tender_id=tender_id,
                    title=tender.title,
                    organization=tender.organization,
                    summary=tender.description,
                    value=tender.value,
                    deadline=tender.deadline,
                    url=tender.url,
                    sector=tender.sector,
                    source=tender.source,
                    raw_snapshot=tender.raw_data
                )
                
                db.add(wishlist_item)
                db.commit()
                db.refresh(wishlist_item)
                
                return {
                    'tender_id': tender_id,
                    'wishlisted': True,
                    'wishlist_id': wishlist_item.id,
                    'message': 'Added to wishlist'
                }
            except Exception as e:
                print(f"Error creating wishlist item: {e}")
                db.rollback()
                raise HTTPException(status_code=500, detail="Failed to create wishlist item")
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error toggling wishlist: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle wishlist")

@router.get('/api/wishlists/count')
def get_wishlist_count(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get wishlist count for current user"""
    try:
        count = db.query(Wishlist).filter(
            and_(
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.removed_at.is_(None)
            )
        ).count()
        
        return {
            'count': count,
            'user_id': GLOBAL_USER_ID
        }
        
    except Exception as e:
        print(f"Error getting wishlist count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wishlist count")

@router.get('/api/wishlists/status')
def get_wishlist_status(
    tender_ids: str = Query(..., description="Comma-separated tender IDs"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get wishlist status for multiple tenders"""
    try:
        tender_id_list = [tid.strip() for tid in tender_ids.split(',') if tid.strip()]
        
        wishlisted_items = db.query(Wishlist).filter(
            and_(
                Wishlist.user_id == GLOBAL_USER_ID,
                Wishlist.tender_id.in_(tender_id_list),
                Wishlist.removed_at.is_(None)
            )
        ).all()
        
        # Create a map of tender_id -> wishlist_id
        status_map = {item.tender_id: item.id for item in wishlisted_items}
        
        return {
            'status_map': status_map,
            'total_checked': len(tender_id_list),
            'wishlisted_count': len(wishlisted_items)
        }
        
    except Exception as e:
        print(f"Error getting wishlist status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get wishlist status")
