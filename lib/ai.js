const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log("OpenAI API key is missing");
      return null;
    }
    console.log("Attempting to get embedding for text length:", text?.length);

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

1️⃣ Categorize it into one or more of these categories based on content type and purpose:
- Images: Visual content, galleries, image collections
- Products: E-commerce, product listings, shopping content
- Books: Book reviews, reading materials, literature
- Articles: News, blog posts, written content
- Videos: Video content, streaming media
- Study: Educational content, tutorials, documentation

Important categorization rules:
- Content can belong to multiple categories if it serves multiple purposes
- Educational videos should be tagged as both "Videos" and "Study"
- Technical articles should be tagged as both "Articles" and "Study"
- Video courses should be tagged as "Videos" and "Study"
- Product reviews with educational content should be tagged as "Products" and "Study"
- Book reviews with educational content should be tagged as "Books" and "Study"

2️⃣ Extract structured details based on the content type:
- For videos → Extract title, description, and identify if it's educational
- For articles → Extract title, summary, and identify if it's technical/educational
- For products → Extract name, description, price, and educational value if any
- For books → Extract title, synopsis, and educational/technical nature
- For study materials → Extract topic, learning objectives, and format
- For images → Note visual content type and any educational purpose

Use this format for the final answer (JSON ONLY, no extra text):

{
  "categories": ["Primary Category", "Secondary Category"],
  "title": "Extracted or inferred title here",
  "description": "Extracted or inferred description here",
  "contentType": {
    "isEducational": true/false,
    "isTechnical": true/false,
    "format": "video/article/product/etc"
  }
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
      // Validate and clean categories
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
