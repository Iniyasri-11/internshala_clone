import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { api } from "@/utils/api";
import { Heart, MessageSquare, Share2, Sparkles, Bell, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "react-toastify";

interface MediaFile {
  file: File;
  preview: string;
}

const CommunityPage = () => {
  const user = useSelector(selectuser);
  const [text, setText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [trendPosts, setTrendPosts] = useState<any[]>([]);
  const [limitData, setLimitData] = useState<any>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, { up: number; down: number; user?: "up" | "down" | null }>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [shareTarget, setShareTarget] = useState<{ postId: string; url: string } | null>(null);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reportText, setReportText] = useState<Record<string, string>>({});
  const [openPanel, setOpenPanel] = useState<{ type: 'share' | 'report' | 'comments' | null; postId: string | null }>({ type: null, postId: null });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<any>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

  const fetchFeed = async () => {
    try {
      const response = await api.get("/social/posts?sort=newest&limit=12");
      const raw = response.data.data || [];
      const normalized = raw.map((p: any) => ({
        ...p,
        comments: (p.comments || []).map((c: any) => ({
          ...c,
          upCount: c.upCount || 0,
          downCount: c.downCount || 0,
          reactedBy: c.reactedBy || [],
        })),
      }));
      setPosts(normalized);
    } catch (error) {
      console.error("Feed load error", error);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await api.get("/social/posts?sort=trending&limit=5");
      const raw = response.data.data || [];
      const normalized = raw.map((p: any) => ({
        ...p,
        comments: (p.comments || []).map((c: any) => ({
          ...c,
          upCount: c.upCount || 0,
          downCount: c.downCount || 0,
          reactedBy: c.reactedBy || [],
        })),
      }));
      setTrendPosts(normalized);
    } catch (error) {
      console.error("Trending load error", error);
    }
  };

  const fetchLimit = async () => {
    if (!user?.uid) {
      console.warn("No user UID available to fetch limit.");
      return;
    }
    const paths = [`/users/${user.uid}/limit`, `/users/limit/${user.uid}`];
    for (const path of paths) {
      try {
        const res = await api.get(path);
        setLimitData(res.data);
        return;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          continue;
        }
        console.error("Limit error", error?.response?.data || error.message || error);
        return;
      }
    }
    console.warn("Community limit route not found for user", user.uid);
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/social/notifications/${user.uid}`);
      setNotifications(res.data || []);
    } catch (error) {
      console.error("Notification error", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    const initializeCommunity = async () => {
      setLoading(true);
      try {
        const syncPayload = {
          uid: user.uid,
          name: user.name,
          email: user.email,
          photo: user.photo,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
        };
        await api.post("/users/sync", { user: syncPayload });
        await Promise.all([fetchFeed(), fetchTrending(), fetchLimit(), fetchNotifications()]);
      } catch (error) {
        console.error("Initialize community error", error);
      } finally {
        setLoading(false);
      }
    };
    initializeCommunity();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const socket = io(baseUrl.replace(/\/api$/, ""), {
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("join", user.uid);
    });
    socket.on("postCreated", fetchFeed);
    socket.on("postUpdated", fetchFeed);
    socket.on("postLiked", fetchFeed);
    socket.on("postCommented", fetchFeed);
    socket.on("postShared", fetchFeed);
    socket.on("notification", (notice: any) => {
      setNotifications((prev) => [notice, ...prev]);
    });
    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const nextFiles: MediaFile[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!/\.(jpg|jpeg|png|gif|mp4|webm|ogg)$/i.test(file.name)) continue;
      nextFiles.push({ file, preview: URL.createObjectURL(file) });
    }
    setMediaFiles(nextFiles);
  };

  const handleCreatePost = async () => {
    if (!user) return;
    if (!limitData) {
      toast.error("Checking posting limits. Please wait.");
      return;
    }
    if (limitData.limit === 0) {
      toast.error("You need at least one friend before posting in the public feed.");
      return;
    }
    if (limitData.limit !== Infinity && limitData.remaining <= 0) {
      toast.error("You have reached today’s post limit. Build more connections to post again.");
      return;
    }
    if (!text.trim() && mediaFiles.length === 0) {
      toast.error("Write a post or upload a photo/video before posting.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("user", JSON.stringify(user));
      formData.append("text", text);
      formData.append("hashtags", hashtags);
      mediaFiles.forEach((item) => formData.append("media", item.file));
      const response = await api.post("/social/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percent);
        },
      });
      setText("");
      setHashtags("");
      setMediaFiles([]);
      setUploadProgress(0);
      await fetchFeed();
      await fetchLimit();
      toast.success("Your post was shared successfully.");
    } catch (error: any) {
      console.error("Create post failed", error);
      toast.error("Unable to share your post right now.");
    }
  };

  const setActionBusy = (postId: string, busy: boolean) => {
    setActionLoading((prev) => ({ ...prev, [postId]: busy }));
  };

  const [likeAnim, setLikeAnim] = useState<Record<string, boolean>>({});

  const handleLike = async (postId: string) => {
    if (!user) return;
    try {
      setActionBusy(postId, true);
      // small animation
      setLikeAnim((p) => ({ ...p, [postId]: true }));
      const response = await api.post(`/social/posts/${postId}/like`, { user: JSON.stringify(user) });
      const updatedPost = response.data;
      setPosts((prev) => prev.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
      toast.success("Post liked");
      setTimeout(() => setLikeAnim((p) => ({ ...p, [postId]: false })), 300);
    } catch (error) {
      console.error("Like failed", error);
      toast.error("Unable to like post.");
    } finally {
      setActionBusy(postId, false);
    }
  };

  const handleCommentReact = async (postId: string, commentId: string, type: 'up' | 'down') => {
    if (!user) return;
    try {
      setActionBusy(postId, true);
      const resp = await api.post(`/social/posts/${postId}/comments/${commentId}/react`, { user: JSON.stringify(user), type });
      const updatedPost = resp.data;
      setPosts((prev) => prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
    } catch (err: any) {
      console.error('React failed', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Unable to react to comment';
      toast.error(msg);
    } finally {
      setActionBusy(postId, false);
    }
  };

  const handleComment = async (postId: string) => {
    if (!user) return;
    const textValue = commentText[postId]?.trim();
    if (!textValue) return;
    try {
      setActionBusy(postId, true);
      const response = await api.post(`/social/posts/${postId}/comment`, { user: JSON.stringify(user), text: textValue });
      const updatedPost = response.data;
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) => prev.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
      toast.success("Comment posted");
    } catch (error) {
      console.error("Comment failed", error);
      toast.error("Unable to post comment.");
    } finally {
      setActionBusy(postId, false);
    }
  };

  const getPostShareUrl = (postId: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/community?post=${postId}`;
  };

  const openPanelFor = (postId: string, type: 'share' | 'report' | 'comments') => {
    // ensure only one panel is open at a time globally
    setOpenPanel({ type, postId });
    // sync individual states
    if (type === 'share') {
      const shareUrl = getPostShareUrl(postId);
      setShareTarget({ postId, url: shareUrl });
      setReportOpen(null);
      setCommentsOpen({});
    } else if (type === 'report') {
      setReportOpen(postId);
      setShareTarget(null);
      setCommentsOpen((prev) => {
        const keys = Object.keys(prev || {});
        const newState: Record<string, boolean> = {};
        keys.forEach((k) => { newState[k] = false; });
        return newState;
      });
    } else if (type === 'comments') {
      // toggle comments for this post but close others
      setCommentsOpen((prev) => {
        const keys = Object.keys(prev || {});
        const newState: Record<string, boolean> = {};
        keys.forEach((k) => { newState[k] = k === postId ? !prev[k] : false; });
        if (!keys.includes(postId)) newState[postId] = true;
        return newState;
      });
      setReportOpen(null);
      setShareTarget(null);
    }
  };

  const closeAllPanels = () => {
    setOpenPanel({ type: null, postId: null });
    setReportOpen(null);
    setShareTarget(null);
    setCommentsOpen({});
  };

  const handleShare = async (postId: string) => {
    if (!user) return;
    try {
      setActionBusy(postId, true);
      const response = await api.post(`/social/posts/${postId}/share`, { user: JSON.stringify(user) });
      const updatedPost = response.data;
      setPosts((prev) => prev.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
      openPanelFor(postId, 'share');
      toast.success("Post shared. Link ready to copy.");
    } catch (error) {
      console.error("Share failed", error);
      toast.error("Unable to share post.");
    } finally {
      setActionBusy(postId, false);
    }
  };

  const handleReport = async (postId: string) => {
    if (!user) return;
    try {
      setActionBusy(postId, true);
      // fallback: if called directly, use a default reason
      await api.post(`/social/posts/${postId}/report`, { user: JSON.stringify(user), reason: "Inappropriate content" });
      toast.success("Post reported");
      await fetchFeed();
    } catch (error) {
      console.error("Report failed", error);
      toast.error("Unable to report post.");
    } finally {
      setActionBusy(postId, false);
    }
  };

  const submitReport = async (postId: string) => {
    if (!user) return;
    const reason = (reportText[postId] || "").trim() || "Inappropriate content";
    try {
      setActionBusy(postId, true);
      await api.post(`/social/posts/${postId}/report`, { user: JSON.stringify(user), reason });
      toast.success("Report submitted");
      closeAllPanels();
      setReportText((prev) => ({ ...prev, [postId]: "" }));
      await fetchFeed();
    } catch (error) {
      console.error("Submit report failed", error);
      toast.error("Unable to submit report.");
    } finally {
      setActionBusy(postId, false);
    }
  };

  const remainingText = useMemo(() => {
    if (!limitData) return "Checking your posting limits...";
    if (limitData.limit === 0) return "Need friends before posting";
    if (limitData.limit === Infinity) return "Unlimited posts available";
    return `${limitData.remaining} of ${limitData.limit} posts left today`;
  }, [limitData]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full rounded-3xl bg-white p-10 shadow-lg text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Join the community</h1>
          <p className="mt-3 text-gray-600">
            Sign in with Google to share posts, connect with peers, and engage in the public feed.
          </p>
          <a
            href="/"
            className="mt-8 inline-block rounded-full bg-blue-600 px-6 py-3 text-white shadow hover:bg-blue-700"
          >
            Go sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Public Space</h1>
                  <p className="text-sm text-gray-500">Share updates, photos, videos and join the conversation.</p>
                </div>
                <div className="rounded-2xl bg-blue-50 px-4 py-2 text-blue-700 text-sm">
                  {remainingText}
                </div>
              </div>
              <div className="space-y-4">
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Share something with the community..."
                  className="w-full rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex-1 rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition">
                      <span className="cursor-pointer">Upload images/videos</span>
                      <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleMediaChange} />
                    </label>
                    <input
                      type="text"
                      className="flex-1 rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add hashtags, separated by commas"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleCreatePost}
                      disabled={!limitData || limitData.limit === 0 || (limitData.limit !== Infinity && limitData.remaining <= 0)}
                      className="rounded-3xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-700 disabled:cursor-not-allowed"
                    >
                      Share update
                    </button>
                  </div>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="rounded-full bg-gray-200 h-2.5 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {mediaFiles.map((file) => (
                        <div key={file.preview} className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
                          {file.file.type.startsWith("video") ? (
                            <video controls src={file.preview} className="h-40 w-full object-cover" />
                          ) : (
                            <img src={file.preview} alt="preview" className="h-40 w-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl bg-white p-8 shadow-sm">Loading posts...</div>
            ) : (
              posts.map((post) => (
                <div key={post._id} id={`post-${post._id}`} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <img
                      src={post.author.photo || "/logo.png"}
                      alt={post.author.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">{post.author.name}</h2>
                          <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-gray-700 whitespace-pre-line">{post.text}</p>
                      {post.hashtags?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {post.hashtags.map((tag: string) => (
                            <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {post.media?.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {post.media.map((item: any) => (
                            <div key={item.url} className="overflow-hidden rounded-3xl bg-gray-100">
                              {item.type === "video" ? (
                                <video controls src={item.url} className="h-48 w-full object-cover" />
                              ) : (
                                <img src={item.url} alt="post media" className="h-48 w-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                        {(() => {
                          const isLiked = !!post.likes?.find((l: any) => l.uid === user?.uid);
                          return (
                            <button
                              type="button"
                              onClick={() => { void handleLike(post._id); }}
                              disabled={!!actionLoading[post._id]}
                              aria-label={isLiked ? 'Unlike' : 'Like'}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${isLiked ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                              <span>{post.likes?.length || 0}</span>
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => { void handleShare(post._id); }}
                          disabled={!!actionLoading[post._id]}
                          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Share2 className="h-4 w-4" />
                          <span>{post.shareCount || 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openPanelFor(post._id, 'comments')}
                          className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>{post.comments?.length || 0}</span>
                        </button>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPanelFor(post._id, 'report')}
                            disabled={!!actionLoading[post._id]}
                            aria-label="Report post"
                            className="inline-flex items-center justify-center rounded-full w-9 h-9 bg-red-100 text-red-600 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Report this post"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 3 7.02944 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/></svg>
                          </button>
                        </div>
                      </div>
                      {reportOpen === post._id && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <div className="mb-3 text-sm font-semibold text-red-800">Report this post</div>
                          <textarea
                            rows={3}
                            value={reportText[post._id] || ""}
                            onChange={(e) => setReportText((prev) => ({ ...prev, [post._id]: e.target.value }))}
                            placeholder="Describe the issue you're reporting..."
                            className="w-full rounded-lg border border-red-200 bg-white p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                          <div className="mt-3 flex gap-2 justify-end">
                            <button type="button" onClick={() => closeAllPanels()} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => submitReport(post._id)}
                              disabled={!!actionLoading[post._id]}
                              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}
                      {shareTarget?.postId === post._id && (
                        <div className="mt-4 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                          <div className="mb-2 font-semibold">Share this post</div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={shareTarget?.url || ""}
                              readOnly
                              className="flex-1 rounded-3xl border border-blue-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (shareTarget?.url) {
                                  navigator.clipboard.writeText(shareTarget.url);
                                  toast.success("Link copied to clipboard.");
                                }
                              }}
                              className="rounded-3xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              Copy link
                            </button>
                          </div>
                        </div>
                      )}
                      {commentsOpen[post._id] && (
                        <>
                          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-3 text-sm font-semibold text-gray-900">Add a comment</div>
                            <textarea
                              rows={2}
                              value={commentText[post._id] || ""}
                              onChange={(e) => setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))}
                              placeholder="Write a reply..."
                              className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <div className="mt-3 flex justify-between items-center gap-3">
                              <span className="text-xs text-gray-600 font-medium">{post.comments?.length || 0} comment{post.comments?.length === 1 ? '' : 's'}</span>
                              <button
                                type="button"
                                onClick={() => handleComment(post._id)}
                                disabled={!!actionLoading[post._id]}
                                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Post
                              </button>
                            </div>
                          </div>

                          {post.comments?.length > 0 && (
                            <div className="mt-4 space-y-3 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                              <div className="text-sm font-semibold text-gray-900">Comments</div>
                              {post.comments.filter((c: any) => !c.parentId).map((comment: any) => {
                                const up = comment.upCount || 0;
                                const down = comment.downCount || 0;
                                const userReaction = comment.reactedBy?.find((r: any) => r.uid === user?.uid)?.type || null;
                                const replies = post.comments.filter((c: any) => c.parentId === comment._id);
                                return (
                                  <div key={comment._id || `${comment.author.uid}-${comment.createdAt}`} className="rounded-3xl bg-white p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                      <img src={comment.author.photo || "/logo.png"} alt={comment.author.name} className="h-8 w-8 rounded-full object-cover" />
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-sm font-semibold text-gray-900">{comment.author.name}</p>
                                            <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                                          </div>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{comment.text}</p>
                                        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                                          <button
                                            type="button"
                                            onClick={() => { void handleCommentReact(post._id, comment._id, 'up').catch((e) => console.error(e)); }}
                                            disabled={!!actionLoading[post._id]}
                                            aria-pressed={userReaction === 'up'}
                                            className={`inline-flex items-center gap-2 text-xs ${userReaction === 'up' ? 'text-blue-600' : 'text-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                          >
                                            <ThumbsUp className="h-4 w-4" /> <span>{up}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { void handleCommentReact(post._id, comment._id, 'down').catch((e) => console.error(e)); }}
                                            disabled={!!actionLoading[post._id]}
                                            aria-pressed={userReaction === 'down'}
                                            className={`inline-flex items-center gap-2 text-xs ${userReaction === 'down' ? 'text-blue-600' : 'text-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                          >
                                            <ThumbsDown className="h-4 w-4" /> <span>{down}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setReplyText((p) => ({ ...p, [comment._id]: p[comment._id] || "" }))}
                                            className="text-xs text-blue-600"
                                          >
                                            Reply
                                          </button>
                                        </div>

                                        {/* reply input */}
                                        {replyText[comment._id] !== undefined && (
                                          <div className="mt-3">
                                            <textarea
                                              rows={2}
                                              value={replyText[comment._id] || ""}
                                              onChange={(e) => setReplyText((p) => ({ ...p, [comment._id]: e.target.value }))}
                                              placeholder={`Reply to ${comment.author.name}`}
                                              className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:outline-none"
                                            />
                                            <div className="mt-2 flex justify-end gap-2">
                                              <button type="button" onClick={() => setReplyText((p) => ({ ...p, [comment._id]: undefined }))} className="rounded-3xl border border-gray-200 px-3 py-1 text-sm">Cancel</button>
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  if (!user) return;
                                                  const txt = (replyText[comment._id] || "").trim();
                                                  if (!txt) return;
                                                  try {
                                                    setActionBusy(post._id, true);
                                                    const resp = await api.post(`/social/posts/${post._id}/comment`, { user: JSON.stringify(user), text: txt, parentId: comment._id });
                                                    const updatedPost = resp.data;
                                                    setPosts((prev) => prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
                                                    setReplyText((p) => ({ ...p, [comment._id]: undefined }));
                                                    toast.success("Reply posted");
                                                  } catch (err) {
                                                    console.error(err);
                                                    toast.error("Unable to post reply");
                                                  } finally {
                                                    setActionBusy(post._id, false);
                                                  }
                                                }}
                                                className="rounded-3xl bg-blue-600 px-3 py-1 text-sm text-white"
                                              >
                                                Reply
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* replies */}
                                        {replies.length > 0 && (
                                          <div className="mt-3 space-y-2 pl-10">
                                            {replies.map((r: any) => (
                                              <div key={r._id} className="rounded-2xl bg-gray-50 p-3">
                                                <div className="flex items-start gap-3">
                                                  <img src={r.author.photo || "/logo.png"} alt={r.author.name} className="h-6 w-6 rounded-full object-cover" />
                                                  <div>
                                                    <p className="text-sm font-semibold text-gray-900">{r.author.name} <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</span></p>
                                                    <p className="mt-1 text-sm text-gray-700">{r.text}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              </div>
              <div className="mt-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notice) => (
                    <div key={notice._id} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-sm text-gray-800">{notice.message}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(notice.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-pink-600" />
                <h2 className="text-lg font-semibold text-gray-900">Trending posts</h2>
              </div>
              <div className="mt-4 space-y-3">
                {trendPosts.map((trend) => (
                  <div key={trend._id} className="rounded-3xl border border-gray-100 p-4">
                    <p className="text-sm font-semibold text-gray-900">{trend.author.name}</p>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{trend.text}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{trend.likes?.length || 0} likes</span>
                      <span>{trend.comments?.length || 0} comments</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
