import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const SEGMENT_TYPES = ['Images', 'Products', 'Books', 'Articles', 'Videos', 'Study'];
const SEGMENT_ICONS = {
  Images: '🖼️',
  Products: '🛍️',
  Books: '📚',
  Articles: '📄',
  Videos: '🎥',
  Study: '📖'
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [content, setContent] = useState({});
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('synapse_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [userResponse, contentResponse] = await Promise.all([
        fetch('/api/user/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/content', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
      } else {
        router.push('/login');
        return;
      }

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        setStats(contentData.stats);
        
        // Group content by segment type
        const grouped = {};
        SEGMENT_TYPES.forEach(type => {
          grouped[type] = [];
        });
        
        contentData.content.forEach(item => {
          if (grouped[item.segment_type]) {
            grouped[item.segment_type].push(item);
          }
        });
        
        setContent(grouped);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('synapse_token');
    localStorage.removeItem('synapse_user');
    router.push('/login');
  }

  function getCount(type) {
    const stat = stats.find(s => s.segment_type === type);
    return stat ? stat.count : 0;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Synapse</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.name || user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Second Brain</h2>
          <p className="text-gray-600">All your captured content organized by type</p>
        </div>

        {/* Segment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {SEGMENT_TYPES.map(type => (
            <div
              key={type}
              onClick={() => setSelectedSegment(selectedSegment === type ? null : type)}
              className={`bg-white rounded-xl shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedSegment === type ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">{SEGMENT_ICONS[type]}</div>
                <div className="text-3xl font-bold text-primary-600">{getCount(type)}</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{type}</h3>
              <p className="text-sm text-gray-500 mt-2">
                {selectedSegment === type ? 'Click to collapse' : 'Click to view items'}
              </p>
            </div>
          ))}
        </div>

        {/* Content List */}
        {selectedSegment && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {SEGMENT_ICONS[selectedSegment]} {selectedSegment}
              </h3>
              <span className="text-gray-500">
                {content[selectedSegment]?.length || 0} items
              </span>
            </div>

            {content[selectedSegment] && content[selectedSegment].length > 0 ? (
              <div className="space-y-4">
                {content[selectedSegment].map(item => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {item.title || 'Untitled'}
                        </h4>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 mb-2 block truncate"
                        >
                          {item.url}
                        </a>
                        {item.content_text && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {item.content_text.substring(0, 200)}...
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Saved on {formatDate(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">{SEGMENT_ICONS[selectedSegment]}</div>
                <p className="text-gray-500">No {selectedSegment.toLowerCase()} saved yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Use the browser extension to start capturing content
                </p>
              </div>
            )}
          </div>
        )}

        {!selectedSegment && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🧠</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Select a category to view your content
            </h3>
            <p className="text-gray-500">
              Click on any category card above to see your saved items
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

