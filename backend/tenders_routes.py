from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional
from datetime import datetime, date

from scraper_service import fetch_all_sources
from sqlalchemy.orm import Session
from database import get_db, ScrapedTenders

router = APIRouter()

PAGE_SIZE = 10

def _persist_batch(db: Session, source: str, items):
    for it in items:
        try:
            # Check if tender exists, if so update it, if not create new
            existing = db.query(ScrapedTenders).filter(ScrapedTenders.tender_id == it.get('tender_id')).first()
            if existing:
                # Update existing tender with fresh data
                existing.title = it.get('title')
                existing.organization = it.get('organization')
                existing.sector = it.get('sector')
                existing.description = it.get('description')
                existing.deadline = datetime.fromisoformat(it['deadline']) if it.get('deadline') else None
                existing.value = it.get('value')
                existing.url = it.get('url')
                existing.ttlh_score = int(it.get('ttlh_score') or 0)
                existing.raw_data = it.get('raw')
            else:
                # Create new tender
                row = ScrapedTenders(
                    tender_id=it.get('tender_id'),
                    source=source,
                    title=it.get('title'),
                    organization=it.get('organization'),
                    sector=it.get('sector'),
                    description=it.get('description'),
                    deadline=datetime.fromisoformat(it['deadline']) if it.get('deadline') else None,
                    value=it.get('value'),
                    url=it.get('url'),
                    ttlh_score=int(it.get('ttlh_score') or 0),
                    raw_data=it.get('raw')
                )
                db.add(row)
        except Exception as e:
            print(f"Error processing tender {it.get('tender_id')}: {e}")
            pass
    try:
        db.commit()
    except Exception as e:
        print(f"Error committing batch: {e}")
        db.rollback()

