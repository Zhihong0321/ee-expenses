-- EE Expenses PostgreSQL Schema

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20)
);

-- Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    original_size BIGINT,
    file_path TEXT,
    ocr_data JSONB,
    category_id VARCHAR(50) REFERENCES categories(id),
    status VARCHAR(20) DEFAULT 'processed', -- processed, flagged, submitted, approved, rejected
    duplicate_status VARCHAR(20) DEFAULT 'none', -- none, detected, potential
    duplicate_of VARCHAR(50),
    duplicate_confidence FLOAT,
    potential_duplicates JSONB,
    tamper_check JSONB,
    tamper_checked_at TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expense_id VARCHAR(50)
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    notes TEXT,
    receipt_ids TEXT[], -- Array of receipt IDs
    total DECIMAL(12, 2) DEFAULT 0.00,
    category_breakdown JSONB,
    status VARCHAR(50) DEFAULT 'pending_verification',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by VARCHAR(100),
    verification_notes TEXT,
    receipts_data JSONB -- Denormalized receipt data for historical records
);

-- Seed Categories
INSERT INTO categories (id, name, icon, color) VALUES
('travel', 'Travel & Transport', 'plane', 'blue'),
('meals', 'Meals & Entertainment', 'utensils', 'orange'),
('office', 'Office Supplies', 'briefcase', 'purple'),
('tech', 'Technology & Software', 'laptop', 'blue'),
('communications', 'Communications', 'phone', 'green'),
('professional', 'Professional Services', 'scale', 'indigo'),
('marketing', 'Marketing & Advertising', 'megaphone', 'red'),
('utilities', 'Utilities & Operations', 'zap', 'yellow'),
('training', 'Training & Education', 'graduation-cap', 'cyan'),
('equipment', 'Equipment & Hardware', 'hard-drive', 'gray'),
('insurance', 'Insurance', 'shield', 'emerald'),
('logistics', 'Logistics & Postage', 'truck', 'amber'),
('health', 'Health & Wellness', 'heart', 'pink'),
('misc', 'Miscellaneous', 'more-horizontal', 'gray')
ON CONFLICT (id) DO NOTHING;
