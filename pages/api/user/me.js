const { getAuthUser } = require('../../../lib/auth');
const { getUserById } = require('../../../lib/db');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}

