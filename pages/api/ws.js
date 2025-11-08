export default function handler(req, res) {
  res
    .status(404)
    .json({
      message:
        "WebSocket server has been deprecated in favor of JWT-based authentication",
    });
}
