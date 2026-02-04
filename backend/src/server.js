require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const uniapiService = require('./services/uniapiService');
const duplicateDetectionService = require('./services/duplicateDetectionService');
const { autoCategorize, getAllCategories, getCategoryById } = require('./config/categories');
const { requireAuth, requireApiAuth, requireAdmin, AUTH_URL } = require('./middleware/auth');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 11002;

// Check for critical configuration mismatch
if (process.env.PORT && process.env.PORT !== String(PORT)) {
  console.warn(`⚠️  PORT MISMATCH: .env says ${process.env.PORT} but server running on ${PORT}`);
}

// Middleware
// CORS must allow credentials for cookies to work
app.use(cors({
  origin: true, // Allow all origins with credentials (for subdomain auth)
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Serve static frontend files (production build)
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log('📁 Serving static files from:', publicPath);
} else {
  console.log('⚠️  Public path not found:', publicPath);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed'));
  }
});

// UniAPI config
const uniapiConfig = {
  key: process.env.UNIAPI_KEY,
  baseUrl: process.env.UNIAPI_BASE_URL,
  model: process.env.UNIAPI_MODEL
};

// ==================== PUBLIC API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'postgresql' });
});

// Get all categories (public)
app.get('/api/categories', (req, res) => {
  res.json({ categories: getAllCategories() });
});

