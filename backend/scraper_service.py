import time
import re
import warnings
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Best-effort lightweight scraper scaffolding with caching and TTLH filtering.
# Note: Selectors may need refinement in production as portals change DOMs frequently.

from bs4 import BeautifulSoup  # type: ignore

# Suppress SSL warnings for scraping
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

try:
    from selenium import webdriver  # type: ignore
    from selenium.webdriver.chrome.options import Options  # type: ignore
    from selenium.webdriver.chrome.service import Service  # type: ignore
    from selenium.webdriver.common.by import By  # type: ignore
    from selenium.webdriver.support.ui import WebDriverWait  # type: ignore
    from selenium.webdriver.support import expected_conditions as EC  # type: ignore
    from webdriver_manager.chrome import ChromeDriverManager  # type: ignore
except Exception:
    webdriver = None  # Fallback for environments without Selenium

import requests

TTLH_KEYWORDS = [
    'travel', 'transport', 'logistics', 'hospitality', 'hotel', 'airline', 'railway',
    'airport', 'fleet', 'catering', 'warehouse', 'supply chain', 'cargo', 'shipping',
    'food service', 'passenger', 'tourism', 'booking', 'bus', 'metro', 'ground handling'
]

def _score_ttlh(texts: List[str]) -> int:
    combined = ' '.join([t for t in texts if t]).lower()
    score = 0
    for kw in TTLH_KEYWORDS:
        if kw in combined:
            score += 1
            if score >= 3:
                break
    return min(score, 3)

def _now_iso() -> str:
    return datetime.utcnow().isoformat() + 'Z'

def get_chrome_driver() -> Optional["webdriver.Chrome"]:
    if webdriver is None:
        return None
    opts = Options()
    opts.add_argument('--headless=new')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    try:
        # Attempt env-provided system paths first to avoid downloads
        try:
            service = Service()
            driver = webdriver.Chrome(options=opts)
        except Exception:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=opts)
        driver.set_page_load_timeout(30)
        return driver
    except Exception:
        return None

# Simple in-memory cache
_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_MINUTES = 30

def _cache_get(key: str) -> Optional[List[Dict[str, Any]]]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    if datetime.utcnow() - entry['ts'] > timedelta(minutes=_CACHE_TTL_MINUTES):
        return None
    return entry['data']

def _cache_set(key: str, data: List[Dict[str, Any]]):
    _CACHE[key] = {'data': data, 'ts': datetime.utcnow()}

def _standardize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    # Normalize keys to a standard schema
    return {
        'tender_id': item.get('tender_id') or item.get('challenge_id') or item.get('id') or '',
        'source': item.get('source', ''),
        'title': item.get('title', '').strip(),
        'organization': item.get('organization') or item.get('org') or '',
        'sector': item.get('sector') or '',
        'description': item.get('description') or '',
        'deadline': item.get('deadline'),
        'value': item.get('value') or item.get('prize_value'),
        'url': item.get('url') or '',
        'ttlh_score': int(item.get('ttlh_score') or 0),
        'raw': item,
    }

