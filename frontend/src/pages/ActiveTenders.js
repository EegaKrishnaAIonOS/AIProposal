import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Calendar, ExternalLink, Building2, Search, X, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import TenderChatBox from '../components/TenderChatBox.jsx';

function formatDate(dateStr){
  if(!dateStr) return '—';
  try{ return new Date(dateStr).toLocaleDateString('en-IN'); }catch{ return '—'; }
}
function formatValue(val){
  if(!val || /not/i.test(String(val))) return 'Not disclosed';
  try{ return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(String(val).replace(/[^\d.]/g,''))); }catch{ return String(val); }
}

function SectorBadge({sector}){
  const s = (sector||'').toLowerCase();
  let cls = 'bg-purple-100 text-purple-800';
  if(/hospitality|hotel|cater/.test(s)) cls = 'bg-orange-100 text-orange-800';
  else if(/logistic|warehouse|supply/.test(s)) cls = 'bg-green-100 text-green-800';
  else if(/transport|railway|fleet|airport|metro|bus/.test(s)) cls = 'bg-blue-100 text-blue-800';
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>{sector || '—'}</span>;
}

function TenderRow({t, wishlistMap, wishlistLoading, onToggleWishlist}){
  const isWishlisted = wishlistMap[t.tender_id];
  const isLoading = wishlistLoading[t.tender_id];
  
  return (
    <tr className="hover:bg-purple-50 transition">
      <td className="px-8 py-4 text-sm text-gray-900" style={{maxWidth: '224px', wordWrap: 'break-word'}}>
        <div className="flex items-start gap-2 max-w-full">
          <Building2 size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/>
          <span className="break-words leading-relaxed overflow-hidden" style={{maxWidth: 'calc(100% - 24px)'}}>{t.organization || '—'}</span>
        </div>
      </td>
      <td className="px-8 py-4 text-sm">
        <div className="font-medium text-gray-900 break-words leading-relaxed">
          {t.title}
        </div>
        {t.description && (
          <div className="text-gray-500 text-xs mt-1 line-clamp-2 break-words">
            {t.description}
          </div>
        )}
      </td>
      <td className="px-8 py-4">
        <SectorBadge sector={t.sector}/>
      </td>
      <td className="px-8 py-4 text-sm text-gray-800">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400 flex-shrink-0"/>
          <span className="break-words">{formatDate(t.deadline)}</span>
        </div>
      </td>
      <td className="px-8 py-4 text-sm text-gray-800">
        <span className="break-words">{formatValue(t.value)}</span>
      </td>
      <td className="px-8 py-4 text-right">
        <div className="flex items-center gap-2 justify-end">
          <a 
            href={t.url} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap"
          >
            View <ExternalLink size={16}/>
          </a>
          <button
            onClick={() => onToggleWishlist(t.tender_id)}
            disabled={isLoading}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 flex-shrink-0 ${
              isWishlisted 
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' 
                : 'bg-white text-gray-400 border-gray-200 hover:text-purple-600 hover:border-purple-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isWishlisted}
          >
            <Heart 
              size={16} 
              className={isWishlisted ? 'fill-current' : ''}
            />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ActiveTenders(){
  const navigate = useNavigate();
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [source,setSource] = useState('all');
  const [page,setPage] = useState(1);
  const [ttlhOnly,setTtlhOnly] = useState(true);
  const [data,setData] = useState({gem:[], idex:[], tata:[]});
  const [total,setTotal] = useState(0);
  const [totalPages,setTotalPages] = useState(0);
  const [lastUpdated,setLastUpdated] = useState(null);
  
  // New state for search and date filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Wishlist state
  const [wishlistMap, setWishlistMap] = useState({}); // tender_id -> wishlist_id
  const [wishlistCount, setWishlistCount] = useState(0);
  const [wishlistLoading, setWishlistLoading] = useState({});
  const [notification, setNotification] = useState(null);

  const fetchTenders = async (refresh=false) =>{
    setLoading(true); setError('');
    try{
      if(refresh){ await fetch('/api/tenders/refresh',{method:'POST'}); }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        source: source,
        sector_filter: ttlhOnly.toString()
      });
      
      if(searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if(startDate) {
        params.append('start_date', startDate);
      }
      if(endDate) {
        params.append('end_date', endDate);
      }
      
      const res = await fetch(`/api/tenders?${params.toString()}`);
      if(!res.ok) throw new Error('Failed to load');
      const j = await res.json();
      setData(j.tenders||{gem:[],idex:[],tata:[]});
      setTotal(j.total_count||0);
      setTotalPages(j.total_pages||0);
      setLastUpdated(j.last_updated||null);
    }catch(e){ setError('Failed to load tenders. Please try again.'); }
    finally{ setLoading(false); }
  };

  // Wishlist API functions
  const fetchWishlistStatus = async () => {
    try {
      const allTenderIds = [];
      Object.values(data).forEach(tenderList => {
        tenderList.forEach(tender => {
          if (tender.tender_id) allTenderIds.push(tender.tender_id);
        });
      });
      
      if (allTenderIds.length === 0) return;
      
      const res = await fetch(`/api/wishlists/status?tender_ids=${allTenderIds.join(',')}`);
      if (res.ok) {
        const result = await res.json();
        setWishlistMap(result.status_map || {});
      }
    } catch (e) {
      console.error('Error fetching wishlist status:', e);
    }
  };

  const fetchWishlistCount = async () => {
    try {
      const res = await fetch('/api/wishlists/count');
      if (res.ok) {
        const result = await res.json();
        setWishlistCount(result.count || 0);
      }
    } catch (e) {
      console.error('Error fetching wishlist count:', e);
    }
  };

  // Notification helper
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleWishlist = async (tenderId) => {
    if (wishlistLoading[tenderId]) return; // Prevent double clicks
    
    setWishlistLoading(prev => ({ ...prev, [tenderId]: true }));
    
    try {
      const res = await fetch(`/api/wishlists/toggle?tender_id=${encodeURIComponent(tenderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const result = await res.json();
        
        // Update wishlist map
        setWishlistMap(prev => {
          const newMap = { ...prev };
          if (result.wishlisted) {
            newMap[tenderId] = result.wishlist_id;
          } else {
            delete newMap[tenderId];
          }
          return newMap;
        });
        
        // Update count
        setWishlistCount(prev => result.wishlisted ? prev + 1 : Math.max(0, prev - 1));
        
        // Show notification
        showNotification(result.message || 'Wishlist updated', 'success');
        
        // Refresh wishlist status to ensure UI stays in sync
        fetchWishlistStatus();
        fetchWishlistCount();
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to toggle wishlist');
      }
    } catch (e) {
      console.error('Error toggling wishlist:', e);
      showNotification(e.message || 'Failed to update wishlist', 'error');
    } finally {
      setWishlistLoading(prev => ({ ...prev, [tenderId]: false }));
    }
  };

  useEffect(() => {
    // Only fetch wishlist status if we have tender data
    if (data && (data.gem?.length > 0 || data.idex?.length > 0 || data.tata?.length > 0)) {
      fetchWishlistStatus();
      fetchWishlistCount();
    }
  }, [data]);

  useEffect(()=>{ fetchTenders(false); },[page, source, ttlhOnly, searchTerm, startDate, endDate]);
  useEffect(()=>{ const i = setInterval(()=>fetchTenders(false), 30*60*1000); return ()=>clearInterval(i); },[]);

  const rows = useMemo(()=>{
    const arr = [];
    if(source==='gem' || source==='all') arr.push(...(data.gem||[]));
    if(source==='idex' || source==='all') arr.push(...(data.idex||[]));
    if(source==='tata' || source==='all') arr.push(...(data.tata||[]));
    return arr;
  },[data, source]);

  const isEmpty = !loading && rows.length===0;

  // Helper functions for filters
  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || startDate || endDate;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when searching
  };

  const handleDateChange = (type, value) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setPage(1); // Reset to first page when filtering by date
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <button onClick={()=>navigate('/dashboard')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18}/> Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Active Tenders</h1>
            <p className="text-sm text-gray-500">Transport • Travel • Logistics • Hospitality</p>
            <p className="text-xs text-gray-400 mt-1">{`Showing ${rows.length} of ${total} tenders`}{lastUpdated?` • Last updated: ${new Date(lastUpdated).toLocaleString()}`:''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>navigate('/wishlist')} className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
              <Heart size={18} className="fill-current"/>
              Wishlist View
              {wishlistCount > 0 && (
                <span className="bg-white text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {wishlistCount}
                </span>
              )}
            </button>
            <button onClick={()=>fetchTenders(true)} className={`inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg ${loading?'opacity-80':''}`}>
              <RefreshCw size={18} className={loading?'animate-spin':''}/> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          {/* Main filter row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              {['all','gem','idex','tata'].map(s=> (
                <button key={s} onClick={()=>{setPage(1); setSource(s);}} className={`px-3 py-1.5 rounded-lg text-sm border ${source===s?'bg-purple-600 text-white border-purple-600':'bg-white text-gray-700 border-gray-200'}`}>{s==='all'?'All':s.toUpperCase()}</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={ttlhOnly} onChange={e=>{setPage(1); setTtlhOnly(e.target.checked);}}/> TTLH Focus Only
              </label>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50"
              >
                <Search size={16}/>
                Advanced Filters
                {hasActiveFilters && <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">Active</span>}
              </button>
            </div>
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                    <input
                      type="text"
                      placeholder="Search title, organization, sector, value..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Start date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleDateChange('start', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* End date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleDateChange('end', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <X size={16}/>
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse table-fixed" style={{minWidth: '1200px'}}>
            <thead className="bg-gray-50">
              <tr>
                <th className="w-56 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                <th className="w-96 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tender Title</th>
                <th className="w-40 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sector</th>
                <th className="w-36 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deadline</th>
                <th className="w-40 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="w-40 px-8 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length:10}).map((_,i)=> (
                <tr key={i} className="animate-pulse">
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-40"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-full mb-2"/><div className="h-3 bg-gray-100 rounded w-3/4"/></td>
                  <td className="px-8 py-4"><div className="h-6 bg-gray-200 rounded w-24"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-28"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-32"/></td>
                  <td className="px-8 py-4"><div className="h-8 bg-gray-200 rounded w-28 ml-auto"/></td>
                </tr>
              ))}
              {!loading && rows.map((t,i)=> <TenderRow key={`${t.tender_id}-${i}`} t={t} wishlistMap={wishlistMap} wishlistLoading={wishlistLoading} onToggleWishlist={toggleWishlist}/>) }
              {isEmpty && (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-gray-500">No tenders found matching your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button 
              disabled={page === 1 || loading} 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      page === pageNum
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button 
              disabled={loading || page >= totalPages} 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
        
        {/* Page info */}
        {totalPages > 0 && (
          <div className="text-center text-sm text-gray-500 mt-2">
            Page {page} of {totalPages} • Showing {rows.length} of {total} tenders
          </div>
        )}
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
        
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
            notification.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}/>
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}
        
        {/* Tender ChatBot */}
        <TenderChatBox tenders={rows} />
      </main>
    </div>
  );
}


