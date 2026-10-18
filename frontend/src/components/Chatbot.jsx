import React, { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL, buildApiUrl } from "../services/apiConfig";
import { getOfflineKnowledgeResponse } from "../services/chatbotKnowledge";
import { ZONES } from "../data/zonesData";

function buildTinyFishQuery(question) {
  const normalized = question.toLowerCase();
  if (
    /(red|risk|hazard) zone/.test(normalized) &&
    /delhi|shahdara|east delhi/.test(normalized)
  ) {
    return "official Delhi India disaster hazard red zones flood landslide risk maps NDMA IMD";
  }
  if (
    /(latest|today|current|update|recent)/.test(normalized) &&
    /delhi|india/.test(normalized)
  ) {
    return `latest official India Delhi disaster risk weather hazard updates ${question}`;
  }
  return `${question} India disaster risk hazard evacuation relocation official data`;
}

function getLocalDelhiZones(question) {
  if (
    !/delhi|shahdara|east delhi/i.test(question) ||
    !/(red|risk|hazard) zone/i.test(question)
  )
    return [];
  return ZONES.filter(
    (zone) =>
      /delhi/i.test(`${zone.district} ${zone.state}`) &&
      zone.phase === "Immediate",
  )
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map((zone) => ({
      title: `${zone.name} · ${zone.district}`,
      url: "",
      summary: `Priority ${zone.priorityScore}/100, population ${zone.population.toLocaleString("en-IN")}, hazard ${zone.hazard}. Local Bhoomi Rakshak project record.`,
    }));
}

