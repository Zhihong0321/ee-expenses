# EE Expenses - AI-Assisted Expense Claims

A cloud-native expense management system allowing employees to "bank" receipts into a digital shoebox for batch-submission with AI-powered verification.

## 🚀 Features

### Core Features
- **Digital Shoebox**: Upload receipts and store them for later submission
- **AI-Powered OCR**: Automatic receipt data extraction using UniAPI (Gemini 3 Flash)
- **Auto-Categorization**: Smart expense categorization into 10 preset categories
- **Batch Claims**: Select multiple receipts and submit as a single expense claim

### AI Verification Features
- **Fraud Detection**: AI-powered tamper detection on receipt images
- **Duplicate Detection**: Semantic analysis to detect duplicate submissions (even with different photos)
  - Compares merchant, amount, date, and items
  - AI deep analysis for high-confidence matches
  - Flags potential duplicates before submission

### Admin Features
- **Verification Dashboard**: Review and approve/reject expense claims
- **Duplicate Management**: Review and resolve flagged duplicate receipts
- **Spending Analytics**: Category breakdown and spending trends
- **Admin Stats**: Overview of pending verifications, approvals, and flagged items

### Data Integrity
- **Strict JSON Validation**: All OCR results validated against schema (Joi)
- **Exponential Backoff**: Resilient API calls with retry logic
- **Security**: No hardcoded keys, all credentials in environment variables

## 📁 Project Structure

```
ee-expenses/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── server.js       # Main server with all routes
│   │   ├── config/
│   │   │   └── categories.js    # Preset expense categories
│   │   └── services/
│   │       ├── uniapiService.js          # UniAPI integration with backoff
│   │       └── duplicateDetectionService.js  # Duplicate detection logic
│   ├── uploads/            # Temporary file storage
│   ├── package.json
│   └── firebase-service-account.json  # Firebase credentials (create manually)
├── frontend/               # React Vite application
│   ├── src/
│   │   ├── App.jsx        # Main app with shoebox & expenses
│   │   ├── AdminVerificationPage.jsx  # Admin dashboard
│   │   └── index.css      # Tailwind styles
│   └── package.json
└── .env                   # Environment variables
```

## 🔧 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Google Firestore
- **AI**: UniAPI (Gemini 3 Flash) via OpenAI-compatible API

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Google Firebase project with Firestore enabled
- UniAPI account with Gemini 3 Flash access

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Set up Firebase
# 1. Go to Firebase Console: https://console.firebase.google.com/
# 2. Create a project or select existing
# 3. Go to Project Settings > Service Accounts
# 4. Click "Generate New Private Key"
# 5. Save as backend/firebase-service-account.json

# Start the backend server
npm run dev
# Server runs on http://localhost:11002
```

### 2. Frontend Setup

```bash
# Navigate to frontend (new terminal)
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
# App runs on http://localhost:11001
```

### 3. Environment Configuration

Ensure your `.env` file (in project root) contains:

```env
# UniAPI Configuration
UNIAPI_KEY=your_uniapi_key_here
UNIAPI_BASE_URL=https://api.uniapi.io/v1
UNIAPI_MODEL=gemini-3-flash-preview

# Firestore Configuration
FIRESTORE_PROJECT_ID=your_project_id

# Server Configuration
PORT=11002
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:11001
```

## 📊 API Endpoints

### Public Endpoints

#### Receipts
- `POST /api/receipts/upload` - Upload a receipt image (multipart/form-data)
  - Auto-categorizes based on merchant/items
  - Runs duplicate detection
  - Returns: OCR data, category, duplicate warnings

- `GET /api/receipts/:userId` - Get all receipts for a user
- `GET /api/receipts/detail/:receiptId` - Get single receipt details
- `POST /api/receipts/:receiptId/tamper-check` - Run AI tamper detection

#### Expenses
- `POST /api/expenses/submit` - Submit receipts as expense claim
  - Body: `userId`, `receiptIds[]`, `category`, `notes`
  - Validates no flagged receipts
  - Creates `pending_verification` status

- `GET /api/expenses/:userId` - Get expense claims

#### Categories & Analytics
- `GET /api/categories` - Get all preset categories
- `GET /api/analytics/spending/:userId?period=month` - Spending analysis by category
  - Periods: `week`, `month`, `quarter`, `year`

### Admin Endpoints

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/verifications` - Get pending verifications
- `GET /api/admin/duplicates` - Get flagged duplicate receipts
- `POST /api/admin/verifications/:expenseId` - Approve/reject claim
  - Body: `action` (approve/reject), `notes`, `adminId`
