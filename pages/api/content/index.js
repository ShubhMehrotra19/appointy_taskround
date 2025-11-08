const { getAuthUser } = require("../../../lib/auth");
const {
  createContent,
  getContentByUser,
  getContentStats,
} = require("../../../lib/db");

export default async function handler(req, res) {
  const userId = getAuthUser(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "POST") {
    try {
      const { url, title, content, html, segmentType, metadata } = req.body;

      if (!url || !segmentType) {
        return res
          .status(400)
          .json({ message: "URL and segment type are required" });
      }

      const result = await createContent(
        userId,
        url,
        title || "Untitled",
        content?.text || "",
        html || "",
        segmentType,
        metadata || {}
      );

      // Broadcast update to connected clients (if WS server initialized)
      try {
        const wsModule = require("../ws");
        const broadcastToUser = wsModule && wsModule.broadcastToUser;
        if (typeof broadcastToUser === "function") {
          broadcastToUser(userId, {
            type: "content_update",
            content: {
              id: result.id,
              user_id: userId,
              url,
              title: title || "Untitled",
              content_text: content?.text || "",
              content_html: html || "",
              segment_type: segmentType,
              metadata: metadata || {},
              created_at: new Date().toISOString(),
            },
          });
        } else {
          console.log("broadcastToUser not available yet");
        }
      } catch (err) {
        console.error("Error requiring ws module for broadcast:", err);
      }

      return res
        .status(201)
        .json({ id: result.id, message: "Content saved successfully" });
    } catch (error) {
      console.error("Error saving content:", error);
      return res.status(500).json({ message: "Failed to save content" });
    }
  }

  if (req.method === "GET") {
    try {
      const { segmentType } = req.query;
      const content = await getContentByUser(userId, segmentType || null);
      const stats = await getContentStats(userId);

      return res.status(200).json({ content, stats });
    } catch (error) {
      console.error("Error fetching content:", error);
      return res.status(500).json({ message: "Failed to fetch content" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
