const { getAuthUser } = require("../../../lib/auth");
const { searchContentByUser } = require("../../../lib/db");
const Fuse = require("fuse.js");
const { getEmbedding, cosineSimilarity } = require("../../../lib/ai");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userId = getAuthUser(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    console.log("OpenAI Key available:", !!process.env.OPENAI_API_KEY);

    const { prompt, segments = [] } = req.body;
    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ message: "Prompt is required" });
    }

    // Get initial results filtered by segments if provided
    const initialResults = await searchContentByUser(
      userId,
      prompt,
      500,
      segments.length > 0 ? segments : undefined
    );

    // Setup fuzzy search with segment-specific boosts
    const fuseOptions = {
      includeScore: true,
      keys: [
        { name: "title", weight: 0.4 },
        { name: "content_text", weight: 0.3 },
        { name: "segment_type", weight: 0.2 },
        { name: "url", weight: 0.1 },
      ],
      threshold: 0.4,
    };

    const fuse = new Fuse(initialResults, fuseOptions);
    const fuzzyResults = fuse.search(prompt);

    // Get semantic search results if OpenAI key is available
    let semanticResults = [];
    if (process.env.OPENAI_API_KEY) {
      const promptEmbedding = await getEmbedding(prompt);
      if (promptEmbedding) {
        semanticResults = await Promise.all(
          initialResults.map(async (item) => {
            // Include segment type in the embedding for context
            const textToEmbed = `${item.segment_type}: ${item.title || ""} ${
              item.content_text || ""
            }`.slice(0, 1000);

            const embedding = await getEmbedding(textToEmbed);
            if (!embedding) return null;

            const similarity = cosineSimilarity(promptEmbedding, embedding);
            return { ...item, similarity };
          })
        );

        semanticResults = semanticResults
          .filter((r) => r !== null)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 20);
      }
    }

    // Combine and deduplicate results with segment boosting
    const fuzzySet = new Set(fuzzyResults.map((r) => r.item.id));
    const semanticSet = new Set(semanticResults.map((r) => r.id));

    // Helper to boost score based on segment relevance
    const getSegmentBoost = (item) => {
      if (!segments.length) return 1;
      return segments.includes(item.segment_type) ? 1.2 : 0.8;
    };

    const combinedResults = [
      ...fuzzyResults.map((r) => ({
        ...r.item,
        score: r.score * getSegmentBoost(r.item),
        source: "fuzzy",
      })),
      ...semanticResults
        .filter((r) => !fuzzySet.has(r.id))
        .map((r) => ({
          ...r,
          score: r.similarity * getSegmentBoost(r),
          source: "semantic",
        })),
      ...initialResults
        .filter((r) => !fuzzySet.has(r.id) && !semanticSet.has(r.id))
        .slice(0, 10)
        .map((r) => ({
          ...r,
          score: 0.5 * getSegmentBoost(r),
          source: "basic",
        })),
    ].sort((a, b) => b.score - a.score);

    // Group results by segment
    const groupedResults = combinedResults.reduce((acc, result) => {
      const segment = result.segment_type;
      if (!acc[segment]) {
        acc[segment] = [];
      }
      acc[segment].push(result);
      return acc;
    }, {});

    return res.status(200).json({
      results: combinedResults.slice(0, 20),
      groupedResults,
      hasSemanticResults: semanticResults.length > 0,
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ message: "Search failed" });
  }
}
