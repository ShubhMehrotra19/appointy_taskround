const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Categorize content using AI
async function categorizeContent(data) {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      // Fallback categorization if no API key
      return fallbackCategorization(data);
    }
    
    const prompt = `Analyze the following web content and categorize it into one of these types:
- Images: Content primarily containing images or visual media
- Products: Product listings, e-commerce pages, shopping content
- Books: Book reviews, book listings, reading material
- Articles: News articles, blog posts, long-form text content
- Videos: Video content, video players, video platforms
- Study: Educational content, tutorials, study materials, documentation

Content details:
- Text preview: ${data.text?.substring(0, 500) || 'No text'}
- Has images: ${data.hasImages ? 'Yes' : 'No'}
- Has videos: ${data.hasVideos ? 'Yes' : 'No'}
- Has links: ${data.hasLinks ? 'Yes' : 'No'}
- Element type: ${data.elementType || 'unknown'}

Respond with ONLY one word: Images, Products, Books, Articles, Videos, or Study.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a content categorization assistant. Respond with only one word from the allowed categories.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 10,
      temperature: 0.3,
    });
    
    const category = response.choices[0].message.content.trim();
    const validCategories = ['Images', 'Products', 'Books', 'Articles', 'Videos', 'Study'];
    
    if (validCategories.includes(category)) {
      return category;
    }
    
    return fallbackCategorization(data);
  } catch (error) {
    console.error('Error categorizing with AI:', error);
    return fallbackCategorization(data);
  }
}

// Fallback categorization logic
function fallbackCategorization(data) {
  if (data.hasImages && !data.hasVideos) {
    return 'Images';
  }
  if (data.hasVideos) {
    return 'Videos';
  }
  if (data.hasLinks && (data.text?.toLowerCase().includes('buy') || data.text?.toLowerCase().includes('price') || data.text?.toLowerCase().includes('$'))) {
    return 'Products';
  }
  if (data.text && data.text.length > 1000) {
    return 'Articles';
  }
  if (data.text?.toLowerCase().includes('book') || data.text?.toLowerCase().includes('read')) {
    return 'Books';
  }
  return 'Study';
}

module.exports = {
  categorizeContent,
};