- `POST /api/admin/duplicates/:receiptId/resolve` - Mark as (not) duplicate
  - Body: `isDuplicate` (boolean), `notes`

## 🏷️ Preset Expense Categories

| Category | ID | Keywords |
|----------|-----|----------|
| Travel | travel | airline, taxi, uber, hotel, fuel |
| Meals & Entertainment | meals | restaurant, cafe, food, catering |
| Office Supplies | office | stationery, laptop, printer, furniture |
| Communications & Tech | tech | phone, internet, software, subscription |
| Professional Services | professional | legal, accounting, training, certification |
| Marketing & Advertising | marketing | ads, promotion, campaign, printing |
| Utilities & Operations | utilities | electricity, water, maintenance, insurance |
| Health & Wellness | health | medical, pharmacy, gym, fitness |
| Client Entertainment | client | client gifts, hospitality, entertainment |
| Miscellaneous | misc | Other expenses |

## 🔒 Security Features

- **No hardcoded keys**: All credentials in `.env` files
- **Input validation**: Joi schema validation for all OCR results
- **File type restrictions**: Only images and PDFs allowed
- **Duplicate prevention**: AI-powered semantic duplicate detection
- **Fraud detection**: Tamper detection on receipt images

## 🔄 Workflow

### User Flow
1. **Upload** → AI extracts data + auto-categorizes + checks duplicates
2. **Review** → User sees receipts in shoebox with status badges
3. **Select & Submit** → User selects receipts, submits claim
4. **Track** → Claim shows as "pending verification" until admin review

### Admin Flow
1. **Dashboard** → View stats on pending verifications
2. **Review Claims** → See submitted expenses with receipt details
3. **Check Duplicates** → Review AI-flagged potential duplicates
4. **Approve/Reject** → Make decision with optional notes

## 🛠️ Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

## 📝 OCR JSON Schema

All OCR results are validated against this schema:

```json
{
  "merchant": "string (optional)",
  "date": "ISO date string",
  "amount": "number (required)",
  "currency": "3-letter code (default: USD)",
  "category": "auto-assigned category id",
  "categoryName": "human-readable category name",
  "items": [
    {
      "name": "string (required)",
      "quantity": "number",
      "price": "number (required)"
    }
  ],
  "confidence": "number 0-1 (optional)"
}
```

## 🔮 Future Milestones

- ✅ **Milestone 1**: The Shoebox & Data Foundation (Complete)
- ✅ **Milestone 2**: Batch Submission & Claims (Complete)
- ✅ **Milestone 3**: Tamper Detection & Auditing (Complete)
- 🔄 **Milestone 4**: Enhanced AI Features (Receipt classification improvements)

**Note**: Authentication is handled by the parent app ecosystem. This module receives `userId` from the host application.

## 🐛 Troubleshooting

**Firebase Connection Issues**
- Ensure `firebase-service-account.json` exists in backend folder
- Check project ID matches your Firebase project
- Verify Firestore is enabled in Firebase Console

**UniAPI Errors**
- Verify `UNIAPI_KEY` is correct in `.env`
- Check API quota and billing status
- Review exponential backoff logs in console

**File Upload Failures**
- Ensure `uploads/` directory exists or is created
- Check file size limit (default: 10MB)
- Verify file types (images/PDFs only)

**Duplicate Detection Not Working**
- Check that receipts have valid OCR data
- Verify Firestore queries are working
- Review server logs for AI analysis errors

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the project documentation and follow coding standards.
