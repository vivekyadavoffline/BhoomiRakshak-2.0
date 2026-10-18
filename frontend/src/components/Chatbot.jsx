import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../services/apiConfig';
import { getOfflineKnowledgeResponse } from '../services/chatbotKnowledge';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am the Bhoomi Rakshak 2.0 AI Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendRequest = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      let reply = null;

      // 1. Attempt backend request if an API URL is available
      if (API_BASE_URL) {
        try {
          const requestMessages = newMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));

          const response = await axios.post(`${API_BASE_URL}/api/chat`, {
            messages: requestMessages
          }, {
            timeout: 5000 // 5s timeout prevents hanging on sleeping/cold-start instances
          });

          if (response?.data?.reply) {
            reply = response.data.reply;
          }
        } catch (apiErr) {
          console.warn('Backend chat API offline or unreachable. Using built-in knowledge engine:', apiErr?.message);
        }
      }

      // 2. If no reply from backend, use built-in intelligent knowledge engine
      if (!reply) {
        // Small organic delay so client-side response feels natural
        await new Promise(resolve => setTimeout(resolve, 350));
        reply = getOfflineKnowledgeResponse(text);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Error in chat handler:', error);
      const fallbackReply = getOfflineKnowledgeResponse(text);
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackReply }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    await handleSendRequest(input);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-32px)] sm:w-96 max-w-sm bg-white/95 backdrop-blur-md border border-gray-200/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out transform origin-bottom-right" style={{ height: '480px', maxHeight: '75vh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
            <div className="flex items-center space-x-2">
              <Bot className="w-6 h-6" />
              <span className="font-semibold tracking-wide">Bhoomi Rakshak 2.0 Assistant</span>
            </div>
            <button 
              onClick={toggleChat}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 ml-2' : 'bg-blue-100 mr-2'}`}>
                    {msg.role === 'user' ? <User className="w-5 h-5 text-indigo-600" /> : <Bot className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div 
                    className={`px-4 py-2 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' 
                        : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] flex-row">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-blue-100 mr-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white border border-gray-100 shadow-sm flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 bg-gray-50/50">
              {['What is the priority score?', 'How does evacuation routing work?', 'Explain multi-hazard fusion', 'What is reverse insurance?'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    handleSendRequest(q);
                  }}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 px-3 rounded-full transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the project..."
                className="flex-1 bg-gray-100 text-gray-800 text-sm px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition-all border border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                  input.trim() && !isLoading 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 ${
          isOpen 
            ? 'bg-gray-800 text-white rotate-90' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30'
        }`}
        aria-label="Toggle Chat"
      >
        {isOpen ? <X className="w-6 h-6 -rotate-90 transition-transform" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default Chatbot;
