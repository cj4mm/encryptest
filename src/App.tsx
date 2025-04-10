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

export default function App() {
  const [sender, setSender] = useState("");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [result, setResult] = useState("");
  const [visibleDecryptIds, setVisibleDecryptIds] = useState<Record<string, string>>({});
  const [showPasswordInputs, setShowPasswordInputs] = useState<Record<string, boolean>>({});
  const [inlinePasswords, setInlinePasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as ChatLog),
      }));
      setLogs(newLogs);

      // Notification logic
      if (Notification.permission === "granted" && newLogs.length > 0) {
        const latest = newLogs[0];
        const isNew = Date.now() - latest.timestamp.toMillis() < 5000;
        if (isNew) {
          new Notification("🔐 모질띨빡 암호기", {
            body: `${latest.sender}님이 새로운 암호문을 보냈습니다!`,
            icon: "/favicon.ico",
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const deriveKeyFromPassword = async (password: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  const handleEncrypt = async () => {
    if (!text || !password || !sender) return;
    const encoder = new TextEncoder();
    const key = await deriveKeyFromPassword(password);
    const bytes = encoder.encode(text);
    const encrypted = bytes.map((b, i) => b ^ key[i % key.length]);
    const encryptedStr = String.fromCharCode(...encrypted);
    const base64 = btoa(encryptedStr);
    setResult(base64);

    await addDoc(collection(db, "messages"), {
      sender,
      password: "",
      text: base64,
      mode: "encrypt",
      timestamp: Timestamp.now(),
    });
    setText("");
  };

  const handleInlineDecrypt = async (log: ChatLog, password: string) => {
    const key = await deriveKeyFromPassword(password);
    try {
      const binaryStr = atob(log.text);
      const encrypted = [...binaryStr].map((c) => c.charCodeAt(0));
      const decryptedBytes = encrypted.map((b, i) => b ^ key[i % key.length]);
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(new Uint8Array(decryptedBytes));
      setVisibleDecryptIds((prev) => ({
        ...prev,
        [log.id!]: decryptedText,
      }));
    } catch (err) {
      alert("복호화 실패: 키가 맞지 않거나 암호문 형식이 잘못됨.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-center text-indigo-600">🧠 모질띨빡 암호기</h1>

      <div className="space-y-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "encrypt" | "decrypt")}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="encrypt">암호화</option>
          <option value="decrypt">복호화</option>
        </select>

        {mode === "encrypt" && (
          <>
            <input
              type="text"
              placeholder="작성자 이름"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="비밀번호 (공유 키)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </>
        )}

        <textarea
          placeholder={mode === "encrypt" ? "평문 입력" : "암호문 입력 (Base64)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />

        <button
          onClick={handleEncrypt}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {mode === "encrypt" ? "암호화 후 공유" : "복호화 결과 보기"}
        </button>

        {mode === "decrypt" && result && (
          <div className="bg-yellow-100 p-2 rounded text-center">🔓 복호화 결과: {result}</div>
        )}
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
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
                <div className="ml-auto flex flex-col items-end space-y-1">
                  {showPasswordInputs[log.id!] && !visibleDecryptIds[log.id!] && (
                    <>
                      <input
                        type="password"
                        className="border border-gray-300 focus:border-indigo-500 rounded px-2 py-1 w-full text-sm transition"
                        placeholder="공유 키 입력"
                        value={inlinePasswords[log.id!] || ""}
                        onChange={(e) =>
                          setInlinePasswords((prev) => ({
                            ...prev,
                            [log.id!]: e.target.value,
                          }))
                        }
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            await handleInlineDecrypt(log, inlinePasswords[log.id!] || "");
                            setShowPasswordInputs((prev) => ({
                              ...prev,
                              [log.id!]: false,
                            }));
                          }
                        }}
                        autoFocus
                      />
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={async () => {
                          await handleInlineDecrypt(log, inlinePasswords[log.id!] || "");
                          setShowPasswordInputs((prev) => ({
                            ...prev,
                            [log.id!]: false,
                          }));
                        }}
                      >
                        확인
                      </button>
                    </>
                  )}
                  {visibleDecryptIds[log.id!] ? (
                    <Unlock className="w-4 h-4 text-green-500" />
                  ) : (
                    <Lock
                      className="w-4 h-4 text-gray-400 hover:text-black cursor-pointer"
                      onClick={() =>
                        setShowPasswordInputs((prev) => ({
                          ...prev,
                          [log.id!]: !prev[log.id!],
                        }))
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