class GEMScraper:
    BASE_URL = 'https://gem.gov.in/cppp'

    def fetch(self, limit: int = 10, ttlh_only: bool = True, max_pages: int = 10) -> List[Dict[str, Any]]:
        cache_key = f'gem:pages{max_pages}:ttlh={ttlh_only}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached[:limit]

        items: List[Dict[str, Any]] = []
        try:
            # Use requests with proper headers to avoid detection
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            # Scrape multiple pages
            for page_num in range(1, max_pages + 1):
                if len(items) >= limit:
                    break
                    
                # Construct URL for each page
                if page_num == 1:
                    url = self.BASE_URL
                else:
                    url = f"{self.BASE_URL}?page={page_num}"
                
                print(f"GEM: Scraping page {page_num} - {url}")
                
                try:
                    response = requests.get(url, headers=headers, timeout=30, verify=False)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for the main tender table - GEM typically uses table structure
                    tender_table = soup.find('table', {'class': re.compile(r'table|tender|data', re.I)})
                    if not tender_table:
                        # Try alternative selectors for tender rows
                        tender_rows = soup.find_all('tr', {'class': re.compile(r'tender|row|item', re.I)})
                        if not tender_rows:
                            # Fallback: look for any table rows that might contain tender data
                            tender_rows = soup.select('table tbody tr, .tender-item, .tender-card')
                    else:
                        tender_rows = tender_table.find_all('tr')[1:]  # Skip header row
                    
                    print(f"GEM: Page {page_num} - Found {len(tender_rows)} potential tender rows")
                    
                    if not tender_rows:
                        print(f"GEM: No more tenders found on page {page_num}, stopping pagination")
                        break
                    
                    for row in tender_rows:
                        if len(items) >= limit:
                            break
                        
                        try:
                            # Extract data from table cells or card elements
                            cells = row.find_all(['td', 'div', 'span'])
                            if len(cells) < 3:  # Skip rows with insufficient data
                                continue
                            
                            # Try to extract tender information from different cell positions
                            title = ""
                            organization = ""
                            deadline_text = ""
                            value_text = ""
                            sector = ""
                            tender_url = ""
                            
                            # Look for title in various positions and formats
                            title_candidates = [
                                row.find('a', href=True),
                                row.find(['h3', 'h4', 'h5']),
                                cells[0] if len(cells) > 0 else None,
                                cells[1] if len(cells) > 1 else None,
                                cells[2] if len(cells) > 2 else None
                            ]
                            
                            for candidate in title_candidates:
                                if candidate and candidate.get_text(strip=True):
                                    title = candidate.get_text(strip=True)
                                    # Extract URL if it's a link
                                    if candidate.name == 'a' and candidate.get('href'):
                                        href = candidate.get('href')
                                        if href.startswith('/'):
                                            tender_url = f"https://gem.gov.in{href}"
                                        elif href.startswith('http'):
                                            tender_url = href
                                        else:
                                            tender_url = f"https://gem.gov.in/{href}"
                                    break
                            
                            # Extract organization (look for company names, avoid dates)
                            for i in range(min(5, len(cells))):
                                cell_text = cells[i].get_text(strip=True)
                                # Skip if it's a date, number, or too short
                                if (cell_text and len(cell_text) > 5 and 
                                    not re.match(r'^\d+$', cell_text) and
                                    not re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', cell_text) and
                                    not re.search(r'\d{1,2}:\d{2}:\d{2}', cell_text) and
                                    not re.search(r'(AM|PM)', cell_text, re.I)):
                                    if not title or cell_text not in title:
                                        organization = cell_text
                                        break
                            
                            # Extract deadline (look for date patterns with time)
                            for cell in cells:
                                cell_text = cell.get_text(strip=True)
                                # Look for date patterns with time (e.g., "27-October-2025 03:00:00 PM")
                                if re.search(r'\d{1,2}[-/]\w+[-/]\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)', cell_text, re.I):
                                    deadline_text = cell_text
                                    break
                                # Fallback to simple date pattern
                                elif re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', cell_text):
                                    deadline_text = cell_text
                                    break
                            
                            # Extract value (look for currency patterns)
                            for cell in cells:
                                cell_text = cell.get_text(strip=True)
                                if re.search(r'[₹$€£]\s*\d+|\d+[,\d]*\s*(lakh|crore|million|billion)', cell_text, re.I):
                                    value_text = cell_text
                                    break
                            
                            # Skip if no meaningful title found
                            if not title or len(title) < 10:
                                continue
                            
                            # Generate tender ID from title
                            tid = re.sub(r'\W+', '-', title.lower())[:40]
                            
                            # Parse deadline
                            deadline_iso = None
                            if deadline_text:
                                try:
                                    # Handle format like "27-October-2025 03:00:00 PM"
                                    if re.search(r'\d{1,2}-\w+-\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)', deadline_text, re.I):
                                        # Extract just the date part
                                        date_part = re.search(r'(\d{1,2}-\w+-\d{4})', deadline_text)
                                        if date_part:
                                            date_str = date_part.group(1)
                                            # Convert month name to number
                                            month_map = {
                                                'january': '01', 'february': '02', 'march': '03', 'april': '04',
                                                'may': '05', 'june': '06', 'july': '07', 'august': '08',
                                                'september': '09', 'october': '10', 'november': '11', 'december': '12'
                                            }
                                            parts = date_str.split('-')
                                            if len(parts) == 3:
                                                day, month_name, year = parts
                                                month_num = month_map.get(month_name.lower(), '01')
                                                formatted_date = f"{day}-{month_num}-{year}"
                                                dt = datetime.strptime(formatted_date, '%d-%m-%Y')
                                                deadline_iso = dt.isoformat()
                                    else:
                                        # Try standard date formats
                                        date_patterns = [
                                            r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
                                            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2})',
                                            r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})'
                                        ]
                                        for pattern in date_patterns:
                                            m = re.search(pattern, deadline_text)
                                            if m:
                                                date_str = m.group(1).replace('/', '-')
                                                if len(date_str.split('-')[2]) == 2:  # Convert YY to YYYY
                                                    date_str = date_str[:-2] + '20' + date_str[-2:]
                                                dt = datetime.strptime(date_str, '%d-%m-%Y')
                                                deadline_iso = dt.isoformat()
                                                break
                                except Exception as e:
                                    print(f"Date parsing error: {e}")
                                    pass
                            
                            # Calculate TTLH score
                            score = _score_ttlh([title, organization, sector])
                            if ttlh_only and score == 0:
                                continue
                            
                            items.append(_standardize_item({
                                'tender_id': f'gem-{tid}',
                                'source': 'gem',
                                'title': title,
                                'organization': organization or 'Government Organization',
                                'sector': sector or 'Government',
                                'deadline': deadline_iso,
                                'value': value_text or 'Not disclosed',
                                'url': tender_url or self.BASE_URL,
                                'ttlh_score': score,
                            }))
                            
                            print(f"GEM: Added tender - {title[:50]}... (TTLH score: {score})")
                            
                        except Exception as e:
                            print(f"GEM: Error processing row: {e}")
                            continue
                
                except Exception as e:
                    print(f"GEM: Error scraping page {page_num}: {e}")
                    continue
                    
        except Exception as e:
            print(f"GEM: Scraping error: {e}")
            items = []

        print(f"GEM: Returning {len(items)} tenders")
        _cache_set(cache_key, items)
        return items


