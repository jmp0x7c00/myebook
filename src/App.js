/* global Vosk */
import HTMLFlipBook from "react-pageflip";
import React, { useState, useRef } from "react";
import bg from './bg.jpg';
import "./App.css";



const PageCover = React.forwardRef((props, ref) => {
	return (
		<div
		className="cover"
		ref={ref}
		data-density="hard"
		style={{
			// backgroundImage: "url('/bg.jpg')",
			// backgroundSize: "cover",
			// backgroundPosition: "center",
			// backgroundRepeat: "no-repeat"
		}}
		>
		<div>
		<h2>{props.children}</h2>
		</div>
		</div>
	);
});

const Page = React.forwardRef(({ number, content, image }, ref) => {
	return (
		<div className="page" ref={ref}>
		<h2>第 {number} 页</h2>
		<hr />
		{image && (
			<img
			src={image}
			alt="page"
			style={{ maxWidth: "100%", maxHeight: "300px", marginBottom: "10px" }}
			/>
		)}
		<p className="cartoon-text">{content}</p>
		</div>
	);
});


function floatTo16BitPCM(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return buffer;
}

function MyAlbum() {
	const bookRef = useRef();
	const [currentPage, setCurrentPage] = useState(0);
	const [isListeningLeft, setIsListeningLeft] = useState(false);
	const [isListeningRight, setIsListeningRight] = useState(false);
	const [pages, setPages] = useState([
		{ text: "第一页内容", image: null },
		{ text: "第二页内容", image: null },
		{ text: "第三页内容", image: null },
		{ text: "第四页内容", image: null },
	]);

	// 用于保存当前录音的上下文
	const audioCtxRef = useRef(null);
	const micStreamRef = useRef(null);
	const recognizerRef = useRef(null);

	const handleFlip = (e) => {
		setCurrentPage(e.data);
	};

	// ✅ 停止录音
	const stopRecording = (side) => {
		try {
			if (audioCtxRef.current) {
				audioCtxRef.current.close();
				audioCtxRef.current = null;
			}
			if (micStreamRef.current) {
				micStreamRef.current.getTracks().forEach((track) => track.stop());
				micStreamRef.current = null;
			}
			if (recognizerRef.current) {
				recognizerRef.current.removeEventListener("result", () => {});
				recognizerRef.current = null;
			}

			if (side === "left") setIsListeningLeft(false);
			else setIsListeningRight(false);

			console.log("🟥 录音已停止");
		} catch (err) {
			console.error("停止录音失败:", err);
		}
	};

	// ✅ 启动语音识别（Vosklet）
	const startSpeechRecognition = async (side) => {
		try {

			// 🔹 最小改动：只在浏览器环境执行
			if (typeof window === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				console.warn("🟡 getUserMedia not available in this environment (probably server-side).");
				return;
			}
			if ((side === "left" && isListeningLeft) || (side === "right" && isListeningRight))
				return;

			const model = await Vosk.createModel("https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz");
			const recognizer = new model.KaldiRecognizer(48000);
			recognizer.setWords(true);
		    recognizer.on("result", (message) => {
		        console.log(`Result: ${message.result.text}`);
				const newPages = [...pages];
				newPages[currentPage - 1].text = `${message.result.text}`;
				setPages(newPages);
				
		    });
		    recognizer.on("partialresult", (message) => {
		        console.log(`Partial result: ${message.result.partial}`);
				
		    });				

			 const mediaStream = await navigator.mediaDevices.getUserMedia({
		        video: false,
		        audio: {
		            echoCancellation: true,
		            noiseSuppression: true,
		            channelCount: 1,
		            sampleRate: 16000
		        },
		    });
		    
		    const audioContext = new AudioContext();

			 await audioContext.resume();
			
		    
	        const source = audioContext.createMediaStreamSource(mediaStream);
	        const processor = audioContext.createScriptProcessor(4096, 1, 1);
	
	        processor.onaudioprocess = (event) => {
	            const audioBuffer = event.inputBuffer; // ✅ 保留 AudioBuffer
    			recognizer.acceptWaveform(audioBuffer); // Vosk 正确类型
	        };
	
	        source.connect(processor);
	        processor.connect(audioContext.destination);
					
		} catch (err) {
			alert(err);
			console.error("Vosklet Error:", err);
			alert("语音识别初始化失败，请检查模型路径或麦克风权限。");
		}
	};

	// ✅ 上传图片函数
	const uploadImage = (side, e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const newPages = [...pages];
			newPages[currentPage - 1].image = event.target.result;
			setPages(newPages);
		};
		reader.readAsDataURL(file);
	};

	return (
		<div style={{ backgroundColor: "LightCyan", minHeight: "100vh" }}>


		<div>
		<HTMLFlipBook
		width={550}
		height={650}
		minWidth={315}
		maxWidth={1000}
		minHeight={420}
		maxHeight={1350}
		showCover={true}
		flippingTime={1000}
		style={{ margin: "0 auto" }}
		maxShadowOpacity={0.5}
		className="album-web"
		ref={bookRef}
		onFlip={handleFlip}
		>
		<PageCover>My EBook</PageCover>
		{pages.map((p, i) => (
			<Page key={i} number={i + 1} content={p.text} image={p.image} />
		))}
		<PageCover></PageCover>
		</HTMLFlipBook>

		<br />

		{/* ✅ 左右语音输入区 + 文件上传区 */}
		<div
		className="formContainer"
		style={{
			display: "flex",
				justifyContent: "center",
				alignItems: "flex-start",
				gap: "40px",
				marginTop: "20px",
		}}
		>
		{/* 左页语音 */}
		<div style={{ textAlign: "center" }}>
		<button
		className="btn"
		onClick={() =>
			isListeningLeft ? stopRecording("left") : startSpeechRecognition("left")
		}
		style={{
			backgroundColor: isListeningLeft ? "red" : "lightgreen",
				color: "white",
		}}
		>
		{isListeningLeft ? "停止录音" : "🎙️ 开始录音"}
		</button>
		<br />
		<input type="file" accept="image/*" onChange={(e) => uploadImage("left", e)} />
		</div>
		</div>

		{/* <p style={{ textAlign: "center" }}>当前页：第 {currentPage + 1} 页</p> */}
		</div>
		</div>
	);
}

export default MyAlbum;