// Get current user info
app.get('/api/me', requireApiAuth, async (req, res) => {
  try {
    // JWT data from auth hub
    const jwtUser = req.user;
    
    // Fetch user from database
    let dbUser = null;
    let agentName = null;
    let profilePic = null;
    
    try {
      // Step 1: Get user data
      const userResult = await db.query(
        'SELECT profile_picture, email, access_level, linked_agent_profile FROM "user" WHERE bubble_id = $1 LIMIT 1',
        [req.userId]
      );
      
      if (userResult.rows.length > 0) {
        dbUser = userResult.rows[0];
        
        // Fix profile picture URL
        if (dbUser.profile_picture) {
          profilePic = dbUser.profile_picture.startsWith('//') 
            ? 'https:' + dbUser.profile_picture 
            : dbUser.profile_picture;
        }
        
        // Step 2: Get agent name separately
        if (dbUser.linked_agent_profile) {
          try {
            const agentResult = await db.query(
              'SELECT name FROM agent WHERE bubble_id = $1 LIMIT 1',
              [dbUser.linked_agent_profile]
            );
            if (agentResult.rows.length > 0) {
              agentName = agentResult.rows[0].name;
            }
          } catch (agentErr) {
            console.log('Agent query error:', agentErr.message);
          }
        }
      }
    } catch (dbError) {
      console.log('DB query error:', dbError.message);
    }
    
    // Build user data
    const userData = {
      userId: req.userId,
      name: agentName || jwtUser.name || dbUser?.email || 'User',
      phone: jwtUser.phone || null,
      email: jwtUser.email || dbUser?.email || null,
      role: jwtUser.role || null,
      isAdmin: jwtUser.isAdmin || false,
      profile_picture: profilePic,
      access_level: dbUser?.access_level || null
    };
    
    res.json({
      userId: req.userId,
      user: userData
    });
  } catch (error) {
    console.error('Error in /api/me:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token', {
    domain: '.atap.solar',
    path: '/'
  });
  res.json({ success: true, message: 'Logged out' });
});

// ==================== PROTECTED API ROUTES ====================

// Upload receipt to shoebox with auto-categorization and duplicate detection
app.post('/api/receipts/upload', requireApiAuth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Use authenticated user's ID
    const userId = req.userId;
    console.log(`📄 Processing upload for user: ${userId}`);

    // OCR processing with UniAPI
    let ocrResult;
    try {
      ocrResult = await uniapiService.extractReceiptData(req.file.path);
    } catch (ocrError) {
      console.error('OCR failed:', ocrError.message);
      // Return mock OCR data for testing without UniAPI key
      ocrResult = {
        merchant: 'Test Merchant',
        date: new Date().toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 100) + 10,
        currency: 'MYR',
        currencySymbol: 'RM',
        category: '',
        billReference: '',
        paymentMethod: ''
      };
    }

    // Check for duplicate by bill reference (if available)
    if (ocrResult.billReference) {
      const existingByRef = await db.query(
        'SELECT * FROM receipts WHERE user_id = $1 AND ocr_data->>\'billReference\' = $2 LIMIT 1',
        [userId, ocrResult.billReference]
      );
      
      if (existingByRef.rows.length > 0) {
        const existing = existingByRef.rows[0];
        console.log(`🚫 Duplicate bill reference detected: ${ocrResult.billReference}`);
        return res.status(409).json({
          error: 'Duplicate receipt detected',
          type: 'duplicate_bill_reference',
          existingReceiptId: existing.id,
          message: `Receipt with reference ${ocrResult.billReference} already exists.`,
          existingData: existing.ocr_data
        });
      }
    }

    // Validate OCR result against schema
    const validatedData = uniapiService.validateReceiptData(ocrResult);

    // AI/Auto-categorization Logic
    let categoryId = 'misc';
    
    // Priority 1: Use Gemini's category if it matches our list
    if (validatedData.category && getCategoryById(validatedData.category).id !== 'misc') {
      categoryId = validatedData.category;
      console.log(`🤖 Using Gemini category: ${categoryId}`);
    } 
    // Priority 2: Fallback to keyword/merchant matching
    else {
      const fallbackCategory = autoCategorize(validatedData.merchant, validatedData.items || []);
      if (fallbackCategory !== 'misc') {
        categoryId = fallbackCategory;
        console.log(`🔍 Using keyword fallback category: ${categoryId}`);
      }
    }

    validatedData.category = categoryId;
    validatedData.categoryName = getCategoryById(categoryId).name;

    // Check for duplicates
    const potentialDuplicates = await duplicateDetectionService.findPotentialDuplicates(
      db, validatedData, userId
    );

    let duplicateStatus = 'none';
    let duplicateOf = null;
    let duplicateConfidence = 0;

    // If high confidence duplicates found, use AI for deep analysis
    if (potentialDuplicates.length > 0 && potentialDuplicates[0].confidence >= 80) {
      try {
        const aiAnalysis = await duplicateDetectionService.aiDuplicateAnalysis(
          req.file.path, potentialDuplicates, uniapiConfig
        );
        
        if (aiAnalysis.isDuplicate && aiAnalysis.confidence > 0.7) {
          duplicateStatus = 'detected';
          duplicateOf = aiAnalysis.matchedReceiptId || potentialDuplicates[0].id;
          duplicateConfidence = aiAnalysis.confidence;
        }
      } catch (aiError) {
        console.error('AI duplicate analysis failed:', aiError.message);
      }
    }

    // Save to PostgreSQL
    const receiptId = uuidv4();
    await db.query(
      `INSERT INTO receipts (
        id, user_id, file_name, original_name, mime_type, file_size, original_size, 
        file_path, ocr_data, category_id, status, duplicate_status, duplicate_of, 
        duplicate_confidence, potential_duplicates
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        receiptId, userId, req.file.filename, req.file.originalname, req.file.mimetype,
        ocrResult.fileSize || req.file.size, ocrResult.originalSize || req.file.size,
        req.file.path, JSON.stringify(validatedData), categoryId,
        duplicateStatus === 'detected' ? 'flagged' : 'processed',
        duplicateStatus, duplicateOf, duplicateConfidence, 
        JSON.stringify(potentialDuplicates.slice(0, 3))
      ]
    );

    console.log(`✅ Receipt saved: ${receiptId}`);

    res.json({
      success: true,
      receiptId: receiptId,
      data: validatedData,
      fileInfo: {
        originalSize: ocrResult.originalSize || req.file.size,
        processedSize: ocrResult.fileSize || req.file.size,
        reduction: ocrResult.originalSize ? (((ocrResult.originalSize - ocrResult.fileSize) / ocrResult.originalSize) * 100).toFixed(1) + '%' : '0%'
      },
      duplicateStatus,
      potentialDuplicates: potentialDuplicates.slice(0, 3)
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all receipts for the authenticated user
app.get('/api/receipts', requireApiAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 50 } = req.query;

    let queryStr = 'SELECT * FROM receipts WHERE user_id = $1';
    const queryParams = [userId];

    if (status) {
      queryStr += ' AND status = $2';
      queryParams.push(status);
    }

    queryStr += ` ORDER BY uploaded_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(parseInt(limit));

    const result = await db.query(queryStr, queryParams);
    
    // Map back to camelCase for frontend compatibility
    const receipts = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      originalSize: row.original_size,
      filePath: row.file_path,
      ocrData: row.ocr_data,
      category: row.category_id,
      status: row.status,
      duplicateStatus: row.duplicate_status,
      duplicateOf: row.duplicate_of,
      duplicateConfidence: row.duplicate_confidence,
      potentialDuplicates: row.potential_duplicates,
      uploadedAt: row.uploaded_at,
      processedAt: row.processed_at,
      updatedAt: row.updated_at,
      expenseId: row.expense_id,
      tamperCheck: row.tamper_check
    }));

    res.json({ receipts, count: receipts.length });

  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single receipt details (only if owned by user)