class IDEXScraper:
    BASE_URL = 'https://idex.gov.in/challenges'

    def fetch(self, limit: int = 10, ttlh_only: bool = True, max_pages: int = 10) -> List[Dict[str, Any]]:
        cache_key = f'idex:pages{max_pages}:ttlh={ttlh_only}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached[:limit]

        items: List[Dict[str, Any]] = []
        try:
            # Use requests with proper headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            # Scrape multiple pages
            for page_num in range(1, max_pages + 1):
                if len(items) >= limit:
                    break
                    
                # Construct URL for each page
                if page_num == 1:
                    url = self.BASE_URL
                else:
                    url = f"{self.BASE_URL}?page={page_num}"
                
                print(f"IDEX: Scraping page {page_num} - {url}")
                
                try:
                    response = requests.get(url, headers=headers, timeout=30, verify=False)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for challenge cards - IDEX uses card-based layout
                    challenge_cards = soup.select('.card, .challenge-card, [class*="challenge"], [class*="card"]')
                    if not challenge_cards:
                        # Fallback: look for any divs that might contain challenge info
                        challenge_cards = soup.find_all('div', {'class': re.compile(r'card|challenge|item', re.I)})
                    
                    print(f"IDEX: Page {page_num} - Found {len(challenge_cards)} potential challenge cards")
                    
                    if not challenge_cards:
                        print(f"IDEX: No more challenges found on page {page_num}, stopping pagination")
                        break
                    
                    for card in challenge_cards:
                        if len(items) >= limit:
                            break
                        
                        try:
                            # Extract challenge information
                            title = ""
                            description = ""
                            deadline_text = ""
                            challenge_url = ""
                            status = ""
                            
                            # Look for title in various selectors
                            title_selectors = [
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                '.title', '.challenge-title', '.card-title',
                                '[class*="title"]', '[class*="heading"]'
                            ]
                            
                            for selector in title_selectors:
                                title_elem = card.select_one(selector)
                                if title_elem and title_elem.get_text(strip=True):
                                    title = title_elem.get_text(strip=True)
                                    break
                            
                            # Look for description
                            desc_selectors = [
                                'p', '.description', '.desc', '.summary',
                                '[class*="desc"]', '[class*="summary"]'
                            ]
                            
                            for selector in desc_selectors:
                                desc_elem = card.select_one(selector)
                                if desc_elem and desc_elem.get_text(strip=True):
                                    description = desc_elem.get_text(strip=True)
                                    break
                            
                            # Look for deadline/date information
                            date_selectors = [
                                '.date', '.deadline', '.closing', '.last-date',
                                '[class*="date"]', '[class*="deadline"]', '[class*="closing"]'
                            ]
                            
                            for selector in date_selectors:
                                date_elem = card.select_one(selector)
                                if date_elem and date_elem.get_text(strip=True):
                                    deadline_text = date_elem.get_text(strip=True)
                                    break
                            
                            # Look for links
                            link_elem = card.select_one('a[href]')
                            if link_elem and link_elem.get('href'):
                                href = link_elem.get('href')
                                if href.startswith('/'):
                                    challenge_url = f"https://idex.gov.in{href}"
                                elif href.startswith('http'):
                                    challenge_url = href
                                else:
                                    challenge_url = f"https://idex.gov.in/{href}"
                            
                            # Look for status/button text
                            button_elem = card.select_one('button, .btn, [class*="button"]')
                            if button_elem and button_elem.get_text(strip=True):
                                status = button_elem.get_text(strip=True)
                            
                            # Skip if no meaningful title found
                            if not title or len(title) < 5:
                                continue
                            
                            # Generate challenge ID
                            cid = re.sub(r'\W+', '-', title.lower())[:40]
                            
                            # Parse deadline
                            deadline_iso = None
                            if deadline_text:
                                # Look for date patterns like "30 Oct, 2025" or "30/10/2025"
                                date_patterns = [
                                    r'(\d{1,2}\s+\w+\s*,\s*\d{4})',  # "30 Oct, 2025"
                                    r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',  # "30/10/2025"
                                    r'(\d{1,2}[-/]\d{1,2}[-/]\d{2})',  # "30/10/25"
                                ]
                                
                                for pattern in date_patterns:
                                    m = re.search(pattern, deadline_text)
                                    if m:
                                        try:
                                            date_str = m.group(1).strip()
                                            # Handle "30 Oct, 2025" format
                                            if ',' in date_str:
                                                dt = datetime.strptime(date_str, '%d %b, %Y')
                                            else:
                                                # Handle numeric formats
                                                date_str = date_str.replace('/', '-')
                                                if len(date_str.split('-')[2]) == 2:
                                                    date_str = date_str[:-2] + '20' + date_str[-2:]
                                                dt = datetime.strptime(date_str, '%d-%m-%Y')
                                            deadline_iso = dt.isoformat()
                                            break
                                        except Exception:
                                            continue
                            
                            # Calculate TTLH score
                            score = _score_ttlh([title, description])
                            if ttlh_only and score == 0:
                                continue
                            
                            items.append(_standardize_item({
                                'tender_id': f'idex-{cid}',
                                'source': 'idex',
                                'title': title,
                                'organization': 'IDEX (Ministry of Defence)',
                                'sector': 'Defence Challenge',
                                'description': description,
                                'deadline': deadline_iso,
                                'value': status or 'Challenge',
                                'url': challenge_url or self.BASE_URL,
                                'ttlh_score': score,
                            }))
                            
                            print(f"IDEX: Added challenge - {title[:50]}... (TTLH score: {score})")
                            
                        except Exception as e:
                            print(f"IDEX: Error processing card: {e}")
                            continue
                
                except Exception as e:
                    print(f"IDEX: Error scraping page {page_num}: {e}")
                    continue
                    
        except Exception as e:
            print(f"IDEX: Scraping error: {e}")
            items = []

        print(f"IDEX: Returning {len(items)} challenges")
        _cache_set(cache_key, items)
        return items


