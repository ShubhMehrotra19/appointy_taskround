const { getAuthUser } = require("./auth");

// Helper to handle multi-segment content creation
async function createContentWithSegments(
  userId,
  url,
  title,
  content,
  html,
  segments,
  metadata = {}
) {
  const mainSegment = segments[0]; // Primary segment
  const additionalSegments = segments.slice(1); // Secondary segments

  // Store the content in the primary segment
  const result = await createContent(
    userId,
    url,
    title,
    content,
    html,
    mainSegment,
    {
      ...metadata,
      allSegments: segments, // Store all segments in metadata
      isMultiSegment: segments.length > 1,
      contentType: metadata.contentType || {},
    }
  );

  // Create duplicate entries for additional segments if any
  if (additionalSegments.length > 0) {
    await Promise.all(
      additionalSegments.map((segment) =>
        createContent(userId, url, title, content, html, segment, {
          ...metadata,
          allSegments: segments,
          isMultiSegment: true,
          isPrimarySegment: false,
          primarySegment: mainSegment,
          contentType: metadata.contentType || {},
        })
      )
    );
  }

  return {
    ...result,
    segments,
    isMultiSegment: segments.length > 1,
  };
}

// Process and validate segments from AI categorization
function processSegments(aiResponse) {
  let segments = [];

  // Handle new format with categories array
  if (aiResponse.categories && Array.isArray(aiResponse.categories)) {
    segments = aiResponse.categories;
  }
  // Handle legacy format with single category
  else if (aiResponse.category) {
    segments = [aiResponse.category];
  }

  // Add Study segment for educational content
  if (aiResponse.contentType?.isEducational && !segments.includes("Study")) {
    segments.push("Study");
  }

  // Validate segments
  const validSegments = segments.filter((segment) =>
    ["Images", "Products", "Books", "Articles", "Videos", "Study"].includes(
      segment
    )
  );

  return {
    segments: validSegments,
    contentType: aiResponse.contentType || {},
    metadata: {
      title: aiResponse.title,
      description: aiResponse.description,
      contentType: aiResponse.contentType,
    },
  };
}

module.exports = {
  createContentWithSegments,
  processSegments,
};
