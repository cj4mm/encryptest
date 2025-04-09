import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { ShieldCheck, Unlock, Lock } from "lucide-react";

interface ChatLog {
  id?: string;
  sender: string;
  password: string;
  text: string;
  mode: "encrypt" | "decrypt";
  timestamp: Timestamp;
}

type Mode = "encrypt" | "decrypt";

function deriveKeyFromPassword(password: string): number {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 31 + password.charCodeAt(i)) % 256;
  }
  return hash;
}

const LOGS_PER_PAGE = 10;

export default function App() {
  const [sender, setSender] = useState("");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("encrypt");
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [decryptedResult, setDecryptedResult] = useState("");
  const [visibleDecryptIds, setVisibleDecryptIds] = useState<{ [id: string]: string }>({});
  const [decryptInputs, setDecryptInputs] = useState<{ [id: string]: string }>({});

  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  const handleProcess = async () => {
    if (!text || (mode === "encrypt" && (!password || !sender))) return;
    const key = deriveKeyFromPassword(password);

    if (mode === "encrypt") {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      const encrypted = bytes.map((b) => b ^ key);
      const encryptedStr = String.fromCharCode(...encrypted);
      const base64 = btoa(encryptedStr);

      await addDoc(collection(db, "messages"), {
        sender,
        password: "***",
        text: base64,
        mode,
        timestamp: Timestamp.now(),
      });
      setText("");
    } else {
      try {
        const binaryStr = atob(text);
        const encrypted = [...binaryStr].map((c) => c.charCodeAt(0));
        const decryptedBytes = encrypted.map((b) => b ^ key);
        const decoder = new TextDecoder();
        const decryptedText = decoder.decode(new Uint8Array(decryptedBytes));
        setDecryptedResult(decryptedText);
        setText("");
      } catch {
        alert("⚠️ 복호화 실패: 올바른 Base64 형식이 아닙니다.");
      }
    }
  };

  const handleInlineDecrypt = (log: ChatLog) => {
    const key = deriveKeyFromPassword(decryptInputs[log.id!]);
    try {
      const binaryStr = atob(log.text);
      const encrypted = [...binaryStr].map((c) => c.charCodeAt(0));
      const decryptedBytes = encrypted.map((b) => b ^ key);
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(new Uint8Array(decryptedBytes));
      setVisibleDecryptIds((prev) => ({ ...prev, [log.id!]: decryptedText }));
    } catch {
      alert("❌ 복호화 실패!");
    }
  };

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: ChatLog[] = snapshot.docs.map((doc) => ({
        ...(doc.data() as ChatLog),
        id: doc.id,
      }));
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  const getTextPlaceholder = () =>
    mode === "encrypt" ? "평문 입력 (예: 안녕하세요)" : "암호문 입력 (Base64)";

  const getButtonLabel = () =>
    mode === "encrypt" ? "암호화 후 공유" : "복호화 결과 확인";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-center mb-4">
        <span className="mr-2">🧠</span>모질띨빡 암호기 (실시간)
      </h1>

      <div className="flex flex-col space-y-2 max-w-2xl mx-auto">
        <select
          className="border px-2 py-1"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <option value="encrypt">암호화</option>
          <option value="decrypt">복호화</option>
        </select>

        {mode === "encrypt" && (
          <>
            <input
              className="border px-2 py-1"
              placeholder="이름"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            <input
              type="password"
              className="border px-2 py-1"
              placeholder="비밀번호 (공유 키)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        <textarea
          className="border px-2 py-1"
          placeholder={getTextPlaceholder()}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="bg-indigo-500 text-white px-4 py-2 rounded"
          onClick={handleProcess}
        >
          {getButtonLabel()}
        </button>

        {mode === "decrypt" && decryptedResult && (
          <div className="bg-white border mt-2 p-3 rounded shadow">
            <div className="text-sm text-gray-500 mb-1">복호화 결과:</div>
            <div className="flex items-center space-x-2">
              <Unlock className="text-yellow-500 w-4 h-4" />
              <span>{decryptedResult}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-2 flex items-center">
          <span className="mr-2">💬</span>실시간 대화 로그
        </h2>
        <div className="space-y-2">
          {paginatedLogs.map((log) => (
            <div key={log.id} className="bg-white p-3 rounded shadow">
              <div className="text-sm text-gray-500 mb-1">
                [{log.timestamp.toDate().toLocaleString()}] {log.sender}:
              </div>
              <div className="flex items-center space-x-2">
                {log.mode === "encrypt" ? (
                  <ShieldCheck className="text-green-500 w-4 h-4" />
                ) : (
                  <Unlock className="text-yellow-500 w-4 h-4" />
                )}
                <span>{visibleDecryptIds[log.id!] || log.text}</span>
                {log.mode === "encrypt" && (
                  <div className="ml-auto flex items-center space-x-1">
                    <Lock
                      className="w-4 h-4 cursor-pointer text-gray-400 hover:text-black"
                      onClick={() => {
                        const wrapper = document.createElement("div");
                        const input = document.createElement("input");
                        input.type = "password";
                        input.placeholder = "비밀번호 (공유 키)";
                        input.style.padding = "8px";
                        input.style.border = "1px solid #ccc";
                        input.style.borderRadius = "4px";
                        wrapper.appendChild(input);
                        setTimeout(() => {
                          const password = prompt("🔐 복호화 키 입력");
                          if (password) {
                            setDecryptInputs((prev) => ({ ...prev, [log.id!]: password }));
                            handleInlineDecrypt(log);
                          }
                        }, 50);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4 space-x-2">
          <button
            disabled={currentPage === 1}
            className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            ◀ 이전
          </button>
          <span className="text-sm py-1">{currentPage} / {totalPages || 1}</span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          >
            다음 ▶
          </button>
        </div>
      </div>
    </div>
  );
}