class TataInnoverseScraper:
    BASE_URL = 'https://tatainnoverse.com/Home/AllChallenges?status=open'

    def fetch(self, limit: int = 10, ttlh_only: bool = True, max_pages: int = 10) -> List[Dict[str, Any]]:
        cache_key = f'tata:pages{max_pages}:ttlh={ttlh_only}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached[:limit]

        items: List[Dict[str, Any]] = []
        try:
            # Use requests with proper headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            # Scrape multiple pages
            for page_num in range(1, max_pages + 1):
                if len(items) >= limit:
                    break
                    
                # Construct URL for each page
                if page_num == 1:
                    url = self.BASE_URL
                else:
                    url = f"{self.BASE_URL}&page={page_num}"
                
                print(f"Tata: Scraping page {page_num} - {url}")
                
                try:
                    response = requests.get(url, headers=headers, timeout=30, verify=False)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for challenge cards - Tata uses card-based layout
                    challenge_cards = soup.select('.card, .challenge-card, [class*="challenge"], [class*="card"]')
                    if not challenge_cards:
                        # Fallback: look for divs containing challenge information
                        challenge_cards = soup.find_all('div', {'class': re.compile(r'card|challenge|item', re.I)})
                    
                    print(f"Tata: Page {page_num} - Found {len(challenge_cards)} potential challenge cards")
                    
                    if not challenge_cards:
                        print(f"Tata: No more challenges found on page {page_num}, stopping pagination")
                        break
                    
                    for card in challenge_cards:
                        if len(items) >= limit:
                            break
                        
                        try:
                            # Extract challenge information
                            title = ""
                            description = ""
                            deadline_text = ""
                            challenge_url = ""
                            reward_type = ""
                            categories = []
                            
                            # Look for title - Tata challenges have prominent titles
                            title_selectors = [
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                '.title', '.challenge-title', '.card-title',
                                '[class*="title"]', '[class*="heading"]'
                            ]
                            
                            for selector in title_selectors:
                                title_elem = card.select_one(selector)
                                if title_elem and title_elem.get_text(strip=True):
                                    title = title_elem.get_text(strip=True)
                                    break
                            
                            # Look for description
                            desc_selectors = [
                                'p', '.description', '.desc', '.summary',
                                '[class*="desc"]', '[class*="summary"]'
                            ]
                            
                            for selector in desc_selectors:
                                desc_elem = card.select_one(selector)
                                if desc_elem and desc_elem.get_text(strip=True):
                                    description = desc_elem.get_text(strip=True)
                                    break
                            
                            # Look for deadline information - Tata uses "Closing on Reward 04 Nov 2025" format
                            deadline_selectors = [
                                '.date', '.deadline', '.closing', '.reward-date',
                                '[class*="date"]', '[class*="deadline"]', '[class*="closing"]'
                            ]
                            
                            for selector in deadline_selectors:
                                date_elem = card.select_one(selector)
                                if date_elem and date_elem.get_text(strip=True):
                                    deadline_text = date_elem.get_text(strip=True)
                                    break
                            
                            # Look for reward type (attractive, commensurate)
                            reward_selectors = [
                                '.reward', '.reward-type', '[class*="reward"]'
                            ]
                            
                            for selector in reward_selectors:
                                reward_elem = card.select_one(selector)
                                if reward_elem and reward_elem.get_text(strip=True):
                                    reward_type = reward_elem.get_text(strip=True)
                                    break
                            
                            # Look for categories/tags
                            category_selectors = [
                                '.category', '.tag', '.badge', '[class*="category"]', '[class*="tag"]'
                            ]
                            
                            for selector in category_selectors:
                                category_elems = card.select(selector)
                                for elem in category_elems:
                                    cat_text = elem.get_text(strip=True)
                                    if cat_text and len(cat_text) > 2:
                                        categories.append(cat_text)
                            
                            # Look for links
                            link_elem = card.select_one('a[href]')
                            if link_elem and link_elem.get('href'):
                                href = link_elem.get('href')
                                if href.startswith('/'):
                                    challenge_url = f"https://tatainnoverse.com{href}"
                                elif href.startswith('http'):
                                    challenge_url = href
                                else:
                                    challenge_url = f"https://tatainnoverse.com/{href}"
                            
                            # Skip if no meaningful title found
                            if not title or len(title) < 10:
                                continue
                            
                            # Generate challenge ID
                            cid = re.sub(r'\W+', '-', title.lower())[:40]
                            
                            # Parse deadline - handle "04 Nov 2025" format
                            deadline_iso = None
                            if deadline_text:
                                # Look for date patterns like "04 Nov 2025"
                                date_patterns = [
                                    r'(\d{1,2}\s+\w+\s+\d{4})',  # "04 Nov 2025"
                                    r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',  # "04/11/2025"
                                    r'(\d{1,2}[-/]\d{1,2}[-/]\d{2})',  # "04/11/25"
                                ]
                                
                                for pattern in date_patterns:
                                    m = re.search(pattern, deadline_text)
                                    if m:
                                        try:
                                            date_str = m.group(1).strip()
                                            # Handle "04 Nov 2025" format
                                            if re.search(r'\d{1,2}\s+\w+\s+\d{4}', date_str):
                                                dt = datetime.strptime(date_str, '%d %b %Y')
                                            else:
                                                # Handle numeric formats
                                                date_str = date_str.replace('/', '-')
                                                if len(date_str.split('-')[2]) == 2:
                                                    date_str = date_str[:-2] + '20' + date_str[-2:]
                                                dt = datetime.strptime(date_str, '%d-%m-%Y')
                                            deadline_iso = dt.isoformat()
                                            break
                                        except Exception:
                                            continue
                            
                            # Combine categories into sector
                            sector = ', '.join(categories[:3]) if categories else 'Innovation Challenge'
                            
                            # Calculate TTLH score
                            score = _score_ttlh([title, description, sector])
                            if ttlh_only and score == 0:
                                continue
                            
                            items.append(_standardize_item({
                                'tender_id': f'tata-{cid}',
                                'source': 'tata',
                                'title': title,
                                'organization': 'Tata Group',
                                'sector': sector,
                                'description': description,
                                'deadline': deadline_iso,
                                'value': reward_type or 'Challenge',
                                'url': challenge_url or self.BASE_URL,
                                'ttlh_score': score,
                            }))
                            
                            print(f"Tata: Added challenge - {title[:50]}... (TTLH score: {score})")
                            
                        except Exception as e:
                            print(f"Tata: Error processing card: {e}")
                            continue
                
                except Exception as e:
                    print(f"Tata: Error scraping page {page_num}: {e}")
                    continue
                    
        except Exception as e:
            print(f"Tata: Scraping error: {e}")
            items = []

        print(f"Tata: Returning {len(items)} challenges")
        _cache_set(cache_key, items)
        return items


def fetch_all_sources(limit_per_source: int = 10, ttlh_only: bool = True, max_pages: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    gem = GEMScraper().fetch(limit_per_source, ttlh_only, max_pages)
    idex = IDEXScraper().fetch(limit_per_source, ttlh_only, max_pages)
    tata = TataInnoverseScraper().fetch(limit_per_source, ttlh_only, max_pages)
    return {'gem': gem, 'idex': idex, 'tata': tata, 'last_updated': _now_iso()}


