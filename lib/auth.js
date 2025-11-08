const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createUser, getUserByEmail } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Hash password
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Compare password
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Register new user
async function registerUser(email, password, name) {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }
  
  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash, name);
  const token = generateToken(user.id);
  
  return { user, token };
}

// Login user
async function loginUser(email, password) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }
  
  const token = generateToken(user.id);
  
  return { 
    user: { id: user.id, email: user.email, name: user.name },
    token 
  };
}

// Middleware to verify token from request
function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return null;
  }
  
  return decoded.userId;
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  registerUser,
  loginUser,
  getAuthUser,
};

