import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { MessageSquare, Send, Loader, ArrowLeft, Search, Plus, X } from 'lucide-react';
import { api } from '@/utils/api';
import io from 'socket.io-client';
import { toast } from 'react-toastify';

interface Conversation {
  partnerId: string;
  partnerPhone?: string;
  partnerName: string;
  partnerEmail?: string;
  partnerPhoto?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  senderPhone?: string;
  recipientPhone?: string;
  content: string;
  timestamp: string;
  read: boolean;
  senderName?: string;
}

interface SearchResult {
  uid: string;
  phone: string;
  email: string;
  name: string;
  photo: string;
}

const MessagesPage = () => {
  const user = useSelector((state: any) => state.user.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (!user) return;

    // Initialize Socket.io
    socketRef.current = io(baseUrl.replace(/\/api$/, ''), {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join', user.uid);
      console.log('✅ Connected to chat server');
    });

    // Handle incoming messages
    socketRef.current.on('message', (newMessage: Message) => {
      if (
        selectedPartner &&
        (newMessage.senderId === selectedPartner.partnerId ||
          newMessage.senderPhone === selectedPartner.partnerPhone)
      ) {
        setMessages((prev) => [...prev, newMessage]);
        markAsRead(selectedPartner.partnerId || selectedPartner.partnerPhone || '');
      }
      fetchConversations();
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, selectedPartner]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await api.get(`/messages/search/${query}`);
      setSearchResults([res.data]);
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const startConversation = (result: SearchResult) => {
    const conversation: Conversation = {
      partnerId: result.uid,
      partnerPhone: result.phone,
      partnerName: result.name,
      partnerEmail: result.email,
      partnerPhoto: result.photo,
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };
    setSelectedPartner(conversation);
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    fetchMessages(result.uid || result.phone);
  };

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/messages/conversations/${user.uid}`);
      setConversations(res.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get(`/messages/conversation/${user.uid}/${partnerId}`);
      setMessages(res.data);
      markAsRead(partnerId);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedPartner || !user) return;

    try {
      const newMessage = {
        senderId: user.uid,
        recipientId: selectedPartner.partnerId,
        recipientPhone: selectedPartner.partnerPhone,
        content: messageText,
      };

      await api.post('/messages/send', newMessage);

      // Add message to local state
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now().toString(),
          ...newMessage,
          senderPhone: user.phone,
          timestamp: new Date().toISOString(),
          read: false,
        },
      ]);

      setMessageText('');
      scrollToBottom();

      // Emit socket event for real-time delivery
      socketRef.current?.emit('message', newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const markAsRead = (partnerId: string) => {
    if (!user) return;
    socketRef.current?.emit('messageRead', {
      senderId: user.uid,
      recipientId: partnerId,
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  const filteredConversations = conversations.filter((conv) =>
    conv.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 mb-4">Please sign in to access messages</p>
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
            </div>
            <button
              onClick={() => setShowSearchModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={18} />
              New Chat
            </button>
          </div>
        </div>

        {/* Search Modal */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Start a new chat</h2>
                <button onClick={() => setShowSearchModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by phone, email, or name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="flex justify-center py-4">
                    <Loader className="animate-spin text-blue-600" size={24} />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-gray-500 py-4">
                    {searchQuery ? 'No users found' : 'Start typing to search'}
                  </p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.uid}
                      onClick={() => startConversation(result)}
                      className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition flex items-center gap-3"
                    >
                      {result.photo ? (
                        <img
                          src={result.photo}
                          alt={result.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                          {result.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{result.name}</p>
                        <p className="text-sm text-gray-600">{result.phone}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex h-screen bg-white">
          {/* Conversations List */}
          <div className="w-full sm:w-1/3 border-r border-gray-200 flex flex-col bg-white">
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {conversations.length === 0 ? 'No conversations yet' : 'No matches found'}
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.partnerId || conv.partnerPhone}
                    onClick={() => {
                      setSelectedPartner(conv);
                      fetchMessages(conv.partnerId || conv.partnerPhone || '');
                    }}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                      selectedPartner?.partnerId === conv.partnerId ||
                      selectedPartner?.partnerPhone === conv.partnerPhone
                        ? 'bg-blue-50 border-l-4 border-l-blue-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{conv.partnerName}</h3>
                        <p className="text-sm text-gray-600 truncate">{conv.partnerPhone}</p>
                        <p className="text-sm text-gray-600 truncate line-clamp-2">{conv.lastMessage}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conv.lastMessageTime).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="hidden sm:flex sm:w-2/3 flex-col">
            {selectedPartner ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedPartner(null);
                      setMessages([]);
                    }}
                    className="sm:hidden text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">{selectedPartner.partnerName}</h2>
                    <p className="text-sm text-gray-600">
                      {selectedPartner.partnerPhone || selectedPartner.partnerEmail}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader className="animate-spin text-blue-600" size={32} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-500">
                      <div className="text-center">
                        <MessageSquare size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.senderId === user.uid
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-gray-200 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.senderId === user.uid ? 'text-blue-100' : 'text-gray-600'
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
