import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, AlertTriangle, FileText, 
  DollarSign, User, Calendar, Search, Filter,
  Eye, ThumbsUp, ThumbsDown, Copy, Image as ImageIcon,
  ArrowLeft, Menu, X
} from 'lucide-react';
import axios from 'axios';

// Use relative URLs - works in both local dev and production (Railway)
const API_BASE = '/api';
const API_IMAGE_BASE = '';

export default function AdminVerificationPage() {
  const [activeTab, setActiveTab] = useState('verifications'); // verifications | duplicates | stats
  const [verifications, setVerifications] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [filter, setFilter] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load data on mount and tab change
  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Close mobile menu when tab changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'verifications') {
        const response = await axios.get(`${API_BASE}/admin/verifications`);
        setVerifications(response.data.expenses);
      } else if (activeTab === 'duplicates') {
        const response = await axios.get(`${API_BASE}/admin/duplicates`);
        setDuplicates(response.data.duplicates);
      } else if (activeTab === 'stats') {
        // Try to get stats, fallback to calculating from verifications
        try {
          const response = await axios.get(`${API_BASE}/admin/stats`);
          setStats(response.data);
        } catch {
          // Fallback: calculate basic stats
          const verifResponse = await axios.get(`${API_BASE}/admin/verifications?limit=1000`);
          const allExpenses = verifResponse.data.expenses;
          const pending = allExpenses.filter(e => e.status === 'pending_verification').length;
          const approved = allExpenses.filter(e => e.status === 'approved').length;
          const rejected = allExpenses.filter(e => e.status === 'rejected').length;
          setStats({
            totalExpenses: allExpenses.length,
            pendingVerifications: pending,
            approved,
            rejected,
            flaggedDuplicates: 0,
            totalReceipts: allExpenses.reduce((sum, e) => sum + (e.receiptCount || 0), 0)
          });
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (expenseId, action) => {
    try {
      await axios.post(`${API_BASE}/admin/verifications/${expenseId}`, {
        action,
        notes: verificationNotes,
        adminId: 'admin-1' // In real app, from auth context
      });
      setSelectedItem(null);
      setVerificationNotes('');
      loadData();
    } catch (error) {
      console.error('Verification error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleResolveDuplicate = async (receiptId, isDuplicate) => {
    try {
      await axios.post(`${API_BASE}/admin/duplicates/${receiptId}/resolve`, {
        isDuplicate,
        notes: verificationNotes
      });
      setSelectedItem(null);
      setVerificationNotes('');
      loadData();
    } catch (error) {
      console.error('Resolve error:', error);
      alert('Error: ' + error.message);
    }
  };

  const formatCurrency = (amount, currency = 'MYR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  // Stats View - Mobile Optimized
  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Total Expenses</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.totalExpenses}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Pending</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.pendingVerifications}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <Copy className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Duplicates</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.flaggedDuplicates}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Approved</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.approved}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Rejected</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.rejected}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-gray-600" />
            </div>
            <span className="text-xs sm:text-gray-600">Receipts</span>
          </div>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.totalReceipts}</p>
        </div>
      </div>
    );
  };

  // Verifications List View - Mobile Optimized
  const renderVerifications = () => {
    const filtered = verifications.filter(v => 
      v.userId?.toLowerCase().includes(filter.toLowerCase()) ||
      v.notes?.toLowerCase().includes(filter.toLowerCase())
    );

    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="sticky top-[73px] sm:static z-20 bg-gray-50 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by user or notes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {filtered.map(expense => (
          <div 
            key={expense.id} 
            className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 hover:shadow-md transition cursor-pointer"
            onClick={() => setSelectedItem({ type: 'expense', data: expense })}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-yellow-100 text-yellow-800 px-2 sm:px-3 py-1 rounded-full text-xs font-medium">
                    Pending
                  </span>
                  <span className="text-xs text-gray-500">
                    {expense.receiptCount} receipts
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {formatCurrency(expense.total, expense.receipts?.[0]?.ocrData?.currency)}
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{expense.userId}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(expense.submittedAt)}
                  </span>
                </div>
                {expense.notes && (
                  <p className="text-gray-600 text-xs sm:text-sm bg-gray-50 p-2 rounded line-clamp-2">
                    {expense.notes}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ type: 'expense', data: expense });
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg self-start touch-target"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-green-300" />
            <p className="text-base sm:text-lg font-medium">No pending verifications</p>
          </div>
        )}
      </div>
    );
  };

  // Duplicates List View - Mobile Optimized
  const renderDuplicates = () => {
    return (
      <div className="space-y-3 sm:space-y-4">
        {duplicates.map(receipt => (
          <div 
            key={receipt.id}
            className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 hover:shadow-md transition cursor-pointer"
            onClick={() => setSelectedItem({ type: 'duplicate', data: receipt })}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Dup ({Math.round(receipt.duplicateConfidence * 100)}%)
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {receipt.ocrData?.categoryName || 'Uncategorized'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {formatCurrency(receipt.ocrData?.amount, receipt.ocrData?.currency)} 
                  <span className="text-sm font-normal text-gray-500 ml-2 truncate block sm:inline">
                    {receipt.ocrData?.merchant || 'Unknown'}
                  </span>
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{receipt.userId}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(receipt.uploadedAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ type: 'duplicate', data: receipt });
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg self-start touch-target"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {duplicates.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-green-300" />
            <p className="text-base sm:text-lg font-medium">No duplicate receipts flagged</p>
          </div>
        )}
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Detail Modal - Mobile Optimized
  const renderDetailModal = () => {
    if (!selectedItem) return null;

    const { type, data } = selectedItem;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
        <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">
                  {type === 'expense' ? 'Expense Claim Details' : 'Duplicate Receipt Review'}
                </h2>
                {type === 'duplicate' && data.fileSize && (
                  <p className="text-xs text-gray-500 mt-1">
                    File Size: {formatFileSize(data.fileSize)}
                    {data.originalSize && data.originalSize !== data.fileSize && (
                      <span className="ml-1 text-green-600">
                        (Optimized from {formatFileSize(data.originalSize)})
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 p-2 touch-target"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {type === 'expense' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                  <div>
                    <label className="text-xs text-gray-500">User</label>
                    <p className="font-medium truncate">{data.userId}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Amount</label>
                    <p className="font-medium text-lg">{formatCurrency(data.total, data.receipts?.[0]?.ocrData?.currency)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Submitted</label>
                    <p className="font-medium">{formatDate(data.submittedAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Receipts</label>
                    <p className="font-medium">{data.receiptCount}</p>
                  </div>
                </div>

                {data.categoryBreakdown && (
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Category Breakdown</label>
                    <div className="space-y-2">
                      {Object.entries(data.categoryBreakdown).map(([cat, amount]) => (
                        <div key={cat} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                          <span className="capitalize">{cat}</span>
                          <span className="font-medium">{formatCurrency(amount, data.receipts?.[0]?.ocrData?.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Receipts</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.receipts?.map(receipt => (
                      <div key={receipt.id} className="border rounded-lg p-3 flex items-center gap-3">
                        {receipt.fileName ? (
                          <div className="relative group flex-shrink-0">
                            {receipt.fileName.toLowerCase().endsWith('.pdf') ? (
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-50 text-blue-600 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 border border-blue-200"
                                onClick={() => window.open(`${API_IMAGE_BASE}/uploads/${receipt.fileName}`, '_blank')}
                              >
                                <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
                                <span className="text-[10px] font-bold">PDF</span>
                              </div>
                            ) : (
                              <img
                                src={`${API_IMAGE_BASE}/uploads/${receipt.fileName}`}
                                alt="Receipt thumbnail"
                                className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => window.open(`${API_IMAGE_BASE}/uploads/${receipt.fileName}`, '_blank')}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            )}
                          </div>
                        ) : null}
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 ${receipt.fileName ? 'hidden' : 'flex'}`}>
                          <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{receipt.ocrData?.merchant || 'Unknown'}</p>
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <p>{formatCurrency(receipt.ocrData?.amount, receipt.ocrData?.currency)} • {receipt.ocrData?.date}</p>
                            {receipt.fileSize && (
                              <p className="text-[10px] text-gray-400">
                                Size: {formatFileSize(receipt.fileSize)}
                              </p>
                            )}
                            <p className="text-[10px]">
                              <span className="font-semibold">Ref:</span> {receipt.ocrData?.billReference || 'N/A'}
                            </p>
                          </div>
                        </div>
                        {receipt.tamperCheck && (
                          <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                            receipt.tamperCheck.riskLevel === 'high' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {receipt.tamperCheck.riskLevel}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Verification Notes</label>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Add notes about this verification decision..."
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleVerify(data.id, 'approve')}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2 touch-target"
                  >
                    <ThumbsUp className="w-5 h-5" />
                    Approve Claim
                  </button>
                  <button
                    onClick={() => handleVerify(data.id, 'reject')}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2 touch-target"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    Reject Claim
                  </button>
                </div>
              </>
            )}

            {type === 'duplicate' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* New Receipt */}
                  <div className="border rounded-lg p-3 sm:p-4">
                    <h3 className="font-medium mb-2 sm:mb-3 text-red-600 text-sm">New Receipt (Flagged)</h3>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      <p><strong>Merchant:</strong> {data.ocrData?.merchant || 'Unknown'}</p>
                      <p><strong>Amount:</strong> {formatCurrency(data.ocrData?.amount, data.ocrData?.currency)}</p>
                      {data.fileSize && (
                        <p><strong>Size:</strong> {formatFileSize(data.fileSize)} 
                          {data.originalSize && data.originalSize !== data.fileSize && (
                            <span className="ml-1 text-green-600 text-xs">
                              (Optimized from {formatFileSize(data.originalSize)})
                            </span>
                          )}
                        </p>
                      )}
                      <p><strong>Date:</strong> {data.ocrData?.date}</p>
                      <p><strong>Category:</strong> {data.ocrData?.categoryName || 'N/A'}</p>
                    </div>
                    {data.fileName ? (
                      <div className="mt-3 bg-gray-100 rounded h-40 sm:h-48 flex items-center justify-center overflow-hidden">
                        {data.fileName.toLowerCase().endsWith('.pdf') ? (
                          <div 
                            className="flex flex-col items-center justify-center text-blue-600 cursor-pointer hover:text-blue-700"
                            onClick={() => window.open(`${API_IMAGE_BASE}/uploads/${data.fileName}`, '_blank')}
                          >
                            <FileText className="w-12 h-12 sm:w-16 sm:h-16 mb-2" />
                            <p className="font-bold text-sm">PDF Document</p>
                            <p className="text-xs">Click to open</p>
                          </div>
                        ) : (
                          <>
                            <img
                              src={`${API_IMAGE_BASE}/uploads/${data.fileName}`}
                              alt="New receipt"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden w-full h-full items-center justify-center">
                              <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 bg-gray-100 rounded h-40 sm:h-48 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">Image not available</span>
                      </div>
                    )}
                  </div>

                  {/* Original Receipt */}
                  <div className="border rounded-lg p-3 sm:p-4">
                    <h3 className="font-medium mb-2 sm:mb-3 text-green-600 text-sm">Original Receipt</h3>
                    {data.originalReceipt ? (
                      <>
                        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                          <p><strong>Merchant:</strong> {data.originalReceipt.ocrData?.merchant || 'Unknown'}</p>
                          <p><strong>Amount:</strong> {formatCurrency(data.originalReceipt.ocrData?.amount, data.originalReceipt.ocrData?.currency)}</p>
                          {data.originalReceipt.fileSize && (
                            <p><strong>Size:</strong> {formatFileSize(data.originalReceipt.fileSize)} 
                              {data.originalReceipt.originalSize && data.originalReceipt.originalSize !== data.originalReceipt.fileSize && (
                                <span className="ml-1 text-green-600 text-xs">
                                  (Optimized from {formatFileSize(data.originalReceipt.originalSize)})
                                </span>
                              )}
                            </p>
                          )}
                          <p><strong>Date:</strong> {data.originalReceipt.ocrData?.date}</p>
                          <p><strong>Category:</strong> {data.originalReceipt.ocrData?.categoryName || 'N/A'}</p>
                        </div>
                        {data.originalReceipt.fileName ? (
                          <div className="mt-3 bg-gray-100 rounded h-40 sm:h-48 flex items-center justify-center overflow-hidden">
                            {data.originalReceipt.fileName.toLowerCase().endsWith('.pdf') ? (
                              <div 
                                className="flex flex-col items-center justify-center text-blue-600 cursor-pointer hover:text-blue-700"
                                onClick={() => window.open(`${API_IMAGE_BASE}/uploads/${data.originalReceipt.fileName}`, '_blank')}
                              >
                                <FileText className="w-12 h-12 sm:w-16 sm:h-16 mb-2" />
                                <p className="font-bold text-sm">PDF Document</p>
                                <p className="text-xs">Click to open</p>
                              </div>
                            ) : (
                              <>
                                <img
                                  src={`${API_IMAGE_BASE}/uploads/${data.originalReceipt.fileName}`}
                                  alt="Original receipt"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden w-full h-full items-center justify-center">
                                  <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 bg-gray-100 rounded h-40 sm:h-48 flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Image not available</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">Original receipt not found</p>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-yellow-800 mb-2 text-sm">Match Analysis</h4>
                  <div className="space-y-1 text-xs sm:text-sm">
                    {data.duplicateReasons?.map((reason, idx) => (
                      <p key={idx} className="text-yellow-700">• {reason}</p>
                    ))}
                  </div>
                  <p className="mt-2 text-xs sm:text-sm font-medium">
                    Confidence: {Math.round(data.duplicateConfidence * 100)}%
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Resolution Notes</label>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Explain your decision..."
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleResolveDuplicate(data.id, false)}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2 touch-target"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Not Duplicate
                  </button>
                  <button
                    onClick={() => handleResolveDuplicate(data.id, true)}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2 touch-target"
                  >
                    <XCircle className="w-5 h-5" />
                    Confirm Duplicate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Tab definitions
  const tabs = [
    { id: 'stats', label: 'Dashboard', longLabel: 'Dashboard' },
    { id: 'verifications', label: 'Pending', longLabel: 'Pending Verifications' },
    { id: 'duplicates', label: 'Duplicates', longLabel: 'Duplicate Detection' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Admin Verification</h1>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Review and approve expense claims</p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-100 touch-target"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs - Scrollable on mobile */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-sm flex-shrink-0 touch-target ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span className="hidden sm:inline">{tab.longLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'duplicates' && renderDuplicates()}
          </>
        )}
      </div>

      {/* Modal */}
      {renderDetailModal()}
    </div>
  );
}