function buildTinyFishCards(rawResults) {
  const text =
    typeof rawResults === "string"
      ? rawResults
      : JSON.stringify(rawResults, null, 2);
  const firstSource = text.search(/\n\s*1\.\s/);
  const sourceText = firstSource >= 0 ? text.slice(firstSource + 1) : text;
  return sourceText
    .split(/\n(?=\d+\.\s)/)
    .filter(Boolean)
    .slice(0, 4)
    .map((section) => {
      const lines = section
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const title = (lines.shift() || "Live source").replace(/^\d+\.\s*/, "");
      const urlIndex = lines.findIndex((line) => /^https?:\/\//i.test(line));
      const url = urlIndex >= 0 ? lines.splice(urlIndex, 1)[0] : "";
      return { title, url, summary: lines.join(" ").slice(0, 220) };
    });
}

const LIVE_WEB_INTENT =
  /\b(latest|current|today|now|update|updates|weather|forecast|alert|alerts|news|recent|live|delhi|mumbai|india|district|region)\b/i;
const INTERNAL_FALLBACK =
  "I am trained on the Bhoomi Rakshak platform documentation.";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I am the Bhoomi Rakshak 2.0 AI Assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendRequest = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      let reply = null;
      let sourceCards = null;
      const localProjectCards = getLocalDelhiZones(text);
      const liveWebQuestion = LIVE_WEB_INTENT.test(text);

      // Internal project knowledge comes first.
      if (!liveWebQuestion && API_BASE_URL) {
        try {
          const requestMessages = newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

          const response = await axios.post(
            `${API_BASE_URL}/api/chat`,
            {
              messages: requestMessages,
            },
            {
              timeout: 5000, // 5s timeout prevents hanging on sleeping/cold-start instances
            },
          );

          if (response?.data?.reply) {
            reply = response.data.reply;
          }
        } catch (apiErr) {
          console.warn(
            "Backend chat API offline or unreachable. Using built-in knowledge engine:",
            apiErr?.message,
          );
        }
      }

      // 2. If no reply from backend, use built-in intelligent knowledge engine
      if (!reply) {
        // Small organic delay so client-side response feels natural
        await new Promise((resolve) => setTimeout(resolve, 350));
        reply = getOfflineKnowledgeResponse(text);
      }

      const internalAnswerMissing =
        !reply || reply.startsWith(INTERNAL_FALLBACK);
      const shouldUseTinyFish = liveWebQuestion || internalAnswerMissing;
      if (shouldUseTinyFish) {
        try {
          const context = newMessages
            .slice(-3)
            .map((message) => `${message.role}: ${message.content}`)
            .join(" | ");
          const searchQuery = buildTinyFishQuery(text);
          const webResponse = await fetch(buildApiUrl("/api/tinyfish/search"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `${searchQuery}. Focus on official and credible sources. Bhoomi Rakshak project context: disaster-risk and relocation planning. ${context}`,
            }),
          });
          const webPayload = await webResponse.json();
          if (!webResponse.ok || !webPayload?.results)
            throw new Error(
              webPayload.detail || "TinyFish could not return a live response",
            );
          sourceCards = [
            ...localProjectCards,
            ...buildTinyFishCards(webPayload.results),
          ];
          reply = localProjectCards.length
            ? `Bhoomi Rakshak found ${localProjectCards.length} immediate-action Delhi zone records and ${sourceCards.length - localProjectCards.length} live supporting sources.`
            : `${liveWebQuestion ? "TinyFish checked current live information." : "Internal project notes did not cover this fully."} Added ${sourceCards.length} relevant project sources.`;
        } catch (webErr) {
          reply = `${reply}\n\nLive web fallback is unavailable right now.`;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          cards: sourceCards,
          source: sourceCards ? "tinyfish" : "internal",
        },
      ]);
    } catch (error) {
      console.error("Error in chat handler:", error);
      const fallbackReply = getOfflineKnowledgeResponse(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fallbackReply },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    await handleSendRequest(input);
  };

  return (
    <div className="chatbot-shell fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div
          className="chatbot-window mb-3 w-[calc(100vw-32px)] sm:w-96 max-w-sm bg-white backdrop-blur-md border border-amber-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out transform origin-bottom-right"
          style={{
            height: "480px",
            maxHeight: "75vh",
            boxShadow: "0 18px 48px rgba(15, 42, 80, .25)",
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-white via-[#fff8e8] to-[#ffe7a1] text-[#4b3b28] p-4 flex justify-between items-center shadow-md border-b-2 border-amber-300">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-amber-100 text-[#8a5a08] flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold tracking-wide block">
                  Bhoomi Rakshak Assistant
                </span>
                <span className="text-[10px] text-amber-100/90">
                  Internal project knowledge with live web fallback
                </span>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="text-[#8a5a08]/80 hover:text-[#4b3b28] transition-colors p-1 rounded-full hover:bg-amber-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-2 bg-white border-b border-amber-100 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Project docs first <span className="text-amber-500">•</span>{" "}
            TinyFish fills knowledge gaps
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-slate-50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-amber-100 ml-2" : "bg-amber-100 mr-2"}`}
                  >
                    {msg.role === "user" ? (
                      <User className="w-5 h-5 text-amber-700" />
                    ) : (
                      <Bot className="w-5 h-5 text-[#c89525]" />
                    )}
                  </div>
                  <div
                    className={`text-sm ${
                      msg.role === "user"
                        ? "max-w-[85%] px-4 py-2 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#132238] rounded-tr-none shadow-sm"
                        : msg.cards?.length
                          ? "w-[min(310px,calc(100vw-120px))] rounded-2xl rounded-tl-none bg-[#fffdf8] border border-amber-200 shadow-sm overflow-hidden"
                          : "max-w-[85%] px-4 py-2 rounded-2xl bg-white text-slate-800 border border-amber-200 shadow-sm rounded-tl-none"
                    }`}
                  >
                    {msg.cards?.length ? (
                      <div>
                        <div className="px-3 py-2.5 border-b border-amber-100 bg-gradient-to-r from-[#fff9e8] to-white">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9a670d]">
                              Live project brief
                            </span>
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <p className="mt-1 text-[11px] leading-4 text-slate-600">
                            {msg.content}
                          </p>
                        </div>
                        <div className="p-2.5 space-y-2">
                          {msg.cards.map((card, cardIndex) => (
                            <article
                              key={`${card.title}-${cardIndex}`}
                              className="rounded-xl border border-amber-100 bg-white p-2.5 shadow-[0_2px_8px_rgba(180,130,30,.08)]"
                            >
                              <div className="flex items-start gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#fff1c2] text-[10px] font-extrabold text-[#9a670d]">
                                  {cardIndex + 1}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-[11px] font-bold leading-4 text-[#5f430c]">
                                    {card.title}
                                  </h4>
                                  {card.url && (
                                    <a
                                      href={card.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-0.5 block truncate text-[9px] text-amber-700 hover:text-amber-900"
                                    >
                                      {card.url}
                                    </a>
                                  )}
                                  <p className="mt-1 text-[10px] leading-4 text-slate-600">
                                    {card.summary ||
                                      "Relevant live source for the Bhoomi Rakshak project."}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="border-t border-amber-100 px-3 py-2 text-[9px] font-semibold text-emerald-700">
                          TinyFish · project-focused live sources
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] flex-row">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-amber-100 mr-2">
                    <Bot className="w-5 h-5 text-[#c89525]" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white border border-amber-100 shadow-sm flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 bg-white">
              {[
                "What is the priority score?",
                "How does evacuation routing work?",
                "Explain multi-hazard fusion",
                "What is reverse insurance?",
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    handleSendRequest(q);
                  }}
                  className="text-xs bg-white hover:bg-amber-50 text-[#805308] border border-amber-200 hover:border-amber-300 py-1.5 px-3 rounded-full transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-amber-100">
            <form onSubmit={handleSend} className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about Bhoomi Rakshak..."
                className="flex-1 bg-[#fffdf8] text-slate-800 text-sm px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white transition-all border border-amber-200"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                  input.trim() && !isLoading
                    ? "bg-gradient-to-br from-[#ffe08a] to-[#c89525] text-[#4b2d00] hover:shadow-amber-300/50"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
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
            ? "bg-[#fff1c2] text-[#805308] rotate-90"
            : "bg-gradient-to-br from-[#fff1c2] via-[#f3c95b] to-[#c89525] text-[#4b2d00] hover:shadow-amber-400/40"
        }`}
        aria-label="Toggle Chat"
      >
        {isOpen ? (
          <X className="w-6 h-6 -rotate-90 transition-transform" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
};

export default Chatbot;
