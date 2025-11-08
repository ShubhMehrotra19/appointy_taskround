const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "synapse.db");
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "synapse";

// If MONGODB_URI is provided, use MongoDB, otherwise fall back to sqlite
let useMongo = Boolean(MONGODB_URI);

// --- Database initialization ---
let mongoClient = null;
let mongoDb = null;
let sqliteDbInstance = null;

// Initialize MongoDB connection
async function initMongo() {
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB);

    // Ensure indexes
    await mongoDb
      .collection("users")
      .createIndex({ email: 1 }, { unique: true })
      .catch(() => {});
    await mongoDb.collection("content").createIndex({ user_id: 1 });
    await mongoDb.collection("content").createIndex({ segment_type: 1 });
    await mongoDb.collection("content").createIndex({ created_at: 1 });

    console.log("Connected to MongoDB successfully");
    return mongoDb;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Initialize SQLite database
function initSqliteDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("Error opening sqlite database:", err);
        reject(err);
        return;
      }

      db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) return reject(err);

          db.run(
            `
            CREATE TABLE IF NOT EXISTS content (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              url TEXT NOT NULL,
              title TEXT,
              content_text TEXT,
              content_html TEXT,
              segment_type TEXT NOT NULL,
              metadata TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `,
            (err) => {
              if (err) return reject(err);
              db.run(
                `CREATE INDEX IF NOT EXISTS idx_content_user_id ON content(user_id)`
              );
              db.run(
                `CREATE INDEX IF NOT EXISTS idx_content_segment_type ON content(segment_type)`
              );
              db.run(
                `CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at)`
              );
              resolve(db);
            }
          );
        }
      );
    });
  });
}

async function getSqliteDb() {
  if (!sqliteDbInstance) {
    sqliteDbInstance = await initSqliteDatabase();
  }
  return sqliteDbInstance;
}

// Public API functions
async function createUser(email, passwordHash, name) {
  if (useMongo) {
    const db = await initMongo();
    const users = db.collection("users");
    const now = new Date();
    try {
      const result = await users.insertOne({
        email,
        password_hash: passwordHash,
        name,
        created_at: now,
      });
      return { id: result.insertedId.toString(), email, name, created_at: now };
    } catch (err) {
      if (err.code === 11000) {
        throw new Error("Email already exists");
      }
      throw err;
    }
  }

  // sqlite fallback
  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      [email, passwordHash, name],
      function (err) {
        if (err) {
          if (err.message && err.message.includes("UNIQUE constraint")) {
            reject(new Error("Email already exists"));
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
  if (useMongo) {
    const db = await initMongo();
    const user = await db.collection("users").findOne({ email });
    if (!user) return null;
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      password_hash: user.password_hash,
      created_at: user.created_at,
    };
  }

  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function getUserById(id) {
  if (useMongo) {
    const db = await initMongo();
    let _id = null;
    try {
      _id = new ObjectId(id);
    } catch (e) {
      // If id is not a valid ObjectId, try to find by string id field
      const userByIdField = await db.collection("users").findOne({ id: id });
      if (userByIdField) {
        return {
          id: userByIdField._id.toString(),
          email: userByIdField.email,
          name: userByIdField.name,
          created_at: userByIdField.created_at,
        };
      }
      return null;
    }

    const user = await db.collection("users").findOne({ _id });
    if (!user) return null;
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    };
  }

  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, email, name, created_at FROM users WHERE id = ?",
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

async function createContent(
  userId,
  url,
  title,
  contentText,
  contentHtml,
  segmentType,
  metadata
) {
  if (useMongo) {
    const db = await initMongo();
    const contentCol = db.collection("content");
    const now = new Date();
    // Process and store images if they exist in metadata
    const images = metadata?.content?.images || [];
    const processedImages = images.map((img) => ({
      src: img.src,
      alt: img.alt,
      dataUrl: img.dataUrl,
      thumbnail: img.thumbnail,
    }));

    const doc = {
      user_id: userId, // store as string for simplicity
      url,
      title,
      content_text: contentText,
      content_html: contentHtml,
      segment_type: segmentType,
      metadata: {
        ...metadata,
        content: {
          ...metadata.content,
          images: processedImages,
        },
      },
      created_at: now,
    };
    const result = await contentCol.insertOne(doc);
    return { id: result.insertedId.toString() };
  }

  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    const metadataJson = JSON.stringify(metadata || {});
    db.run(
      `INSERT INTO content (user_id, url, title, content_text, content_html, segment_type, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, url, title, contentText, contentHtml, segmentType, metadataJson],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

async function getContentByUser(userId, segmentType = null) {
  if (useMongo) {
    const db = await initMongo();
    const query = { user_id: userId };
    if (segmentType) query.segment_type = segmentType;
    const rows = await db
      .collection("content")
      .find(query)
      .sort({ created_at: -1 })
      .toArray();
    // Normalize field names to match sqlite rows used elsewhere
    return rows.map((r) => ({
      id: r._id.toString(),
      user_id: r.user_id,
      url: r.url,
      title: r.title,
      content_text: r.content_text,
      content_html: r.content_html,
      segment_type: r.segment_type,
      metadata: r.metadata || {},
      created_at: r.created_at,
    }));
  }

  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    let query = "SELECT * FROM content WHERE user_id = ?";
    const params = [userId];
    if (segmentType) {
      query += " AND segment_type = ?";
      params.push(segmentType);
    }
    query += " ORDER BY created_at DESC";
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      const content = rows.map((row) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
      }));
      resolve(content);
    });
  });
}

async function getContentStats(userId) {
  if (useMongo) {
    const db = await initMongo();
    const pipeline = [
      { $match: { user_id: userId } },
      { $group: { _id: "$segment_type", count: { $sum: 1 } } },
      { $project: { segment_type: "$_id", count: 1, _id: 0 } },
    ];
    const rows = await db.collection("content").aggregate(pipeline).toArray();
    return rows;
  }

  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT segment_type, COUNT(*) as count 
       FROM content 
       WHERE user_id = ? 
       GROUP BY segment_type`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// Search content by prompt for a user (simple full-text/regex search)
async function searchContentByUser(userId, prompt, limit = 100) {
  if (!prompt || prompt.trim() === "") return [];
  const q = prompt.trim();
  if (useMongo) {
    const db = await initMongo();
    // Build a case-insensitive regex search across common fields
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const query = {
      user_id: userId,
      $or: [
        { title: regex },
        { content_text: regex },
        { "metadata.content.images.alt": regex },
        { "metadata.content.links.href": regex },
        { "metadata.content.videos.src": regex },
        { url: regex },
      ],
    };
    const rows = await db
      .collection("content")
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
    return rows.map((r) => ({
      id: r._id.toString(),
      user_id: r.user_id,
      url: r.url,
      title: r.title,
      content_text: r.content_text,
      content_html: r.content_html,
      segment_type: r.segment_type,
      metadata: r.metadata || {},
      created_at: r.created_at,
    }));
  }

  // sqlite fallback: use LIKE on title and content_text
  const db = await getSqliteDb();
  return new Promise((resolve, reject) => {
    const like = `%${q.replace(/%/g, "")}%`;
    db.all(
      `SELECT * FROM content WHERE user_id = ? AND (title LIKE ? OR content_text LIKE ? OR url LIKE ?) ORDER BY created_at DESC LIMIT ?`,
      [userId, like, like, like, limit],
      (err, rows) => {
        if (err) return reject(err);
        const content = rows.map((row) => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {},
        }));
        resolve(content);
      }
    );
  });
}

// Export all database functions
module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  createContent,
  getContentByUser,
  getContentStats,
  searchContentByUser,
};
