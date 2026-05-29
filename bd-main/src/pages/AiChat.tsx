import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const BASE = "/api";
const CHAT_URL = `${BASE}/ai-chat`;

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  time: string;
  error?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Какова чистая прибыль за май?",
  "Топ-3 категории расходов?",
  "Сравни доходы апрель vs май",
  "Как снизить налоговую нагрузку?",
  "Покажи расходы за этот месяц",
  "Какой самый большой платёж?",
  "Динамика доходов за квартал",
];

const grandmaQuotes = [
  "Бабушки считают копеечки...",
  "Бабушки перебирают монетки...",
  "Бабушки шуршат купюрами...",
  "Бабушки сверяют чек...",
  "Бабушки ищут скидку...",
  "Бабушки копят на чёрный день...",
  "Бабушки пересчитывают выручку...",
  "Бабушки прячут заначку...",
  "Бабушки торгуются на рынке...",
  "Бабушки проверяют сдачу...",
  "Бабушки собирают на пенсию...",
  "Бабушки считают проценты...",
  "Бабушки экономят на спичках...",
  "Бабушки делят наследство...",
  "Бабушки копят на новые очки...",
  "Бабушки считают до зарплаты...",
  "Бабушки перекладывают из кубышки в кубышку...",
  "Бабушки ищут мелочь в диване...",
  "Бабушки взвешивают монетки на весах...",
  "Бабушки записывают расходы в тетрадку...",
];

const getTime = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    text: "Добро пожаловать в ФинансПро ИИ-ассистент (DeepSeek). Могу анализировать финансы, объяснять данные и помогать с отчётами. Задайте вопрос или выберите подсказку ниже.",
    time: getTime(),
  },
];

function renderText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

