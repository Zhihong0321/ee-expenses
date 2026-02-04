/**
 * Duplicate Receipt Detection Service
 * Uses semantic analysis to detect duplicate submissions
 * even when photos are different
 */

const axios = require('axios');
const fs = require('fs');

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  const costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}

/**
 * Normalize amount for comparison
 */
function normalizeAmount(amount) {
  // Round to 2 decimal places
  return Math.round(parseFloat(amount || 0) * 100) / 100;
}

/**
 * Normalize date for comparison
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Find potential duplicates in database
 * @param {Object} db - PostgreSQL db instance (with query method)
 * @param {Object} newReceipt - New receipt OCR data
 * @param {string} userId - User ID (optional, to check across all users)
 * @returns {Promise<Array>} Array of potential duplicates
 */
async function findPotentialDuplicates(db, newReceipt, userId = null) {
  const duplicates = [];
  const newAmount = normalizeAmount(newReceipt.amount);
  const newDate = normalizeDate(newReceipt.date);
  const newMerchant = (newReceipt.merchant || '').toLowerCase();
  
  // Query receipts with similar amounts (±5% tolerance)
  const minAmount = newAmount * 0.95;
  const maxAmount = newAmount * 1.05;
  
  let queryStr = 'SELECT * FROM receipts WHERE (ocr_data->>\'amount\')::numeric >= $1 AND (ocr_data->>\'amount\')::numeric <= $2';
  const queryParams = [minAmount, maxAmount];
  
  if (userId) {
    queryStr += ' AND user_id = $3';
    queryParams.push(userId);
  }
  
  queryStr += ' LIMIT 50';
  
  const result = await db.query(queryStr, queryParams);
  
  for (const existing of result.rows) {
    const existingOcr = existing.ocr_data || {};
    
    // Skip if already marked as duplicate of another
    if (existing.duplicate_of) continue;
    
    const existingDate = normalizeDate(existingOcr.date);
    const existingMerchant = (existingOcr.merchant || '').toLowerCase();
    
    // Calculate match scores
    const amountMatch = Math.abs(newAmount - normalizeAmount(existingOcr.amount)) < 0.01;
    const dateMatch = newDate && existingDate && newDate === existingDate;
    const merchantSimilarity = stringSimilarity(newMerchant, existingMerchant);
    const merchantMatch = merchantSimilarity > 0.7;
    
    // Calculate overall confidence
    let confidence = 0;
    let reasons = [];
    
    if (amountMatch) {
      confidence += 40;
      reasons.push('Same amount');
    }
    
    if (dateMatch) {
      confidence += 35;
      reasons.push('Same date');
    }
    
    if (merchantMatch) {
      confidence += 25;
      reasons.push(merchantSimilarity > 0.9 ? 'Same merchant' : 'Similar merchant');
    }
    
    // If high confidence, add to duplicates
    if (confidence >= 60) {
      duplicates.push({
        id: existing.id,
        userId: existing.user_id,
        confidence,
        reasons,
        merchantSimilarity,
        ocrData: existingOcr,
        uploadedAt: existing.uploaded_at,
        status: existing.status,
        filePath: existing.file_path
      });
    }
  }
  
  // Sort by confidence descending
  return duplicates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Use AI to perform deep duplicate analysis
 * Compares images and extracted data semantically
 */
async function aiDuplicateAnalysis(imagePath, existingReceipts, uniapiConfig) {
  if (!existingReceipts || existingReceipts.length === 0) {
    return { isDuplicate: false, confidence: 0, matches: [] };
  }
  
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const existingData = existingReceipts.map(r => ({
      id: r.id,
      merchant: r.ocrData?.merchant,
      amount: r.ocrData?.amount,
      date: r.ocrData?.date,
      items: r.ocrData?.items?.map(i => i.name).join(', ')
    }));
    
    const prompt = `Analyze this receipt image and compare it with the following existing receipts to determine if it's a duplicate submission:

Existing receipts to compare:
${JSON.stringify(existingData, null, 2)}

Consider:
1. Same merchant/establishment
2. Same total amount
3. Same date or very close dates
4. Same items purchased
5. Even if photos are taken from different angles or quality

Return ONLY a JSON object:
{
  "isDuplicate": boolean,
  "confidence": 0.0-1.0,
  "matchedReceiptId": "id of matched receipt or null",
  "reasoning": "brief explanation"
}`;

    const response = await axios.post(
      `${uniapiConfig.baseUrl}/chat/completions`,
      {
        model: uniapiConfig.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
              }
            ]
          }
        ],
        max_tokens: 1024,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${uniapiConfig.key}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { isDuplicate: false, confidence: 0, matches: [] };
    
  } catch (error) {
    console.error('AI duplicate analysis error:', error);
    return { isDuplicate: false, confidence: 0, error: error.message };
  }
}

module.exports = {
  findPotentialDuplicates,
  aiDuplicateAnalysis,
  stringSimilarity
};