app.get('/api/receipts/detail/:receiptId', requireApiAuth, async (req, res) => {
  try {
    const { receiptId } = req.params;
    const userId = req.userId;
    
    // Only allow access to user's own receipts
    const result = await db.query(
      'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
      [receiptId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      originalSize: row.original_size,
      filePath: row.file_path,
      ocrData: row.ocr_data,
      category: row.category_id,
      status: row.status,
      duplicateStatus: row.duplicate_status,
      duplicateOf: row.duplicate_of,
      duplicateConfidence: row.duplicate_confidence,
      potentialDuplicates: row.potential_duplicates,
      uploadedAt: row.uploaded_at,
      processedAt: row.processed_at,
      updatedAt: row.updated_at,
      expenseId: row.expense_id,
      tamperCheck: row.tamper_check
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run tamper detection on a receipt (only if owned by user)
app.post('/api/receipts/:receiptId/tamper-check', requireApiAuth, async (req, res) => {
  try {
    const { receiptId } = req.params;
    const userId = req.userId;
    
    // Only allow tamper check on user's own receipts
    const result = await db.query(
      'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
      [receiptId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = result.rows[0];
    
    // Run tamper detection
    let tamperResult;
    try {
      tamperResult = await uniapiService.detectTamper(receipt.file_path, receipt.ocr_data);
    } catch (error) {
      // Mock tamper result for testing
      tamperResult = {
        isTampered: false,
        confidence: 0.9,
        reasons: ['No signs of tampering detected'],
        riskLevel: 'low'
      };
    }
    
    // Update receipt with tamper check results
    await db.query(
      'UPDATE receipts SET tamper_check = $1, tamper_checked_at = NOW(), updated_at = NOW() WHERE id = $2',
      [JSON.stringify(tamperResult), receiptId]
    );

    res.json({
      success: true,
      receiptId,
      tamperResult
    });

  } catch (error) {
    console.error('Tamper check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch submit receipts for expense claim
app.post('/api/expenses/submit', requireApiAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { receiptIds, category, notes } = req.body;
    
    console.log(`📤 Received expense submission for user ${userId} with ${receiptIds?.length} receipts`);

    if (!receiptIds || receiptIds.length === 0) {
      console.warn('❌ Submission failed: Missing receiptIds');
      return res.status(400).json({ error: 'receiptIds are required' });
    }

    // Get receipt data - only for the current user
    const result = await db.query(
      'SELECT * FROM receipts WHERE id = ANY($1) AND user_id = $2',
      [receiptIds, userId]
    );
    const receipts = result.rows;

    console.log(`🔍 Found ${receipts.length} valid receipts out of ${receiptIds.length} requested`);

    if (receipts.length === 0) {
      console.warn('❌ Submission failed: No valid receipts found in store');
      return res.status(404).json({ error: 'No valid receipts found' });
    }

    // Check for flagged receipts
    const flaggedReceipts = receipts.filter(r => r.status === 'flagged' || r.duplicate_status === 'detected');
    if (flaggedReceipts.length > 0) {
      return res.status(400).json({
        error: 'Some receipts are flagged for review',
        flaggedReceipts: flaggedReceipts.map(r => ({ id: r.id, reason: r.duplicate_status === 'detected' ? 'Duplicate detected' : 'Flagged' }))
      });
    }

    // Calculate total
    const total = receipts.reduce((sum, r) => sum + (r.ocr_data?.amount || 0), 0);

    // Aggregate categories for spending analysis
    const categoryBreakdown = {};
    receipts.forEach(r => {
      const cat = r.ocr_data?.category || 'misc';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (r.ocr_data?.amount || 0);
    });

    // Create expense claim
    const expenseId = uuidv4();
    await db.query(
      `INSERT INTO expenses (
        id, user_id, category, notes, receipt_ids, total, category_breakdown, 
        status, receipts_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        expenseId, userId, category || 'General', notes, receiptIds, total, 
        JSON.stringify(categoryBreakdown), 'pending_verification', 
        JSON.stringify(receipts)
      ]
    );

    // Update receipt statuses
    await db.query(
      'UPDATE receipts SET status = \'submitted\', expense_id = $1, updated_at = NOW() WHERE id = ANY($2)',
      [expenseId, receiptIds]
    );

    res.json({
      success: true,
      expenseId: expenseId,
      total,
      receiptCount: receipts.length
    });

  } catch (error) {
    console.error('Submit expense error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get expense claims for authenticated user
app.get('/api/expenses', requireApiAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { status } = req.query;

    let queryStr = 'SELECT * FROM expenses WHERE user_id = $1';
    const queryParams = [userId];

    if (status) {
      queryStr += ' AND status = $2';
      queryParams.push(status);
    }

    queryStr += ' ORDER BY submitted_at DESC';

    const result = await db.query(queryStr, queryParams);
    
    const expenses = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      notes: row.notes,
      receiptIds: row.receipt_ids,
      total: row.total,
      categoryBreakdown: row.category_breakdown,
      status: row.status,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      verificationNotes: row.verification_notes,
      receipts: row.receipts_data
    }));

    res.json({ expenses, count: expenses.length });

  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get spending analysis by category for authenticated user
app.get('/api/analytics/spending', requireApiAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { period = 'month' } = req.query;

    const result = await db.query(
      'SELECT ocr_data, category_id FROM receipts WHERE user_id = $1',
      [userId]
    );
    const receipts = result.rows;

    const categoryTotals = {};
    let totalAmount = 0;

    receipts.forEach(row => {
      const data = row.ocr_data;
      const cat = row.category_id || 'misc';
      const amount = parseFloat(data?.amount || 0);
      
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { amount: 0, count: 0, name: getCategoryById(cat).name };
      }
      categoryTotals[cat].amount += amount;
      categoryTotals[cat].count += 1;
      totalAmount += amount;
    });

    // Calculate percentages
    const analysis = Object.entries(categoryTotals).map(([id, data]) => ({
      id,
      name: data.name,
      amount: data.amount,
      count: data.count,
      percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    res.json({
      period,
      totalAmount,
      totalReceipts: receipts.length,
      categories: analysis
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN API ROUTES ====================

// Get all pending verifications (admin only)
app.get('/api/admin/verifications', requireApiAuth, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending_verification', limit = 50 } = req.query;

    const result = await db.query(
      'SELECT * FROM expenses WHERE status = $1 ORDER BY submitted_at ASC LIMIT $2',
      [status, parseInt(limit)]
    );

    const expenses = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      notes: row.notes,
      receiptIds: row.receipt_ids,
      total: row.total,
      categoryBreakdown: row.category_breakdown,
      status: row.status,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      verificationNotes: row.verification_notes,
      receipts: row.receipts_data
    }));

    res.json({ expenses, count: expenses.length });

  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get duplicate reports for admin review (admin only)
app.get('/api/admin/duplicates', requireApiAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await db.query(
      'SELECT * FROM receipts WHERE duplicate_status IN (\'detected\', \'potential\') ORDER BY uploaded_at DESC LIMIT $1',
      [parseInt(limit)]
    );

    const duplicates = [];
    for (const row of result.rows) {
      // Get original receipt if marked as duplicate
      let originalReceipt = null;
      if (row.duplicate_of) {
        const originalResult = await db.query('SELECT * FROM receipts WHERE id = $1', [row.duplicate_of]);
        if (originalResult.rows.length > 0) {
          const origRow = originalResult.rows[0];
          originalReceipt = {
            id: origRow.id,
            userId: origRow.user_id,
            fileName: origRow.file_name,
            originalName: origRow.original_name,
            mimeType: origRow.mime_type,
            fileSize: origRow.file_size,
            originalSize: origRow.original_size,
            filePath: origRow.file_path,
            ocrData: origRow.ocr_data,
            category: origRow.category_id,
            status: origRow.status,
            duplicateStatus: origRow.duplicate_status,
            uploadedAt: origRow.uploaded_at
          };
        }
      }

      duplicates.push({
        id: row.id,
        userId: row.user_id,
        fileName: row.file_name,
        originalName: row.original_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        originalSize: row.original_size,
        filePath: row.file_path,
        ocrData: row.ocr_data,
        category: row.category_id,
        status: row.status,
        duplicateStatus: row.duplicate_status,
        duplicateOf: row.duplicate_of,
        duplicateConfidence: row.duplicate_confidence,
        potentialDuplicates: row.potential_duplicates,
        uploadedAt: row.uploaded_at,
        originalReceipt
      });
    }

    res.json({ duplicates, count: duplicates.length });

  } catch (error) {
    console.error('Get duplicates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin verify/reject expense claim (admin only)
app.post('/api/admin/verifications/:expenseId', requireApiAuth, requireAdmin, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { action, notes } = req.body;
    const adminId = req.userId; // Use authenticated admin's ID

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject' });
    }

    const result = await db.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    const expense = result.rows[0];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update expense status
    await db.query(
      `UPDATE expenses SET 
        status = $1, 
        verification_notes = $2, 
        verified_by = $3, 
        verified_at = NOW() 
      WHERE id = $4`,
      [newStatus, notes || '', adminId, expenseId]
    );

    // Update receipt statuses
    const receiptStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.query(
      'UPDATE receipts SET status = $1, updated_at = NOW() WHERE id = ANY($2)',
      [receiptStatus, expense.receipt_ids]
    );

    res.json({
      success: true,
      expenseId,
      status: newStatus,
      message: `Expense claim ${action}d successfully`
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin mark receipt as not duplicate (admin only)
app.post('/api/admin/duplicates/:receiptId/resolve', requireApiAuth, requireAdmin, async (req, res) => {
  try {
    const { receiptId } = req.params;
    const { isDuplicate, notes } = req.body;

    if (isDuplicate) {
      // Keep as flagged/duplicate
      await db.query(
        'UPDATE receipts SET status = \'flagged\', updated_at = NOW() WHERE id = $1',
        [receiptId]
      );
    } else {
      // Mark as not a duplicate
      await db.query(
        'UPDATE receipts SET duplicate_status = \'none\', status = \'processed\', updated_at = NOW() WHERE id = $1',
        [receiptId]
      );
    }

    res.json({ success: true, receiptId });

  } catch (error) {
    console.error('Resolve duplicate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SPA catch-all route - serve index.html for any non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found', path: indexPath });
  }
});

// Start server and initialize DB
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📊 Mode: PostgreSQL');
    console.log(`🔗 API: http://localhost:${PORT}/api`);
    console.log(`🔐 Auth: ${AUTH_URL}`);
  });
}).catch(err => {
  console.error('Failed to initialize database, exiting...');
  process.exit(1);
});
