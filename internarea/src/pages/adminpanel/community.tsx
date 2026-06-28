import React, { useEffect, useState } from "react";
import { api } from "@/utils/api";
import { ShieldAlert, Trash2 } from "lucide-react";

const AdminCommunity = () => {
  const [reportedPosts, setReportedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReported = async () => {
    setLoading(true);
    try {
      const res = await api.get("/social/reported");
      setReportedPosts(res.data || []);
    } catch (error) {
      console.error("Failed to load reported posts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReported();
  }, []);

  const removePost = async (postId: string) => {
    try {
      await api.delete(`/social/posts/${postId}`);
      fetchReported();
    } catch (error) {
      console.error("Failed to remove post", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-blue-600">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="text-2xl font-semibold text-gray-900">Community Moderation</h1>
          </div>
          <p className="mt-3 text-gray-600">
            Review reported posts, remove inappropriate content, and help keep the community safe.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm">Loading reported posts...</div>
        ) : reportedPosts.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center text-gray-500">
            No reported posts at the moment.
          </div>
        ) : (
          <div className="space-y-6">
            {reportedPosts.map((post) => (
              <div key={post._id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Reported {post.reportCount} times</p>
                    <h2 className="text-lg font-semibold text-gray-900">{post.author.name}</h2>
                    <p className="mt-2 text-sm text-gray-700">{post.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(post.hashtags || []).map((tag: string) => (
                        <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePost(post._id)}
                    className="inline-flex items-center gap-2 rounded-3xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> Remove Post
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCommunity;
