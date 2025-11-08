const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'synapse.db');

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
        
        // Create content table
        db.run(`
          CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            content_text TEXT,
            content_html TEXT,
            segment_type TEXT NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating content table:', err);
            reject(err);
            return;
          }
          
          // Create indexes
          db.run(`
            CREATE INDEX IF NOT EXISTS idx_content_user_id ON content(user_id)
          `);
          
          db.run(`
            CREATE INDEX IF NOT EXISTS idx_content_segment_type ON content(segment_type)
          `);
          
          db.run(`
            CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at)
          `);
          
          console.log('Database initialized successfully');
          resolve(db);
        });
      });
    });
  });
}

// Get database instance
let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await initDatabase();
  }
  return dbInstance;
}

// User operations
async function createUser(email, passwordHash, name) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            reject(new Error('Email already exists'));
          } else {
            reject(err);
          }
          return;
        }
        resolve({ id: this.lastID, email, name });
      }
    );
  });
}

async function getUserByEmail(email) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function getUserById(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Content operations
async function createContent(userId, url, title, contentText, contentHtml, segmentType, metadata) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const metadataJson = JSON.stringify(metadata || {});
    db.run(
      `INSERT INTO content (user_id, url, title, content_text, content_html, segment_type, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, url, title, contentText, contentHtml, segmentType, metadataJson],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID });
      }
    );
  });
}

async function getContentByUser(userId, segmentType = null) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM content WHERE user_id = ?';
    const params = [userId];
    
    if (segmentType) {
      query += ' AND segment_type = ?';
      params.push(segmentType);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Parse metadata JSON
      const content = rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));
      
      resolve(content);
    });
  });
}

async function getContentStats(userId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT segment_type, COUNT(*) as count 
       FROM content 
       WHERE user_id = ? 
       GROUP BY segment_type`,
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

module.exports = {
  getDb,
  createUser,
  getUserByEmail,
  getUserById,
  createContent,
  getContentByUser,
  getContentStats,
};

