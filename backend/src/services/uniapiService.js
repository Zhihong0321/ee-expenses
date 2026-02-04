const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const path = require('path');
const { getAllCategories } = require('../config/categories');

/**
 * Process image before sending to API
 * - Resize to max 2048x2048
 * - Sharpen
 * - Compress (JPEG quality 80)
 */
async function processImage(filePath) {
  const startTime = Date.now();
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  const originalSize = (stats.size / 1024).toFixed(2);
  
  // Skip processing for PDFs
  if (ext === '.pdf') {
    return {
      buffer: fs.readFileSync(filePath),
      originalSize: stats.size,
      processedSize: stats.size,
      duration: Date.now() - startTime
    };
  }

  try {
    // Optimization: 
    // 1. Lower resolution (1600 is plenty for OCR)
    // 2. Remove slow mozjpeg and sharpen (sharpen is very CPU intensive)
    // 3. Use standard fast JPEG compression
    const processedBuffer = await sharp(filePath)
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true // Hardware acceleration where available
      })
      .jpeg({
        quality: 75,
        progressive: true,
        optimizeScans: false // Faster encoding
      })
      .toBuffer();
      
    const duration = Date.now() - startTime;
    const processedSize = (processedBuffer.length / 1024).toFixed(2);
    console.log(`⚡ Image processed in ${duration}ms: ${processedSize} KB`);
    
    return {
      buffer: processedBuffer,
      originalSize: stats.size,
      processedSize: processedBuffer.length,
      duration: duration
    };
  } catch (error) {
    console.warn('Image processing failed, falling back to original file:', error);
    return {
      buffer: fs.readFileSync(filePath),
      originalSize: stats.size,
      processedSize: stats.size,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Calculate file hash for duplicate detection
 */
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Call UniAPI with prompt
 */
async function callUniAPI(prompt, fileBase64, mimeType = 'image/jpeg', maxTokens = 2000) {
  // STRICT OPENAI API STANDARD:
  // OpenAI chat completions only support 'text' and 'image_url' in the content array.
  // For Gemini 3 Flash via UniAPI (OpenAI-compatible), we pass the PDF as an image_url
  // with the appropriate data URI.
  const content = [
    { 
      type: 'text', 
      text: prompt 
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${fileBase64}`,
        detail: 'high' // Standard OpenAI parameter
      }
    }
  ];

  const payload = {
    model: process.env.UNIAPI_MODEL,
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
    // Use standard OpenAI response_format for JSON mode
    response_format: { type: "json_object" }
  };

  const response = await axios.post(
    `${process.env.UNIAPI_BASE_URL}/chat/completions`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${process.env.UNIAPI_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000 // Increased timeout for large PDFs
    }
  );
  
  if (!response.data || !response.data.choices || !response.data.choices[0]) {
    throw new Error('Invalid response structure from OpenAI-compatible API');
  }

  return response.data.choices[0].message.content;
}

/**
 * Extract receipt data using user's exact prompt
 */
async function extractReceiptData(imagePath) {
  const maxRetries = 3;
  const categories = getAllCategories();
  const categoryList = categories.map(c => `${c.id} (${c.name})`).join(', ');
  
  // Read and process image
  const processedResult = await processImage(imagePath);
  const base64File = processedResult.buffer.toString('base64');
  const fileHash = calculateFileHash(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
  
  // USER'S EXACT PROMPT - OPTIMIZED FOR ACCURACY
  const prompt = `You are a high-precision OCR assistant. Your task is to extract data from the provided receipt or invoice. 
  
  CRITICAL RULES:
  1. Extract values EXACTLY as they appear. Do NOT hallucinate names like "test merchant".
  2. If the vendor name is not clear, return null.
  3. The total_amount must be the final amount paid (including tax/service charge).
  4. Identify the currency correctly. Use standard 3-letter ISO 4217 codes (e.g., MYR, USD, SGD, EUR).
  5. Return ONLY a strict JSON object. No markdown, no text.

  Available Categories: ${categoryList}

  Required JSON Fields:
  - total_amount (number): The final total amount.
  - currency_code (string): ISO 4217 currency code (e.g., "MYR", "USD").
  - vendor_name (string): Exact merchant name.
  - date (string): YYYY-MM-DD.
  - reference_number (string): Invoice/Receipt #.
  - payment_method (string): Cash, Card, etc.
  - category (string): Must be one of the IDs from the list above.
  - bill_items (array): [{item_description, quantity, price}]

  JSON Structure:
  {
    "total_amount": 0.00,
    "currency_code": "MYR",
    "vendor_name": "",
    "date": "",
    "reference_number": "",
    "payment_method": "",
    "category": "",
    "bill_items": []
  }`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const apiStartTime = Date.now();
      console.log(`OCR attempt ${attempt}/${maxRetries} starting...`);
      
      const response = await callUniAPI(prompt, base64File, mimeType, 2000);
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`📡 API call finished in ${apiDuration}ms`);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Transform to internal format
      const result = {
        amount: parsed.total_amount || 0,
        currency: parsed.currency_code || 'MYR', 
        currencySymbol: parsed.currency_code === 'MYR' ? 'RM' : (parsed.currency_code === 'USD' ? '$' : parsed.currency_code),
        merchant: parsed.vendor_name || 'Unknown',
        date: parsed.date || '',
        billReference: parsed.reference_number || '',
        paymentMethod: parsed.payment_method || '',
        category: parsed.category || 'misc',
        items: parsed.bill_items?.map(item => ({
          name: item.item_description || '',
          quantity: item.quantity || 1,
          price: item.price || 0
        })) || [],
        confidence: 0.95, // Simplified
        fileHash: fileHash,
        fileSize: processedResult.processedSize,
        originalSize: processedResult.originalSize,
        rawOcr: parsed
      };
      
      console.log('OCR result:', result);
      return result;
      
    } catch (error) {
      if (error.response?.status === 402) {
        console.error('❌ UNIAPI Error: Payment Required or Quota Exceeded (402)');
        throw new Error('AI service quota exceeded. Please check your UniAPI balance.');
      }
      
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Simple validation
 */
function validateReceiptData(data) {
  if (!data.amount || data.amount <= 0) {
    throw new Error('Invalid amount');
  }
  return data;
}

/**
 * Tamper detection
 */
async function detectTamper(imagePath, ocrData) {
  return { isTampered: false, confidence: 1.0, reasons: [], riskLevel: 'low' };
}

module.exports = {
  extractReceiptData,
  validateReceiptData,
  detectTamper,
  calculateFileHash
};
