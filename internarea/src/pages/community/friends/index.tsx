import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Link from "next/link";
import { Bell, MessageSquare, X, Check } from "lucide-react";
import { api } from "@/utils/api";
import { selectuser } from "@/Feature/Userslice";
import { toast } from "react-toastify";
import { useLanguage } from "@/context/LanguageContext";

const FriendsPage = () => {
  const { t } = useLanguage();
  const user = useSelector(selectuser);
  const [friends, setFriends] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatHistory, setChatHistory] = useState<Record<string, Array<{ sender: string; text: string; time: string }>>>({});
  const [requestActionLoading, setRequestActionLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"friends" | "incoming" | "outgoing" | "suggestions">("friends");

  useEffect(() => {
    const fetchFriendsAndPosts = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
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
        const userRes = await api.post("/users/sync", { user: syncPayload });
        const dbUser = userRes.data.user || userRes.data;
        const friendList = dbUser?.friends || [];
        setFriends(friendList);

        const requestsRes = await api.get(`/users/requests/${user.uid}`);
        const requestsData = requestsRes.data;
        setIncomingRequests(requestsData?.incoming || requestsData?.incomingRequests || requestsData || []);
        setOutgoingRequests(requestsData?.outgoing || []);

        const suggestionsRes = await api.get(`/users/suggestions/${user.uid}`);
        setSuggestions(suggestionsRes.data || []);

        const postsRes = await api.get("/social/posts?sort=newest&limit=100");
        const allPosts = postsRes.data?.data || [];
        const friendIds = new Set(friendList.map((friend: any) => friend.uid));
        const filteredPosts = allPosts.filter((post: any) => friendIds.has(post.author?.uid));
        setPosts(filteredPosts);
      } catch (err: any) {
        console.error(err);
        setError("Unable to load friends, requests, or posts at this time.");
      } finally {
        setLoading(false);
      }
    };
    void fetchFriendsAndPosts();
  }, [user]);

  const filteredFriends = friends.filter((friend) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (friend.name || "").toLowerCase().includes(query) || (friend.email || "").toLowerCase().includes(query);
  });

  const filteredIncomingRequests = incomingRequests.filter((request) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (request.name || "").toLowerCase().includes(query) || (request.email || "").toLowerCase().includes(query);
  });

  const filteredOutgoingRequests = outgoingRequests.filter((request) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (request.name || "").toLowerCase().includes(query) || (request.email || "").toLowerCase().includes(query);
  });

  const filteredSuggestions = suggestions.filter((friend) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (friend.name || "").toLowerCase().includes(query) || (friend.email || "").toLowerCase().includes(query);
  });

  const hasPendingRequests = incomingRequests.length > 0;
  const selectedFriendKey = selectedFriend ? selectedFriend.uid || selectedFriend._id || selectedFriend.email : "";

  const handleSelectFriend = (friend: any) => {
    setSelectedFriend(friend);
    setMessageText("");
  };

  const handleSendMessage = () => {
    if (!selectedFriend || !messageText.trim()) {
      toast.error("Select a friend and type a message.");
      return;
    }

    const key = selectedFriend.uid || selectedFriend._id || selectedFriend.email;
    const nextMessage = {
      sender: "me",
      text: messageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), nextMessage],
    }));
    setMessageText("");
    toast.success(`Message sent to ${selectedFriend.name || selectedFriend.email}`);
  };

  const handleSendRequest = async (friendUid: string) => {
    if (!user) return;
    setRequestLoading(friendUid, true);
    try {
      await api.post("/users/friend-requests", { uid: user.uid, friendUid });
      toast.success("Friend request sent.");
      const [requestsRes, suggestionsRes] = await Promise.all([
        api.get(`/users/requests/${user.uid}`),
        api.get(`/users/suggestions/${user.uid}`),
      ]);
      const requestsData = requestsRes.data;
      setIncomingRequests(requestsData?.incoming || requestsData?.incomingRequests || requestsData || []);
      setOutgoingRequests(requestsData?.outgoing || []);
      setSuggestions(suggestionsRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Unable to send friend request.");
    } finally {
      setRequestLoading(friendUid, false);
    }
  };

  const setRequestLoading = (key: string, value: boolean) => {
    setRequestActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const handleAcceptRequest = async (requesterUid: string) => {
    if (!user) return;
    setRequestLoading(requesterUid, true);
    try {
      await api.post("/users/friend-requests/accept", { uid: user.uid, requesterUid });
      toast.success("Friend request accepted.");
      const responses = await Promise.all([
        api.post("/users/sync", { user }),
        api.get(`/users/requests/${user.uid}`),
      ]);
      const dbUser = responses[0].data.user || responses[0].data;
      setFriends(dbUser?.friends || []);
      const requestsData = responses[1].data;
      setIncomingRequests(requestsData?.incoming || requestsData || []);
      setOutgoingRequests(requestsData?.outgoing || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to accept request.");
    } finally {
      setRequestLoading(requesterUid, false);
    }
  };

  const handleRejectRequest = async (requesterUid: string) => {
    if (!user) return;
    setRequestLoading(requesterUid, true);
    try {
      await api.post("/users/friend-requests/reject", { uid: user.uid, requesterUid });
      toast.success("Friend request rejected.");
      const requestsRes = await api.get(`/users/requests/${user.uid}`);
      const requestsData = requestsRes.data;
      setIncomingRequests(requestsData?.incoming || requestsData || []);
      setOutgoingRequests(requestsData?.outgoing || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to reject request.");
    } finally {
      setRequestLoading(requesterUid, false);
    }
  };

  const handleCancelRequest = async (friendUid: string) => {
    if (!user) return;
    setRequestLoading(friendUid, true);
    try {
      await api.post("/users/friend-requests/cancel", { uid: user.uid, friendUid });
      toast.success("Friend request canceled.");
      const [requestsRes, suggestionsRes] = await Promise.all([
        api.get(`/users/requests/${user.uid}`),
        api.get(`/users/suggestions/${user.uid}`),
      ]);
      const requestsData = requestsRes.data;
      setIncomingRequests(requestsData?.incoming || requestsData || []);
      setOutgoingRequests(requestsData?.outgoing || []);
      setSuggestions(suggestionsRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Unable to cancel request.");
    } finally {
      setRequestLoading(friendUid, false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-20 text-center">
        <div className="max-w-xl rounded-3xl bg-white p-10 text-center shadow-lg">
          <h1 className="text-2xl font-semibold text-gray-900">Sign in to view your friends</h1>
          <p className="mt-4 text-gray-600">Please sign in from the homepage to see your friends and their posts.</p>
          <Link href="/" className="mt-8 inline-flex rounded-full bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 text-left">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("community.friends_hub")}</h1>
            <p className="mt-2 text-gray-600">Manage your connections, view requests, and message friends directly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/community" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 border border-gray-205 hover:bg-gray-50 transition shadow-sm">
              {t("community.community_hub")}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          {/* Main pane (left column) */}
          <section className="space-y-6">
            {selectedFriend ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
                <div className="pb-4 border-b border-gray-150 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedFriend.photo || "/logo.png"}
                      alt={selectedFriend.name || selectedFriend.email}
                      className="w-12 h-12 rounded-full object-cover border border-gray-150"
                    />
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedFriend.name || selectedFriend.email}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedFriend.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
                    title={t("auth.close")}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Messages Panel */}
                <div className="my-6 min-h-[350px] max-h-[450px] overflow-y-auto space-y-4 pr-2 flex flex-col">
                  {(() => {
                    const key = selectedFriend.uid || selectedFriend._id || selectedFriend.email;
                    const messages = chatHistory[key] || [];
                    if (messages.length === 0) {
                      return (
                        <div className="my-auto flex flex-col items-center justify-center text-gray-400 gap-2.5 py-12">
                          <MessageSquare className="h-10 w-10 text-gray-300" />
                          <p className="text-sm font-medium">No messages yet. Send a message to start chatting!</p>
                        </div>
                      );
                    }
                    return messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[70%] ${msg.sender === "me" ? "ml-auto items-end" : "mr-auto items-start"}`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.sender === "me"
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-gray-100 text-gray-800 rounded-tl-none border border-gray-150"
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Chat Input */}
                <div className="pt-4 border-t border-gray-150 flex gap-3">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessage();
                    }}
                    placeholder={`Type a message to ${selectedFriend.name || "friend"}...`}
                    className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                  >
                    {t("community.send")}
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Friends' Posts Card */
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{t("community.friends_posts")}</h2>
                    <p className="mt-1 text-sm text-gray-500">{t("community.friends_posts_desc")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasPendingRequests ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 border border-red-100">
                        <Bell className="h-4 w-4" />
                        <span>{incomingRequests.length} pending request{incomingRequests.length === 1 ? "" : "s"}</span>
                      </div>
                    ) : null}
                    <div className="text-sm text-gray-500">{loading ? "Loading..." : `${posts.length} post${posts.length === 1 ? "" : "s"}`}</div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
                ) : loading ? (
                  <div className="mt-6 text-gray-500">Loading posts...</div>
                ) : posts.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                    {t("community.no_friends_posts")}
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    {posts.map((post) => (
                      <article key={post._id} className="rounded-3xl border border-gray-150 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 border">
                            <img src={post.author?.photo || "/logo.png"} alt={post.author?.name || "Author"} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{post.author?.name || "Unknown"}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</p>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.text || "No text content."}</p>
                            {post.media?.length > 0 && (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {post.media.map((item: any, idx: number) => (
                                  <div key={idx} className="overflow-hidden rounded-3xl bg-slate-100 border border-gray-150">
                                    {item.type === "video" ? (
                                      <video controls src={item.url} className="h-48 w-full object-cover" />
                                    ) : (
                                      <img src={item.url} alt="post media" className="h-48 w-full object-cover" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Sidebar connections manager (right column) */}
          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{t("community.connections")}</p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900">{t("community.friends_hub")}</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700">
                  <span>{friends.length}</span>
                  <span>{t("community.friends")}</span>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  { key: "friends", label: t("community.friends"), count: filteredFriends.length },
                  { key: "incoming", label: t("community.incoming"), count: filteredIncomingRequests.length },
                  { key: "outgoing", label: t("community.outgoing"), count: filteredOutgoingRequests.length },
                  { key: "suggestions", label: t("community.suggestions"), count: filteredSuggestions.length },
                ].map((tabItem) => (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setActiveTab(tabItem.key as any)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition cursor-pointer border ${
                      activeTab === tabItem.key
                        ? "bg-blue-600 text-white shadow-md border-blue-600 font-bold"
                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        {tabItem.label}
                        {tabItem.key === "incoming" && hasPendingRequests ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        ) : null}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        activeTab === tabItem.key ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                      }`}>{tabItem.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900">
                    {activeTab === "friends" ? t("community.your_friends") : activeTab === "incoming" ? t("community.incoming_requests") : activeTab === "outgoing" ? t("community.outgoing_requests") : t("community.suggested_connections")}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    {activeTab === "friends"
                      ? "Search friends and start a conversation."
                      : activeTab === "incoming"
                      ? "Approve or reject connection requests."
                      : activeTab === "outgoing"
                      ? "Requests you've sent are listed here."
                      : "People you might know and want to connect with."}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("community.search_friends")}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="mt-6 space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {activeTab === "friends" && (
                  <>
                    {filteredFriends.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                        {friends.length === 0 ? "You have no friends yet." : "No friends match your search."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredFriends.map((friend) => {
                          const key = friend.uid || friend._id || friend.email;
                          const isChatActive = selectedFriendKey === key;
                          return (
                            <div
                              key={key}
                              className={`rounded-2xl border p-4 transition duration-150 ${
                                isChatActive ? "border-blue-500 bg-blue-50/15" : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-left min-w-0">
                                  <img src={friend.photo || "/logo.png"} alt={friend.name || friend.email} className="h-10 w-10 rounded-full object-cover border" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{friend.name || friend.email}</p>
                                    <p className="text-xs text-gray-500 truncate">{friend.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectFriend(friend)}
                                  className={`rounded-full px-4 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                    isChatActive
                                      ? "bg-blue-600 text-white hover:bg-blue-700"
                                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  }`}
                                >
                                  {isChatActive ? "Chatting" : "Message"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "incoming" && (
                  <>
                    {filteredIncomingRequests.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                        {incomingRequests.length === 0 ? t("community.no_incoming") : "No incoming requests match your search."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredIncomingRequests.map((request) => {
                          const key = request.uid || request._id || request.email;
                          return (
                            <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-left min-w-0">
                                  <img src={request.photo || "/logo.png"} alt={request.name || request.email} className="h-10 w-10 rounded-full object-cover border border-gray-100" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{request.name || request.email}</p>
                                    <p className="text-xs text-gray-500 truncate">{request.email}</p>
                                  </div>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptRequest(request.uid)}
                                    disabled={!!requestActionLoading[key]}
                                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition cursor-pointer disabled:opacity-50"
                                    title={t("community.accept_button")}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectRequest(request.uid)}
                                    disabled={!!requestActionLoading[key]}
                                    className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full transition cursor-pointer disabled:opacity-50"
                                    title={t("community.reject_button")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "outgoing" && (
                  <>
                    {filteredOutgoingRequests.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                        {outgoingRequests.length === 0 ? t("community.no_outgoing") : "No outgoing requests match your search."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredOutgoingRequests.map((request) => {
                          const key = request.uid || request._id || request.email;
                          return (
                            <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-left min-w-0">
                                  <img src={request.photo || "/logo.png"} alt={request.name || request.email} className="h-10 w-10 rounded-full object-cover border border-gray-100" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{request.name || request.email}</p>
                                    <p className="text-xs text-gray-500 truncate">{request.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-100">Sent</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelRequest(request.uid)}
                                    disabled={!!requestActionLoading[key]}
                                    className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full transition cursor-pointer disabled:opacity-50"
                                    title="Cancel request"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "suggestions" && (
                  <>
                    {filteredSuggestions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                        {t("community.no_suggestions")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredSuggestions.map((suggested) => {
                          const key = suggested.uid || suggested._id || suggested.email;
                          const isConnected = suggested.isFriend;
                          const isRequested = suggested.hasOutgoingRequest || suggested.hasIncomingRequest;
                          return (
                            <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-left min-w-0">
                                  <img src={suggested.photo || "/logo.png"} alt={suggested.name || suggested.email} className="h-10 w-10 rounded-full object-cover border border-gray-100" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{suggested.name || suggested.email}</p>
                                    <p className="text-xs text-gray-500 truncate">{suggested.email}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSendRequest(suggested.uid)}
                                  disabled={isConnected || isRequested}
                                  className={`rounded-full px-5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                    isConnected
                                      ? "bg-gray-200 text-gray-500 cursor-default"
                                      : isRequested
                                      ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                      : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                >
                                  {isConnected ? "Connected" : isRequested ? "Sent" : t("community.connect_button")}
                                </button>
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
          </aside>
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
