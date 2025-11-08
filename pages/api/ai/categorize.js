const { getAuthUser } = require('../../../lib/auth');
const { categorizeContent } = require('../../../lib/ai');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const data = req.body;
    const segmentType = await categorizeContent(data);
    
    return res.status(200).json({ segmentType });
  } catch (error) {
    console.error('Categorization error:', error);
    return res.status(500).json({ message: 'Failed to categorize content' });
  }
}

