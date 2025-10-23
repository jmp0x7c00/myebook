/* global Vosk */
import HTMLFlipBook from "react-pageflip";
import React, { useState, useRef } from "react";
import bg from './bg.jpg';
import "./App.css";



// const PageCover = React.forwardRef((props, ref) => {
// 	return (
// 		<div
// 		className="cover"
// 		ref={ref}
// 		data-density="hard"
// 		style={{
// 			// backgroundImage: "url('/179175e8b0f611660ec7f67422b3ce71.jpeg')",
// 			// backgroundSize: "cover",
// 			// backgroundPosition: "center",
// 			// backgroundRepeat: "no-repeat"
// 		}}
// 		>
// 		<div>
// 		<h2>{props.children}</h2>
// 		</div>
// 		</div>
// 	);
// });

const PageCover = React.forwardRef(({ title, image, text }, ref) => {
  return (
    <div
      className="cover"
      ref={ref}
      data-density="hard"
      style={{
        // backgroundImage: `url(${bg})`,
        // backgroundSize: "cover",
        // backgroundPosition: "center",
        // position: "relative",
      }}
    >


	<h2 style={{ textAlign: "center" }}>{title}</h2>
								   
      {image && (
        <img
          src={image}
          alt="cover"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "block",
            margin: "0 auto",
          }}
        />
      )}
      
      {text && (
        <p
          style={{
            whiteSpace: "pre-wrap",
            textAlign: "center",
            padding: "10px",
          }}
        >
          {text}
        </p>
      )}
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
		<p className="cartoon-text" style={{ whiteSpace: "pre-wrap" }}>{content}</p>
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
	const [isModelLoading, setIsModelLoading] = useState(false);
	const modelRef = useRef(null);  // 🔹 保存全局模型
	
	// const [pages, setPages] = useState([
	// 	{ text: "第一页内容", image: null },
	// 	{ text: "第二页内容", image: null },
	// 	{ text: "第三页内容", image: null },
	// 	{ text: "第四页内容", image: null },
	// ]);

	const [pages, setPages] = useState([
	  { text: "封面内容", image: null, isCover: true },
	  { text: "第一页内容", image: null },
	  { text: "第二页内容", image: null },
	  { text: "第三页内容", image: null },
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

			// 如果模型正在加载
			if (isModelLoading) {
				alert("模型加载中，请稍后...");
				return;
			}
		
		    if ((side === "left" && isListeningLeft) || (side === "right" && isListeningRight)) return;
		
		    if (!modelRef.current) {
	            setIsModelLoading(true);
	            modelRef.current = await Vosk.createModel(
	                "https://myebook-1257475696.cos.ap-shanghai.myqcloud.com/vosk-model-small-en-us-0.15.zip"
	            );
	            setIsModelLoading(false);
	            console.log("✅ 模型加载完成");
        	}
			const recognizer = new modelRef.current.KaldiRecognizer(48000);
			recognizer.setWords(true);
		    recognizer.on("result", (message) => {
		        console.log(`Result: ${message.result.text}`);
				const newPages = [...pages];
				let textOld = '';
				if (newPages[currentPage] && newPages[currentPage] .text){
					textOld = newPages[currentPage].text;
					if (!textOld || textOld === "" || textOld.includes('内容')){
						textOld = '';
					} 
				}
		
				let raw = message.result.text.trim();
				if (raw.length > 0) {
				  raw = raw.charAt(0).toUpperCase() + raw.slice(1);
				}
				let textNew = `${raw}. `;
				
				if (textNew !== '. '){
					if (textOld.endsWith(textNew)){
						console.log(`重复内容： ${textNew}, 过滤掉`);
						return;
					}
					textNew = textOld + textNew;
					newPages[currentPage].text = textNew;
					setPages(newPages);
				}
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


			// ✅ 保存上下文
	        audioCtxRef.current = audioContext;
	        micStreamRef.current = mediaStream;
	        recognizerRef.current = recognizer;
	
	        // ✅ 更新按钮状态
	        if (side === "left") setIsListeningLeft(true);
	        else setIsListeningRight(true);
	
	        console.log("🟩 录音已开始");
					
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
			newPages[currentPage].image = event.target.result;
			setPages(newPages);
		};
		reader.readAsDataURL(file);
	};

	return (
		<div
		  style={{
		    backgroundColor: "LightCyan",
		    overflow: "hidden",
		  }}
		>


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

		{pages.map((p, i) =>
		    p.isCover ? (
		      <PageCover
		        key={i}
		        title="I am special!"
		        image={p.image}
		        text={p.text}
		      />
		    ) : (
		      <Page key={i} number={i} content={p.text} image={p.image} />
		    )
  		)}
		</HTMLFlipBook>

		<br />

		{/* ✅ 左右语音输入区 + 文件上传区 + 删除按钮 */}
		{currentPage >= 0 && (
		<div className="formContainer" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginTop: "20px" }}>
		    {/* 上传按钮 */}
		    <button className="btn" style={{ backgroundColor: "#3498db", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }} onClick={() => document.getElementById("fileInputLeft").click()}>
		        上传图片
		    </button>
		    <input id="fileInputLeft" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadImage("left", e)} />
		
		    {/* 录音按钮 */}
		    <button className="btn" onClick={() => isListeningLeft ? stopRecording("left") : startSpeechRecognition("left")} style={{
		        backgroundColor: isListeningLeft ? "red" : "lightgreen",
		        color: "white",
		        border: "none",
		        padding: "8px 16px",
		        borderRadius: "6px",
		        cursor: "pointer",
		    }}>
		        {isListeningLeft ? "停止录音" : "🎙️ 开始录音"}
		    </button>
		
		    {/* 🔹 删除按钮 */}
		    <button className="btn" style={{
		        backgroundColor: "#e74c3c",
		        color: "white",
		        border: "none",
		        padding: "8px 16px",
		        borderRadius: "6px",
		        cursor: "pointer",
		    }} onClick={() => {
		        const newPages = [...pages];
		        const pageIndex = currentPage; // 注意 PageCover 占位
		        if (newPages[pageIndex] && newPages[pageIndex].text) {
		            let sentences = newPages[pageIndex].text.split(".").filter(s => s.trim() !== "");
		            if (sentences.length > 0) {
		                sentences.pop(); // 删除最后一句
		                newPages[pageIndex].text = sentences.join(". ") + (sentences.length ? "." : "");
		                setPages(newPages);
		            }
		        }
		    }}>
		        删除最后一句
		    </button>
		</div>
		)}


		{/* <p style={{ textAlign: "center" }}>当前页：第 {currentPage + 1} 页</p> */}
		</div>
		</div>
	);
}

export default MyAlbum;
