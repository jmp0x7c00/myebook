import HTMLFlipBook from "react-pageflip";
import React, { useState, useRef, useEffect } from "react";
import "./App.css";

// 🔹 全局模型缓存（只加载一次）
let globalModel = null;
let voskModule = null;

function MyAlbum() {
  const bookRef = useRef();
  const [currentPage, setCurrentPage] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [pages, setPages] = useState([
    { text: "第一页内容", image: null },
    { text: "第二页内容", image: null },
    { text: "第三页内容", image: null },
    { text: "第四页内容", image: null },
  ]);

  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const recognizerRef = useRef(null);

  // ✅ 仅初始化一次模型
  useEffect(() => {
    const initModel = async () => {
      if (!window.loadVosklet) return console.warn("Vosklet 未加载");

      voskModule = await window.loadVosklet();
      if (!globalModel) {
        console.log("🔹 加载模型中...");
        globalModel = await voskModule.createModel(
          "https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz",
          "English",
          "vosk-model-small-en-us-0.15"
        );
        console.log("✅ 模型加载完成");
      }
    };
    initModel();

    // 🔹 页面卸载时释放模型
    return () => {
      if (globalModel) {
        console.log("🧹 释放模型内存");
        globalModel.terminate();
        globalModel = null;
      }
    };
  }, []);

  const handleFlip = (e) => setCurrentPage(e.data);

  // ✅ 停止录音（安全释放所有内存）
  const stopRecording = async () => {
    try {
      recognizerRef.current?.terminate?.();
      audioCtxRef.current?.close?.();
      micStreamRef.current?.getTracks()?.forEach((t) => t.stop());

      recognizerRef.current = null;
      micStreamRef.current = null;
      audioCtxRef.current = null;
      setIsListening(false);

      console.log("🟥 录音已停止并释放资源");
    } catch (err) {
      console.error("停止录音失败:", err);
    }
  };

  // ✅ 启动语音识别（只复用一个模型）
  const startSpeechRecognition = async () => {
    if (!globalModel || !voskModule) {
      alert("模型未准备好，请稍候再试");
      return;
    }

    if (isListening) return;
    setIsListening(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const micNode = ctx.createMediaStreamSource(stream);
      audioCtxRef.current = ctx;
      micStreamRef.current = stream;

      const recognizer = new globalModel.KaldiRecognizer(ctx.sampleRate);
      recognizer.setWords(true);
      recognizerRef.current = recognizer;

      recognizer.on("result", (msg) => {
        const text = msg.result?.text || "";
        if (text) {
          const newPages = [...pages];
          newPages[currentPage - 1].text = text;
          setPages(newPages);
        }
        console.log("🟢 识别结果：", text);
      });

      recognizer.on("partialresult", (msg) => {
        console.log("🟡 Partial:", msg.result?.partial);
      });

      const transferer = await voskModule.createTransferer(ctx, 128 * 150);
      transferer.port.onmessage = (ev) => recognizer.acceptWaveform(ev.data);
      micNode.connect(transferer);

      // 自动停止录音（2分钟）
      setTimeout(stopRecording, 120000);
    } catch (err) {
      console.error("Vosklet Error:", err);
      alert("语音识别初始化失败，请检查麦克风权限。");
      setIsListening(false);
    }
  };

  const uploadImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newPages = [...pages];
      newPages[currentPage - 1].image = ev.target.result;
      setPages(newPages);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ backgroundColor: "LightCyan", minHeight: "100vh" }}>
      <HTMLFlipBook
        width={550}
        height={650}
        showCover
        flippingTime={1000}
        onFlip={handleFlip}
        ref={bookRef}
        style={{ margin: "0 auto" }}
      >
        <div className="cover">
          <h2>My EBook</h2>
        </div>
        {pages.map((p, i) => (
          <div key={i} className="page">
            <h2>第 {i + 1} 页</h2>
            <p>{p.text}</p>
            {p.image && <img src={p.image} alt="page" />}
          </div>
        ))}
        <div className="cover"></div>
      </HTMLFlipBook>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button
          onClick={isListening ? stopRecording : startSpeechRecognition}
          style={{
            backgroundColor: isListening ? "red" : "lightgreen",
            color: "white",
          }}
        >
          {isListening ? "停止录音" : "🎙️ 开始录音"}
        </button>
        <br />
        <input type="file" accept="image/*" onChange={uploadImage} />
      </div>
    </div>
  );
}

export default MyAlbum;
