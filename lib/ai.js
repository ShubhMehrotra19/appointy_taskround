const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text.slice(0, 8000), // OpenAI token limit
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error getting embedding:", error);
    return null;
  }
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function categorizeContent(data) {
  try {
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your-openai-api-key-here"
    ) {
      return fallbackCategorization(data);
    }

    const prompt = `
Analyze the following web content and perform TWO tasks:

1️⃣ Categorize it into ONE of these categories:
- Images: Content primarily containing images or visual media
- Products: Product listings, e-commerce pages, shopping content
- Books: Book reviews, book listings, reading material
- Articles: News articles, blog posts, long-form text content
- Videos: Video content, video players, video platforms
- Study: Educational content, tutorials, study materials, documentation

2️⃣ Extract structured details if possible, depending on the category:
- If it's a YouTube video or video page → Extract the complete video title and description.
- If it's a blog/article → Extract the full title and a concise summary or main content.
- If it's a product listing → Extract product name, short description, and price (if available).
- If it's a book page → Extract the book title and synopsis/summary.
- If it's study-related → Extract the main topic title and a brief summary.
- If it's image-based → Just note "Visual content".

Use this format for the final answer (JSON ONLY, no extra text):

{
  "category": "Images | Products | Books | Articles | Videos | Study",
  "title": "Extracted or inferred title here",
  "description": "Extracted or inferred description or summary here"
}

Content details:
- Text preview: ${data.text?.substring(0, 1000) || "No text"}
- Has images: ${data.hasImages ? "Yes" : "No"}
- Has videos: ${data.hasVideos ? "Yes" : "No"}
- Has links: ${data.hasLinks ? "Yes" : "No"}
- Element type: ${data.elementType || "unknown"}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // faster + better structured response handling
      messages: [
        {
          role: "system",
          content:
            "You are a content analysis assistant. Always respond in JSON format as instructed.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const rawOutput = response.choices[0].message.content.trim();

    try {
      const parsed = JSON.parse(rawOutput);
      const validCategories = [
        "Images",
        "Products",
        "Books",
        "Articles",
        "Videos",
        "Study",
      ];

      if (validCategories.includes(parsed.category)) {
        return parsed;
      }

      // If JSON invalid or category missing, fallback
      return {
        category: fallbackCategorization(data),
        title: "Untitled",
        description: "No description available",
      };
    } catch (parseError) {
      console.warn("Failed to parse AI JSON output:", rawOutput);
      return {
        category: fallbackCategorization(data),
        title: "Untitled",
        description: "No description available",
      };
    }
  } catch (error) {
    console.error("Error categorizing with AI:", error);
    return {
      category: fallbackCategorization(data),
      title: "Untitled",
      description: "No description available",
    };
  }
}

// Fallback categorization logic
function fallbackCategorization(data) {
  if (data.hasImages && !data.hasVideos) {
    return "Images";
  }
  if (data.hasVideos) {
    return "Videos";
  }
  if (
    data.hasLinks &&
    (data.text?.toLowerCase().includes("buy") ||
      data.text?.toLowerCase().includes("price") ||
      data.text?.toLowerCase().includes("$"))
  ) {
    return "Products";
  }
  if (data.text && data.text.length > 1000) {
    return "Articles";
  }
  if (
    data.text?.toLowerCase().includes("book") ||
    data.text?.toLowerCase().includes("read")
  ) {
    return "Books";
  }
  return "Study";
}

module.exports = {
  categorizeContent,
  getEmbedding,
  cosineSimilarity,
};