@router.get('/api/tenders')
def get_active_tenders(
    page: int = Query(1, ge=1, le=100), 
    source: str = Query('all'), 
    sector_filter: bool = Query(True),
    search: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    try:
        # Fetch more data to support pagination (10 pages worth)
        data = fetch_all_sources(limit_per_source=PAGE_SIZE * 10, ttlh_only=sector_filter, max_pages=10) or {}
        print(f"Fetched data: GEM={len(data.get('gem', []))}, IDEX={len(data.get('idex', []))}, TATA={len(data.get('tata', []))}")
    except Exception as e:
        print(f"Error fetching data: {e}")
        data = {}

    # Normalize keys
    data.setdefault('gem', [])
    data.setdefault('idex', [])
    data.setdefault('tata', [])
    data.setdefault('last_updated', datetime.utcnow().isoformat() + 'Z')

    # Persist latest batch (best-effort)
    try:
        print(f"Starting persistence - GEM: {len(data.get('gem', []))}, IDEX: {len(data.get('idex', []))}, TATA: {len(data.get('tata', []))}")
        for key in ('gem', 'idex', 'tata'):
            print(f"Persisting {key}: {len(data.get(key, []))} items")
            _persist_batch(db, key, data.get(key, []))
        print("Persistence completed successfully")
    except Exception as e:
        print(f"Error persisting batch: {e}")
        import traceback
        traceback.print_exc()
        pass

    def filter_tenders(tender_list):
        """Apply search and date filters to tender list"""
        filtered = tender_list
        
        # Apply search filter
        if search and search.strip():
            search_term = search.strip().lower()
            filtered = [
                t for t in filtered
                if (search_term in (t.get('title', '').lower()) or
                    search_term in (t.get('organization', '').lower()) or
                    search_term in (t.get('sector', '').lower()) or
                    search_term in (t.get('value', '').lower()))
            ]
        
        # Apply date filters
        if start_date or end_date:
            filtered = [
                t for t in filtered
                if t.get('deadline')
            ]
            
            if start_date:
                filtered = [
                    t for t in filtered
                    if datetime.fromisoformat(t['deadline']).date() >= start_date
                ]
            
            if end_date:
                filtered = [
                    t for t in filtered
                    if datetime.fromisoformat(t['deadline']).date() <= end_date
                ]
        
        return filtered

    def paginate(lst):
        start = (page - 1) * PAGE_SIZE
        end = start + PAGE_SIZE
        return lst[start:end]

    # Apply filters to each source
    filtered_data = {}
    for key in ['gem', 'idex', 'tata']:
        filtered_data[key] = filter_tenders(data.get(key, []))

    if source == 'gem':
        tenders = {'gem': paginate(filtered_data['gem']), 'idex': [], 'tata': []}
        total_count = len(filtered_data['gem'])
    elif source == 'idex':
        tenders = {'gem': [], 'idex': paginate(filtered_data['idex']), 'tata': []}
        total_count = len(filtered_data['idex'])
    elif source == 'tata':
        tenders = {'gem': [], 'idex': [], 'tata': paginate(filtered_data['tata'])}
        total_count = len(filtered_data['tata'])
    else:
        tenders = {'gem': paginate(filtered_data['gem']), 'idex': paginate(filtered_data['idex']), 'tata': paginate(filtered_data['tata'])}
        total_count = len(filtered_data['gem']) + len(filtered_data['idex']) + len(filtered_data['tata'])

    total_pages = (total_count + PAGE_SIZE - 1) // PAGE_SIZE  # Ceiling division

    return {
        'tenders': tenders,
        'total_count': total_count,
        'total_pages': total_pages,
        'page': page,
        'page_size': PAGE_SIZE,
        'ttlh_filtered': sector_filter,
        'search': search,
        'start_date': start_date.isoformat() if start_date else None,
        'end_date': end_date.isoformat() if end_date else None,
        'last_updated': data.get('last_updated')
    }

@router.post('/api/tenders/refresh')
def refresh_tenders(db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        data = fetch_all_sources(limit_per_source=PAGE_SIZE, ttlh_only=True)
        for key in ('gem', 'idex', 'tata'):
            _persist_batch(db, key, data.get(key, []))
        return {'status': 'refreshed', 'timestamp': datetime.utcnow().isoformat() + 'Z'}
    except Exception:
        return {'status': 'refreshed', 'timestamp': datetime.utcnow().isoformat() + 'Z'}

@router.post('/api/tenders/debug')
def debug_tenders(db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        data = fetch_all_sources(limit_per_source=5, ttlh_only=False) or {}
        return {
            'gem_count': len(data.get('gem', [])),
            'idex_count': len(data.get('idex', [])),
            'tata_count': len(data.get('tata', [])),
            'samples': {
                'gem': (data.get('gem') or [])[:2],
                'idex': (data.get('idex') or [])[:2],
                'tata': (data.get('tata') or [])[:2],
            },
            'last_updated': data.get('last_updated')
        }
    except Exception as e:
        return {'error': 'debug_failed', 'message': str(e)}

@router.get('/api/tenders/test-gem')
def test_gem_scraper():
    """Test endpoint to debug GEM scraper specifically"""
    from scraper_service import GEMScraper
    scraper = GEMScraper()
    try:
        # Test without TTLH filter first, scrape 3 pages
        items = scraper.fetch(15, ttlh_only=False, max_pages=3)
        return {
            'success': True,
            'count': len(items),
            'items': items,
            'message': f'Found {len(items)} tenders from GEM (3 pages)'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'GEM scraper failed'
        }

@router.get('/api/tenders/test-idex')
def test_idex_scraper():
    """Test endpoint to debug IDEX scraper specifically"""
    from scraper_service import IDEXScraper
    scraper = IDEXScraper()
    try:
        # Test without TTLH filter first, scrape 3 pages
        items = scraper.fetch(15, ttlh_only=False, max_pages=3)
        return {
            'success': True,
            'count': len(items),
            'items': items,
            'message': f'Found {len(items)} challenges from IDEX (3 pages)'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'IDEX scraper failed'
        }

@router.get('/api/tenders/test-tata')
def test_tata_scraper():
    """Test endpoint to debug Tata scraper specifically"""
    from scraper_service import TataInnoverseScraper
    scraper = TataInnoverseScraper()
    try:
        # Test without TTLH filter first, scrape 3 pages
        items = scraper.fetch(15, ttlh_only=False, max_pages=3)
        return {
            'success': True,
            'count': len(items),
            'items': items,
            'message': f'Found {len(items)} challenges from Tata Innoverse (3 pages)'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Tata scraper failed'
        }