function GrandmaThinking() {
  const [quote, setQuote] = useState(grandmaQuotes[0]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuote(grandmaQuotes[Math.floor(Math.random() * grandmaQuotes.length)]);
    }, 3000);
    const frameInterval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 600);
    return () => {
      clearInterval(quoteInterval);
      clearInterval(frameInterval);
    };
  }, []);

  return (
    <div className="flex gap-2 sm:gap-3">
      <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
        <Icon name="Sparkles" size={13} className="text-gold" />
      </div>
      <div className="bg-secondary rounded-xl rounded-tl-none px-4 py-3 flex items-center gap-3">
        {/* Анимированная бабушка считает деньги */}
        <div className="flex-shrink-0 w-8 h-8">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g>
              {/* Платок */}
              <path d="M18 10 Q25 2 32 10 L30 18 Q25 15 20 18 Z" fill="#e879f9" stroke="#d946ef" strokeWidth="1"/>
              {/* Лицо */}
              <circle cx="25" cy="22" r="10" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="1"/>
              {/* Очки */}
              <circle cx="21" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
              <circle cx="29" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
              <line x1="24.5" y1="21" x2="25.5" y2="21" stroke="#333" strokeWidth="1.2"/>
              {/* Глаза — смотрят на деньги */}
              <circle cx="21" cy="21" r="1" fill="#333"/>
              <circle cx="29" cy="21" r="1" fill="#333"/>
              {/* Улыбка */}
              <path d="M21 26 Q25 29 29 26" fill="none" stroke="#c97a5a" strokeWidth="1" strokeLinecap="round"/>
              {/* Тело */}
              <rect x="17" y="32" width="16" height="18" rx="4" fill="#f472b6" stroke="#ec4899" strokeWidth="1"/>
              {/* Руки с монетками — анимация */}
              <g style={{ transform: `translateY(${frame === 0 || frame === 2 ? 0 : -2}px)`, transition: 'transform 0.3s' }}>
                <rect x="10" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                {/* Монетка */}
                <circle cx="13" cy="36" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5"/>
              </g>
              <g style={{ transform: `translateY(${frame === 1 || frame === 3 ? 0 : -2}px)`, transition: 'transform 0.3s' }}>
                <rect x="33" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                {/* Монетка */}
                <circle cx="37" cy="36" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5"/>
              </g>
            </g>
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground italic">{quote}</span>
        </div>
      </div>
    </div>
  );
}

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("deepseek-chat");
  const [recording, setRecording] = useState(false);
  const [speechSupported] = useState(
    () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), role: "user", text, time: getTime() };
    const newHistory: ChatMessage[] = [...history, { role: "user", content: text }];

    setMessages((prev) => [...prev, userMsg]);
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory, model }),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", text: data.error || `Ошибка ${resp.status}`, time: getTime(), error: true },
        ]);
      } else {
        const reply = data.reply as string;
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", text: reply, time: getTime() }]);
        setHistory((h) => [...h, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: "Не удалось подключиться к ИИ. Проверьте интернет-соединение.", time: getTime(), error: true },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send(input);
    }
  };

  const handleReset = () => {
    setMessages(initialMessages);
    setHistory([]);
    setInput("");
  };

  const toggleRecording = useCallback(() => {
    if (!speechSupported) return;

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [recording, speechSupported]);

  return (
    <div className="animate-fade-in card-fin flex flex-col h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-7rem)] min-h-[400px]">
      {/* Header */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
            <Icon name="Sparkles" size={16} className="text-gold" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">ФинансПро ИИ</div>
            <div className="text-xs text-positive flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
              DeepSeek
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold max-w-[110px] sm:max-w-none"
          >
            <option value="deepseek-chat">DeepSeek V3</option>
            <option value="deepseek-reasoner">DeepSeek R1</option>
          </select>
          <button
            onClick={handleReset}
            title="Новый диалог"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <Icon name="RotateCcw" size={15} />
          </button>
        </div>
      </div>

      {/* Messages — занимает всё свободное место */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 sm:px-5 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === "assistant" ? "bg-gold/20" : "bg-secondary"}`}>
              {msg.role === "assistant"
                ? <Icon name="Sparkles" size={13} className="text-gold" />
                : <Icon name="User" size={13} className="text-muted-foreground" />}
            </div>
            <div className={`max-w-[calc(100%-3rem)] sm:max-w-[75%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl text-sm leading-relaxed break-words ${
                  msg.error
                    ? "bg-red-900/20 text-negative border border-red-900/30 rounded-tl-none"
                    : msg.role === "assistant"
                    ? "bg-secondary text-foreground rounded-tl-none"
                    : "bg-gold text-primary-foreground rounded-tr-none"
                }`}
                dangerouslySetInnerHTML={{ __html: renderText(msg.text) }}
              />
              <span className="text-xs text-muted-foreground px-1">{msg.time}</span>
            </div>
          </div>
        ))}

        {loading && <GrandmaThinking />}
        <div ref={bottomRef} />
      </div>

      {/* Bottom panel */}
      <div className="border-t border-border flex-shrink-0">
        {/* Бегущая строка с подсказками */}
        <div className="relative overflow-hidden border-b border-border/50 py-2" ref={marqueeRef}>
          <div className="flex gap-2 animate-marquee whitespace-nowrap">
            {[...suggestions, ...suggestions].map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                disabled={loading}
                className="inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-gold/50 hover:text-foreground transition-all disabled:opacity-40 flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Поле ввода */}
        <div className="flex gap-2 items-center px-2.5 sm:px-3 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Сообщение..."
            className="flex-1 min-w-0 bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
          />
          {speechSupported && (
            <button
              onClick={toggleRecording}
              title={recording ? "Остановить запись" : "Голосовой ввод"}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                recording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-gold/40"
              }`}
            >
              <Icon name={recording ? "MicOff" : "Mic"} size={17} />
            </button>
          )}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-lg bg-gold flex items-center justify-center text-primary-foreground hover:bg-yellow-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Icon name="Send" size={17} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}