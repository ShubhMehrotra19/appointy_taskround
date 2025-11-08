const { registerUser } = require('../../../lib/auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const result = await registerUser(email, password, name || email.split('@')[0]);
    
    return res.status(201).json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ message: error.message || 'Registration failed' });
  }
}

