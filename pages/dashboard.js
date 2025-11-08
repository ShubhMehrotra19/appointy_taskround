import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  PanelRightOpen,
  PanelRightClose,
  Brain,
  Sparkles,
  Image,
  ShoppingBag,
  BookOpen,
  FileText,
  Video,
  GraduationCap,
  Search,
} from "lucide-react";

const SEGMENT_TYPES = [
  "Images",
  "Products",
  "Books",
  "Articles",
  "Videos",
  "Study",
];
const SEGMENT_ICONS = {
  Images: Image,
  Products: ShoppingBag,
  Books: BookOpen,
  Articles: FileText,
  Videos: Video,
  Study: GraduationCap,
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [content, setContent] = useState({});
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchPrompt, setSearchPrompt] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchMethod, setSearchMethod] = useState(null); // 'basic', 'fuzzy', or 'semantic'
  const [selectedSearchSegments, setSelectedSearchSegments] = useState([]);

  // After mounting, we have access to the theme
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    checkAuth();

    // Set up Socket.IO connection (create ref and ensure cleanup is returned)
    let socketRef = null;
    const token = localStorage.getItem("synapse_token");
    if (!token) return;

    import("socket.io-client")
      .then(({ io }) => {
        const socket = io({
          path: "/api/ws",
          auth: { token },
          reconnectionDelayMax: 10000,
        });
        socketRef = socket;

        socket.on("connect", () => {
          console.log("Socket connected", socket.id);
        });

        socket.on("connect_error", (err) => {
          console.error("Socket connect error:", err);
        });

        // Listen for explicit content updates
        socket.on("content_update", (data) => {
          try {
            // Add the new content to the appropriate segment
            setContent((prev) => {
              const updated = { ...prev };
              const segment = data.content.segment_type;
              if (updated[segment]) {
                updated[segment] = [data.content, ...updated[segment]];
              } else {
                updated[segment] = [data.content];
              }
              return updated;
            });

            // Update stats
            setStats((prev) => {
              const updatedStats = [...prev];
              const statIndex = updatedStats.findIndex(
                (s) => s.segment_type === data.content.segment_type
              );
              if (statIndex >= 0) {
                updatedStats[statIndex].count++;
              } else {
                updatedStats.push({
                  segment_type: data.content.segment_type,
                  count: 1,
                });
              }
              return updatedStats;
            });
          } catch (error) {
            console.error("Error handling Socket.IO content_update:", error);
          }
        });
      })
      .catch((error) => {
        console.error("Error loading Socket.IO client:", error);
      });

    // cleanup
    return () => {
      if (socketRef && socketRef.disconnect) socketRef.disconnect();
    };
  }, []);

  // Initialize theme from localStorage and persist changes
  useEffect(() => {
    try {
      const t = localStorage.getItem("synapse_theme");
      if (t) setTheme(t);
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("synapse_theme", theme);
    } catch (e) {}
  }, [theme]);

  async function checkAuth() {
    try {
      const token = localStorage.getItem("synapse_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const [userResponse, contentResponse] = await Promise.all([
        fetch("/api/user/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/content", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
      } else {
        router.push("/login");
        return;
      }

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        setStats(contentData.stats);

        // Group content by segment type
        const grouped = {};
        SEGMENT_TYPES.forEach((type) => {
          grouped[type] = [];
        });

        contentData.content.forEach((item) => {
          if (grouped[item.segment_type]) {
            grouped[item.segment_type].push(item);
          }
        });

        setContent(grouped);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    // Notify same-window listeners (content scripts) that logout is happening
    try {
      window.postMessage(
        { type: "synapse:logout", ts: Date.now() },
        window.location.origin
      );
    } catch (e) {
      // fallback to wildcard if origin throws for some reason
      try {
        window.postMessage({ type: "synapse:logout", ts: Date.now() }, "*");
      } catch (e2) {}
    }

    // Clear stored auth and navigate to login
    localStorage.removeItem("synapse_token");
    localStorage.removeItem("synapse_user");
    router.push("/login");
  }

  async function runPromptSearch() {
    if (!searchPrompt || !searchPrompt.trim()) return;
    setSearching(true);
    try {
      const token = localStorage.getItem("synapse_token");
      const resp = await fetch("/api/ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: searchPrompt,
          segments: selectedSearchSegments,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setSearchResults(data.results || []);
      } else {
        console.error("Search failed", await resp.text());
      }
    } catch (err) {
      console.error("Search error", err);
    } finally {
      setSearching(false);
    }
  }

  function getCount(type) {
    const stat = stats.find((s) => s.segment_type === type);
    return stat ? stat.count : 0;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "min-h-screen " +
        (theme === "dark"
          ? "bg-gray-900 text-gray-100"
          : "bg-gray-50 text-gray-900")
      }>
      {/* Header */}
      <header
        className={
          (theme === "dark"
            ? "bg-gray-800 border-b border-gray-700"
            : "bg-white shadow-sm border-b") + ""
        }>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">Synapse</h1>
                <p
                  className={
                    (theme === "dark" ? "text-gray-300" : "text-gray-600") +
                    " text-sm"
                  }>
                  Welcome back, {user?.name || user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Theme toggle */}
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  title={
                    theme === "dark"
                      ? "Switch to light mode"
                      : "Switch to dark mode"
                  }>
                  {mounted &&
                    (theme === "dark" ? (
                      <Sun className="w-5 h-5" />
                    ) : (
                      <Moon className="w-5 h-5" />
                    ))}
                </button>

                {/* AI Search sidebar toggle */}
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setSidebarOpen((s) => !s)}
                  title={sidebarOpen ? "Close AI Search" : "Open AI Search"}>
                  {sidebarOpen ? (
                    <PanelRightClose className="w-5 h-5" />
                  ) : (
                    <PanelRightOpen className="w-5 h-5" />
                  )}
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md text-sm border hover:opacity-90 transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with right sidebar */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Your Second Brain
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                All your captured content organized by type
              </p>
            </div>

            {/* Segment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {SEGMENT_TYPES.map((type) => (
                <div
                  key={type}
                  onClick={() =>
                    setSelectedSegment(selectedSegment === type ? null : type)
                  }
                  className={`rounded-xl shadow-md p-6 cursor-pointer transition-all
                    ${
                      theme === "dark"
                        ? "bg-gray-800 hover:bg-gray-700 border border-gray-700"
                        : "bg-white hover:bg-gray-50 border border-gray-200"
                    } 
                    ${
                      selectedSegment === type
                        ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900"
                        : ""
                    }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-3 rounded-lg ${
                        theme === "dark"
                          ? "bg-gray-700/50 text-primary-400"
                          : "bg-primary-50 text-primary-600"
                      }`}>
                      {React.createElement(SEGMENT_ICONS[type], {
                        className: "w-6 h-6",
                      })}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        theme === "dark"
                          ? "text-primary-400"
                          : "text-primary-600"
                      }`}>
                      {getCount(type)}
                    </div>
                  </div>
                  <h3
                    className={`text-xl font-semibold ${
                      theme === "dark" ? "text-gray-100" : "text-gray-900"
                    }`}>
                    {type}
                  </h3>
                  <p
                    className={`text-sm mt-2 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}>
                    {selectedSegment === type
                      ? "Click to collapse"
                      : "Click to view items"}
                  </p>
                </div>
              ))}
            </div>

            {/* Content List */}
            {selectedSegment && (
              <div
                className={`rounded-xl shadow-md p-6 ${
                  theme === "dark"
                    ? "bg-gray-800 border border-gray-700"
                    : "bg-white border border-gray-200"
                }`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        theme === "dark"
                          ? "bg-gray-700/50 text-primary-400"
                          : "bg-primary-50 text-primary-600"
                      }`}>
                      {React.createElement(SEGMENT_ICONS[selectedSegment], {
                        className: "w-6 h-6",
                      })}
                    </div>
                    <h3
                      className={`text-2xl font-bold ${
                        theme === "dark" ? "text-gray-100" : "text-gray-900"
                      }`}>
                      {selectedSegment}
                    </h3>
                  </div>
                  <span
                    className={`${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}>
                    {content[selectedSegment]?.length || 0} items
                  </span>
                </div>

                {content[selectedSegment] &&
                content[selectedSegment].length > 0 ? (
                  <div className="space-y-4">
                    {content[selectedSegment].map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg p-4 transition-all ${
                          theme === "dark"
                            ? "bg-gray-700/50 hover:bg-gray-700 border border-gray-600"
                            : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4
                              className={`font-semibold mb-2 ${
                                theme === "dark"
                                  ? "text-gray-100"
                                  : "text-gray-900"
                              }`}>
                              {item.title || "Untitled"}
                            </h4>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 mb-2 block truncate">
                              {item.url}
                            </a>

                            {/* Preview for Images segment */}
                            {selectedSegment === "Images" &&
                              item.metadata?.content?.images?.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {item.metadata.content.images.map(
                                    (img, idx) => (
                                      <div
                                        key={idx}
                                        className="relative aspect-square rounded-lg overflow-hidden">
                                        <img
                                          src={img.dataUrl || img.src}
                                          alt={img.alt}
                                          className="absolute inset-0 w-full h-full object-cover"
                                        />
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {/* Preview for Videos segment */}
                            {selectedSegment === "Videos" &&
                              item.metadata?.content?.videos?.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {item.metadata.content.videos.map(
                                    (video, idx) => (
                                      <div
                                        key={idx}
                                        className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                                        {video.thumbnail ? (
                                          <img
                                            src={video.thumbnail}
                                            alt="Video thumbnail"
                                            className="absolute inset-0 w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-4xl">🎥</span>
                                          </div>
                                        )}
                                        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                                          <a
                                            href={video.src}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition">
                                            <span className="text-2xl">▶️</span>
                                          </a>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {/* Show text content for other segments */}
                            {selectedSegment !== "Images" &&
                              selectedSegment !== "Videos" &&
                              item.content_text && (
                                <p
                                  className={`text-sm line-clamp-2 ${
                                    theme === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-600"
                                  }`}>
                                  {item.content_text.substring(0, 200)}...
                                </p>
                              )}

                            <div className="flex items-center justify-between mt-4">
                              <p
                                className={`text-xs ${
                                  theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-500"
                                }`}>
                                Saved on {formatDate(item.created_at)}
                              </p>
                              <div
                                className={`text-xs ${
                                  theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-500"
                                }`}>
                                {item.metadata?.content?.images?.length > 0 && (
                                  <span className="mr-4">
                                    <Image className="w-4 h-4 inline mr-1" />
                                    {item.metadata.content.images.length}
                                  </span>
                                )}
                                {item.metadata?.content?.videos?.length > 0 && (
                                  <span className="mr-4">
                                    <Video className="w-4 h-4 inline mr-1" />
                                    {item.metadata.content.videos.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div
                      className={`mb-4 ${
                        theme === "dark" ? "text-gray-600" : "text-gray-400"
                      }`}>
                      {React.createElement(SEGMENT_ICONS[selectedSegment], {
                        className: "w-16 h-16 mx-auto",
                      })}
                    </div>
                    <p
                      className={
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }>
                      No {selectedSegment.toLowerCase()} saved yet
                    </p>
                    <p
                      className={`text-sm mt-2 ${
                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                      }`}>
                      Use the browser extension to start capturing content
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Initial state is now empty */}
          </div>

          {/* Right Sidebar */}
          {sidebarOpen && (
            <aside
              className={`w-80 border-r shrink-0 h-full flex flex-col 
                ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-800"
                    : "bg-white border-gray-200"
                }`}>
              <div className="p-4 flex-1 flex flex-col">
                {/* Results - Flex grow to fill space */}

                {/* Search Results */}
                <div className="flex-1 overflow-auto min-h-0">
                  {searchResults.length === 0 ? (
                    <div
                      className={`text-sm flex items-center gap-2 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}>
                      <Sparkles className="w-4 h-4" />
                      Enter a prompt below to search your saved content using
                      AI.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((r) => (
                        <div
                          key={r.id}
                          className={`p-3 rounded border transition-all
                            ${
                              theme === "dark"
                                ? "bg-gray-800 border-gray-700 hover:border-primary-500"
                                : "bg-gray-50 border-gray-200 hover:border-primary-500"
                            }`}>
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`block font-medium truncate flex-1 ${
                                theme === "dark"
                                  ? "text-gray-200"
                                  : "text-gray-900"
                              }`}>
                              {r.title || r.url}
                            </a>
                            <div className="flex items-center gap-1 shrink-0">
                              {r.source === "semantic" ? (
                                <div className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  AI Match
                                </div>
                              ) : r.source === "fuzzy" ? (
                                <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  Close Match
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-xs mt-2 text-gray-500 dark:text-gray-400 line-clamp-2">
                            {r.content_text
                              ? r.content_text.substring(0, 140) + "..."
                              : ""}
                          </p>
                          <div className="text-xs text-gray-400 mt-2">
                            {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Input Area - Bottom Fixed */}
                <div className="mt-4 border-t pt-4 dark:border-gray-800">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-primary-500" />
                        <label
                          className={`block text-xs font-medium ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}>
                          Search Content
                        </label>
                      </div>
                      {searchMethod && (
                        <span className="text-xs flex items-center gap-1">
                          <Sparkles
                            className={`w-3 h-3 ${
                              theme === "dark"
                                ? "text-gray-400"
                                : "text-gray-500"
                            }`}
                          />
                          <span
                            className={
                              theme === "dark"
                                ? "text-gray-400"
                                : "text-gray-500"
                            }>
                            {searchMethod === "semantic"
                              ? "AI-Powered"
                              : searchMethod === "fuzzy"
                              ? "Fuzzy Match"
                              : "Basic"}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Segment Filter Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {SEGMENT_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setSelectedSearchSegments((current) =>
                              current.includes(type)
                                ? current.filter((t) => t !== type)
                                : [...current, type]
                            );
                          }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all
                            ${
                              selectedSearchSegments.includes(type)
                                ? theme === "dark"
                                  ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                                  : "bg-primary-50 text-primary-700 border border-primary-200"
                                : theme === "dark"
                                ? "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                                : "bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300"
                            }`}>
                          {React.createElement(SEGMENT_ICONS[type], {
                            className: "w-3 h-3",
                          })}
                          <span className="hidden sm:inline">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="flex gap-2 mt-3">
                    <div className="relative flex-1">
                      <input
                        value={searchPrompt}
                        onChange={(e) => setSearchPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") runPromptSearch();
                        }}
                        className={`w-full pl-10 pr-3 py-2 rounded border bg-transparent text-sm
                          ${
                            theme === "dark"
                              ? "border-gray-700 focus:border-primary-500 text-gray-100"
                              : "border-gray-300 focus:border-primary-500 text-gray-900"
                          }
                          focus:ring-1 focus:ring-primary-500 focus:outline-none
                          placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                        placeholder="Ask anything about your content..."
                      />
                      <Brain className="w-4 h-4 absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <button
                      onClick={runPromptSearch}
                      disabled={searching}
                      className={`px-4 py-2 rounded font-medium text-sm transition-all
                        ${
                          searching
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-500"
                            : "bg-primary-600 hover:bg-primary-700 text-white"
                        }`}>
                      {searching ? "Searching..." : "Search"}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
