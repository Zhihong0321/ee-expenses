const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Support Railway's DATABASE_URL or individual env vars
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      user: process.env.DB_USER || 'ee_user',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'ee_expenses',
      password: process.env.DB_PASSWORD || 'ee_password',
      port: process.env.DB_PORT || 5432,
    });

const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, '../../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ PostgreSQL Database initialized');
  } catch (err) {
    console.error('❌ Error initializing PostgreSQL database:', err);
    throw err;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};
