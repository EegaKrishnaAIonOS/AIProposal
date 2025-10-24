import React, { useEffect, useState } from 'react';
import { ArrowLeft, Heart, Calendar, ExternalLink, Building2, Search, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TenderChatBox from '../components/TenderChatBox.jsx';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { 
    return new Date(dateStr).toLocaleDateString('en-IN'); 
  } catch { 
    return '—'; 
  }
}

function formatValue(val) {
  if (!val || /not/i.test(String(val))) return 'Not disclosed';
  try { 
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(Number(String(val).replace(/[^\d.]/g, ''))); 
  } catch { 
    return String(val); 
  }
}

function SectorBadge({sector}) {
  const s = (sector || '').toLowerCase();
  let cls = 'bg-purple-100 text-purple-800';
  if (/hospitality|hotel|cater/.test(s)) cls = 'bg-orange-100 text-orange-800';
  else if (/logistic|warehouse|supply/.test(s)) cls = 'bg-green-100 text-green-800';
  else if (/transport|railway|fleet|airport|metro|bus/.test(s)) cls = 'bg-blue-100 text-blue-800';
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>{sector || '—'}</span>;
}

function WishlistRow({item, onRemove}) {
  const [isRemoving, setIsRemoving] = useState(false);
  
  const handleRemove = async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      await onRemove(item.id);
    } finally {
      setIsRemoving(false);
    }
  };
  
  return (
    <tr className="hover:bg-orange-50 transition">
      <td className="px-8 py-4 text-sm text-gray-900" style={{maxWidth: '224px', wordWrap: 'break-word'}}>
        <div className="flex items-start gap-2 max-w-full">
          <Building2 size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/>
          <span className="break-words leading-relaxed overflow-hidden" style={{maxWidth: 'calc(100% - 24px)'}}>{item.organization || '—'}</span>
        </div>
      </td>
      <td className="px-8 py-4 text-sm">
        <div className="font-medium text-gray-900 break-words leading-relaxed">
          {item.title}
        </div>
        {item.summary && (
          <div className="text-gray-500 text-xs mt-1 line-clamp-2 break-words">
            {item.summary}
          </div>
        )}
      </td>
      <td className="px-8 py-4">
        <SectorBadge sector={item.sector}/>
      </td>
      <td className="px-8 py-4 text-sm text-gray-800">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400 flex-shrink-0"/>
          <span className="break-words">{formatDate(item.deadline)}</span>
        </div>
      </td>
      <td className="px-8 py-4 text-sm text-gray-800">
        <span className="break-words">{formatValue(item.value)}</span>
      </td>
      <td className="px-8 py-4 text-sm text-gray-500">
        <span className="break-words">{new Date(item.created_at).toLocaleDateString('en-IN')}</span>
      </td>
      <td className="px-8 py-4 text-right">
        <div className="flex items-center gap-2 justify-end">
          <a 
            href={item.url} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap"
          >
            View <ExternalLink size={16}/>
          </a>
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 flex-shrink-0 ${
              isRemoving 
                ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' 
                : 'bg-white text-red-400 border-red-200 hover:text-red-600 hover:border-red-300 hover:bg-red-50'
            }`}
            aria-label="Remove from wishlist"
          >
            <Trash2 size={16}/>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [notification, setNotification] = useState(null);

  // Notification helper
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchWishlist = async (pageNum = 1, search = '', sort = 'created_at') => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        sort: sort
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }
      
      const res = await fetch(`/api/wishlists?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load wishlist');
      
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total_count || 0);
      setTotalPages(data.total_pages || 0);
      setPage(data.page || 1);
    } catch (e) {
      setError('Failed to load wishlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (wishlistId) => {
    try {
      const res = await fetch(`/api/wishlists/${wishlistId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        const result = await res.json();
        
        // Remove from local state
        setItems(prev => prev.filter(item => item.id !== wishlistId));
        setTotal(prev => Math.max(0, prev - 1));
        
        // Show success notification
        showNotification(result.message || 'Removed from wishlist', 'success');
        
        // If current page is empty and not the first page, go to previous page
        if (items.length === 1 && page > 1) {
          const newPage = page - 1;
          setPage(newPage);
          fetchWishlist(newPage, searchTerm, sortBy);
        } else {
          // Refresh current page
          fetchWishlist(page, searchTerm, sortBy);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to remove from wishlist');
      }
    } catch (e) {
      console.error('Error removing from wishlist:', e);
      showNotification(e.message || 'Failed to remove item from wishlist', 'error');
    }
  };

  const clearAllWishlist = async () => {
    if (!window.confirm('Are you sure you want to clear all wishlist items? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Remove all items one by one (in a real app, you'd have a bulk delete endpoint)
      for (const item of items) {
        await fetch(`/api/wishlists/${item.id}`, { method: 'DELETE' });
      }
      
      setItems([]);
      setTotal(0);
      setPage(1);
      setTotalPages(0);
    } catch (e) {
      console.error('Error clearing wishlist:', e);
      setError('Failed to clear wishlist');
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setPage(1);
    fetchWishlist(1, value, sortBy);
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    setPage(1);
    fetchWishlist(1, searchTerm, value);
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const isEmpty = !loading && items.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <button 
              onClick={() => navigate('/tenders')} 
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={18}/> Back to Tenders
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
              <Heart size={24} className="text-orange-600 fill-current"/>
              Wishlist
            </h1>
            <p className="text-sm text-gray-500">Your saved tenders and challenges</p>
            <p className="text-xs text-gray-400 mt-1">
              {total > 0 ? `Showing ${items.length} of ${total} wishlist items` : 'No items in wishlist'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {total > 0 && (
              <button 
                onClick={clearAllWishlist}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                <Trash2 size={18}/>
                Clear All
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Search and Sort Controls */}
        {total > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                  <input
                    type="text"
                    placeholder="Search wishlist items..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => handleSearch({ target: { value: '' } })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16}/>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="created_at">Date Added</option>
                  <option value="deadline">Deadline</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Wishlist Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse table-fixed" style={{minWidth: '1200px'}}>
            <thead className="bg-gray-50">
              <tr>
                <th className="w-56 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                <th className="w-96 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title & Summary</th>
                <th className="w-40 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sector</th>
                <th className="w-36 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deadline</th>
                <th className="w-40 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="w-28 px-8 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Added</th>
                <th className="w-40 px-8 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length: 5}).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-40"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-full mb-2"/><div className="h-3 bg-gray-100 rounded w-3/4"/></td>
                  <td className="px-8 py-4"><div className="h-6 bg-gray-200 rounded w-24"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-28"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-32"/></td>
                  <td className="px-8 py-4"><div className="h-4 bg-gray-200 rounded w-20"/></td>
                  <td className="px-8 py-4"><div className="h-8 bg-gray-200 rounded w-28 ml-auto"/></td>
                </tr>
              ))}
              {!loading && items.map((item) => (
                <WishlistRow 
                  key={item.id} 
                  item={item} 
                  onRemove={removeFromWishlist}
                />
              ))}
              {isEmpty && (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Heart size={48} className="text-gray-300"/>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No wishlist items yet</h3>
                        <p className="text-gray-500 mb-4">
                          Click the heart icon on any tender to save it to your wishlist.
                        </p>
                        <button
                          onClick={() => navigate('/tenders')}
                          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg"
                        >
                          Browse Tenders
                        </button>
                      </div>
                    </div>
                  </td>
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
              onClick={() => fetchWishlist(page - 1, searchTerm, sortBy)} 
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchWishlist(pageNum, searchTerm, sortBy)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      page === pageNum
                        ? 'bg-orange-600 text-white border-orange-600'
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
              onClick={() => fetchWishlist(page + 1, searchTerm, sortBy)} 
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
        
        {/* Page info */}
        {totalPages > 0 && (
          <div className="text-center text-sm text-gray-500 mt-2">
            Page {page} of {totalPages} • Showing {items.length} of {total} wishlist items
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        
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
        <TenderChatBox tenders={items} />
      </main>
    </div>
  );
}
