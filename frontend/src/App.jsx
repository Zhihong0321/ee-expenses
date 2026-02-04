import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, DollarSign, Clock, AlertCircle, CheckCircle, 
  ArrowUp, Shield, AlertTriangle, BarChart3, Trash2, Eye,
  XCircle, Loader2, Image as ImageIcon
} from 'lucide-react';
import Dropzone from 'react-dropzone';
import axios from 'axios';
import AdminVerificationPage from './AdminVerificationPage';

// Use relative URLs - works in both local dev and production (Railway)
const API_BASE = '/api';
const API_IMAGE_BASE = '';
const USER_ID = 'demo-user-1'; // In production, get from parent app

function App() {
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [currentView, setCurrentView] = useState('shoebox'); // 'shoebox' | 'expenses' | 'admin' | 'analytics'
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [showReceiptDetail, setShowReceiptDetail] = useState(null);
  const [runningTamperCheck, setRunningTamperCheck] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadReceipts();
    loadExpenses();
    loadCategories();
    loadAnalytics();
  }, []);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/receipts/${USER_ID}`);
      setReceipts(response.data.receipts);
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const response = await axios.get(`${API_BASE}/expenses/${USER_ID}`);
      setExpenses(response.data.expenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/categories`);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/analytics/spending/${USER_ID}?period=month`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleUpload = async (files) => {
    const warnings = [];
    const errors = [];
    try {
      setUploading(true);
      setUploadWarnings([]);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('receipt', file);
        formData.append('userId', USER_ID);

        try {
          const response = await axios.post(`${API_BASE}/receipts/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          // Check for semantic duplicates (similar receipt, different photo)
          if (response.data.duplicateStatus === 'detected') {
            warnings.push({
              file: file.name,
              type: 'duplicate',
              message: 'Potential duplicate detected',
              details: response.data.potentialDuplicates
            });
          }
        } catch (uploadError) {
          // Handle exact duplicate (409 conflict)
          if (uploadError.response?.status === 409) {
            const errorData = uploadError.response.data;
            if (errorData.type === 'exact_duplicate') {
              errors.push({
                file: file.name,
                type: 'exact_duplicate',
                message: `Exact duplicate: This file was already uploaded`,
                existingAmount: errorData.existingData?.amount,
                existingDate: errorData.existingData?.date
              });
            }
          } else {
            throw uploadError;
          }
        }
      }
      
      if (warnings.length > 0) {
        setUploadWarnings(warnings);
      }
      
      if (errors.length > 0) {
        alert(`Skipped ${errors.length} duplicate file(s):\n${errors.map(e => `- ${e.file}`).join('\n')}`);
      }
      
      await loadReceipts();
      await loadAnalytics();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading receipt: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleTamperCheck = async (receiptId) => {
    try {
      setRunningTamperCheck(receiptId);
      await axios.post(`${API_BASE}/receipts/${receiptId}/tamper-check`);
      await loadReceipts();
      alert('Tamper check completed!');
    } catch (error) {
      console.error('Tamper check error:', error);
      alert('Error running tamper check: ' + error.message);
    } finally {
      setRunningTamperCheck(null);
    }
  };

  const handleReceiptSelect = (id) => {
    // Don't allow selecting flagged receipts
    const receipt = receipts.find(r => r.id === id);
    if (receipt?.status === 'flagged') return;
    
    setSelectedReceipts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmitExpense = async () => {
    if (selectedReceipts.length === 0) {
      alert('Please select at least one receipt');
      return;
    }

    // Check for flagged receipts
    const flaggedSelected = receipts.filter(r => 
      selectedReceipts.includes(r.id) && r.status === 'flagged'
    );
    
    if (flaggedSelected.length > 0) {
      alert(`Cannot submit: ${flaggedSelected.length} receipt(s) are flagged for review`);
      return;
    }

    const category = prompt('Enter expense category (e.g., Travel, Meals, Office):') || 'General';
    const notes = prompt('Add any notes:') || '';

    try {
      await axios.post(`${API_BASE}/expenses/submit`, {
        userId: USER_ID,
        receiptIds: selectedReceipts,
        category,
        notes
      });
      setSelectedReceipts([]);
      await loadReceipts();
      await loadExpenses();
      setCurrentView('expenses');
    } catch (error) {
      console.error('Submit error:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert('Error submitting expense: ' + errorMsg);
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;
    
    try {
      // In a real app, you'd have a delete endpoint
      // await axios.delete(`${API_BASE}/receipts/${receiptId}`);
      alert('Delete functionality would be implemented here');
    } catch (error) {
      console.error('Delete error:', error);
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

  const getStatusBadge = (status, tamperCheck, duplicateStatus) => {
    if (duplicateStatus === 'detected') {
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          Duplicate
        </span>
      );
    }
    
    if (status === 'flagged') {
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Flagged
        </span>
      );
    }
    
    if (tamperCheck?.riskLevel === 'high') {
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
          <Shield className="w-3 h-3" />
          High Risk
        </span>
      );
    }
    
    if (tamperCheck?.riskLevel === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
          <Shield className="w-3 h-3" />
          Medium Risk
        </span>
      );
    }
    
    if (status === 'processed') {
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Verified
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const unsubmittedReceipts = receipts.filter(r => r.status === 'processed' || r.status === 'flagged');
  const selectedTotal = receipts
    .filter(r => selectedReceipts.includes(r.id))
    .reduce((sum, r) => sum + (r.ocrData?.amount || 0), 0);

  // Analytics View
  const renderAnalytics = () => {
    if (!analytics) return <div className="text-center py-12">Loading analytics...</div>;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">Total Spending</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalAmount)}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">Receipts</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.totalReceipts}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">Top Category</p>
            <p className="text-2xl font-bold text-gray-900">
              {analytics.categories[0]?.name || 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-4">Spending by Category</h3>
          <div className="space-y-3">
            {analytics.categories.map(cat => (
              <div key={cat.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{cat.name}</span>
                  <span className="font-medium">{formatCurrency(cat.amount)} ({cat.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
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

  // Receipt Detail Modal
  const renderReceiptDetail = () => {
    if (!showReceiptDetail) return null;
    
    const fileUrl = showReceiptDetail.fileName 
      ? `${API_IMAGE_BASE}/uploads/${showReceiptDetail.fileName}`
      : null;
    const isPdf = showReceiptDetail.fileName?.toLowerCase().endsWith('.pdf');
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Receipt Details</h3>
              {showReceiptDetail.fileSize && (
                <p className="text-xs text-gray-500">
                  File Size: {formatFileSize(showReceiptDetail.fileSize)} 
                  {showReceiptDetail.originalSize && showReceiptDetail.originalSize !== showReceiptDetail.fileSize && (
                    <span className="ml-1 text-green-600">
                      (Optimized from {formatFileSize(showReceiptDetail.originalSize)})
                    </span>
                  )}
                </p>
              )}
            </div>
            <button 
              onClick={() => setShowReceiptDetail(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Receipt Preview */}
          {fileUrl && (
            <div className="p-6 border-b border-gray-200">
              <p className="text-sm text-gray-500 mb-2">Receipt Document</p>
              <div className="bg-gray-100 rounded-lg overflow-hidden max-h-96 flex items-center justify-center">
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <FileText className="w-16 h-16 mb-2" />
                    <p className="font-medium text-gray-600">PDF Document</p>
                    <p className="text-sm">Preview not available in this view</p>
                  </div>
                ) : (
                  <img 
                    src={fileUrl} 
                    alt="Receipt" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                )}
                <div className="hidden items-center justify-center h-48 text-gray-400">
                  <ImageIcon className="w-12 h-12 mr-2" />
                  <span>Document not available</span>
                </div>
              </div>
              <a 
                href={fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mt-2 inline-block font-medium"
              >
                {isPdf ? 'Open PDF in new tab' : 'Open image in new tab'}
              </a>
            </div>
          )}
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Merchant</p>
                <p className="font-medium">{showReceiptDetail.ocrData?.merchant || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500">Amount</p>
                <p className="font-medium">{formatCurrency(showReceiptDetail.ocrData?.amount, showReceiptDetail.ocrData?.currency)}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">{showReceiptDetail.ocrData?.date || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Category</p>
                <p className="font-medium">{showReceiptDetail.ocrData?.categoryName || 'Miscellaneous'}</p>
              </div>
            </div>
            
            {showReceiptDetail.ocrData?.items?.length > 0 && (
              <div>
                <p className="text-gray-500 text-sm mb-2">Items</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {showReceiptDetail.ocrData.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span>{formatCurrency(item.price, showReceiptDetail.ocrData?.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showReceiptDetail.tamperCheck && (
              <div className={`rounded-lg p-3 ${
                showReceiptDetail.tamperCheck.riskLevel === 'high' 
                  ? 'bg-red-50 text-red-800' 
                  : showReceiptDetail.tamperCheck.riskLevel === 'medium'
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-green-50 text-green-800'
              }`}>
                <p className="font-medium">Tamper Check: {showReceiptDetail.tamperCheck.riskLevel} risk</p>
                {showReceiptDetail.tamperCheck.reasons?.length > 0 && (
                  <ul className="text-sm mt-1">
                    {showReceiptDetail.tamperCheck.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {showReceiptDetail.potentialDuplicates?.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="font-medium text-orange-800">Potential Duplicates</p>
                <p className="text-sm text-orange-600">
                  {showReceiptDetail.potentialDuplicates.length} similar receipt(s) found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (currentView === 'admin') {
    return <AdminVerificationPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">EE Expenses</h1>
              <p className="text-sm text-gray-500">Digital Receipt Shoebox</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('shoebox')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === 'shoebox'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Shoebox ({unsubmittedReceipts.length})
              </button>
              <button
                onClick={() => setCurrentView('expenses')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === 'expenses'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <DollarSign className="w-4 h-4 inline mr-2" />
                Claims ({expenses.length})
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === 'analytics'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Analytics
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition bg-purple-100 text-purple-700 hover:bg-purple-200`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Warnings */}
        {uploadWarnings.length > 0 && (
          <div className="mb-6 space-y-2">
            {uploadWarnings.map((warning, idx) => (
              <div key={idx} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="font-medium text-orange-900">{warning.file}: {warning.message}</p>
                  {warning.details?.length > 0 && (
                    <p className="text-sm text-orange-700">
                      Similar to: {warning.details[0].ocrData?.merchant} ({formatCurrency(warning.details[0].ocrData?.amount, warning.details[0].ocrData?.currency)})
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => setUploadWarnings([])}
                  className="text-orange-600 hover:text-orange-800"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {currentView === 'shoebox' && (
          <div className="space-y-6">
            {/* Upload Area */}
            <Dropzone onDrop={handleUpload} accept={{ 'image/*': ['.png', '.jpg', '.jpeg'], 'application/pdf': ['.pdf'] }}>
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <p>Uploading and processing with AI...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-gray-700">
                        {isDragActive ? 'Drop receipts here' : 'Drag & drop receipts here'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">or click to browse (PNG, JPG, PDF)</p>
                      <p className="text-xs text-gray-400 mt-1">
                        AI will auto-categorize and check for duplicates
                      </p>
                    </>
                  )}
                </div>
              )}
            </Dropzone>

            {/* Selected Receipts Action Bar */}
            {selectedReceipts.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="font-medium text-blue-900">{selectedReceipts.length} selected</span>
                  <span className="text-blue-600 ml-2">Total: {formatCurrency(selectedTotal)}</span>
                </div>
                <button
                  onClick={handleSubmitExpense}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <ArrowUp className="w-4 h-4" />
                  Submit as Expense Claim
                </button>
              </div>
            )}

            {/* Receipts Grid */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading receipts...
              </div>
            ) : unsubmittedReceipts.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No receipts in your shoebox</p>
                <p className="text-sm mt-2">Upload some receipts to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unsubmittedReceipts.map(receipt => (
                  <div
                    key={receipt.id}
                    className={`bg-white rounded-xl p-4 border-2 transition ${
                      receipt.status === 'flagged'
                        ? 'border-orange-300 bg-orange-50/30'
                        : selectedReceipts.includes(receipt.id)
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div 
                      className={receipt.status === 'flagged' ? '' : 'cursor-pointer'}
                      onClick={() => receipt.status !== 'flagged' && handleReceiptSelect(receipt.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(receipt.status, receipt.tamperCheck, receipt.duplicateStatus)}
                          <span className="text-sm font-medium text-gray-600">
                            {receipt.ocrData?.categoryName || 'Miscellaneous'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowReceiptDetail(receipt);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!receipt.tamperCheck && receipt.status !== 'flagged' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTamperCheck(receipt.id);
                              }}
                              disabled={runningTamperCheck === receipt.id}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Run tamper check"
                            >
                              {runningTamperCheck === receipt.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-2xl font-bold text-gray-900">
                            {formatCurrency(receipt.ocrData?.amount, receipt.ocrData?.currency)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(receipt.uploadedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {receipt.ocrData?.merchant || 'Unknown merchant'}
                        </p>
                        {receipt.ocrData?.confidence && (
                          <div className="flex justify-between items-center mt-1">
                            <div className="text-[10px] text-gray-400">
                              AI Confidence: {Math.round(receipt.ocrData.confidence * 100)}%
                            </div>
                            {receipt.fileSize && (
                              <div className="text-[10px] text-gray-400 font-medium">
                                {formatFileSize(receipt.fileSize)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'expenses' && (
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No expense claims yet</p>
                <p className="text-sm mt-2">Submit receipts from your shoebox to create claims</p>
              </div>
            ) : (
              expenses.map(expense => (
                <div key={expense.id} className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {expense.category}
                        </span>
                        <span className="text-xs text-gray-500">{expense.receiptCount} receipts</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {formatCurrency(expense.total, expense.receipts?.[0]?.ocrData?.currency)}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Submitted: {formatDate(expense.submittedAt)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      expense.status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : expense.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : expense.status === 'pending_verification'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <Clock className="w-4 h-4" />
                      {expense.status?.replace('_', ' ')}
                    </span>
                  </div>
                  {expense.notes && (
                    <p className="text-gray-600 text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                      {expense.notes}
                    </p>
                  )}
                  {expense.categoryBreakdown && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500 mb-2">Category Breakdown</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(expense.categoryBreakdown).map(([cat, amount]) => (
                          <span key={cat} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {cat}: {formatCurrency(amount, expense.receipts?.[0]?.ocrData?.currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {currentView === 'analytics' && renderAnalytics()}
      </main>

      {/* Receipt Detail Modal */}
      {renderReceiptDetail()}
    </div>
  );
}

export default App;
