/* global Vosk, CryptoJS */
import HTMLFlipBook from "react-pageflip";
import React, { useState, useRef } from "react";
import bg from './bg.jpg';
import "./App.css";


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
          // style={{
          //   maxWidth: "100%",
          //   maxHeight: "100%",
          //   objectFit: "contain",
          //   display: "block",
          //   margin: "0 auto",
          // }}
        />
      )}
      
      {text && (
        <p className="cartoon-text" style={{ whiteSpace: "pre-wrap" }}>
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

function mergeFloat32Arrays(chunks) {
  const length = chunks.reduce((acc, val) => acc + val.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}



// 🔹 新增：将 Float32Array 转为 WAV Blob
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  const write16 = (offset, value) => view.setUint16(offset, value, true);
  const write32 = (offset, value) => view.setUint32(offset, value, true);

  writeString(view, 0, 'RIFF');
  write32(4, 36 + samples.length * 2);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  write32(16, 16);
  write16(20, 1);
  write16(22, 1);
  write32(24, sampleRate);
  write32(28, sampleRate * 2);
  write16(32, 2);
  write16(34, 16);
  writeString(view, 36, 'data');
  write32(40, samples.length * 2);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}


// ********** 工具函数 **********
const Utils = {
  str2ab: str => new TextEncoder().encode(str),

  ab2hex: buffer => Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0')).join(''),

  sha256: async (message) => {
    const buffer = await crypto.subtle.digest("SHA-256", Utils.str2ab(message));
    return Utils.ab2hex(buffer);
  },

  hmacSha256: (message, key) => CryptoJS.HmacSHA256(message, key),

  hmacSha256Hex: async (message, key) => {
    const sig = Utils.hmacSha256(message, key);
    return sig.toString(CryptoJS.enc.Hex);
  },

  getDate: (timestamp) => {
    const d = new Date(timestamp * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = ("0" + (d.getUTCMonth() + 1)).slice(-2);
    const dd = ("0" + d.getUTCDate()).slice(-2);
    return `${yyyy}-${mm}-${dd}`;
  }
};

// ********** video2text 函数 **********
async function video2text(audio_base64) {
  // 配置信息
  const SECRET_ID = "AKIDplU4RaWFmIpESTHrDOOH1ay97rQoMzUp";
  const SECRET_KEY = "ABziFdpnbFj183kDf1GI8lBPPGwRjofI";
  const TOKEN = "";
  const host = "asr.tencentcloudapi.com";
  const service = "asr";
  const region = "";
  const action = "SentenceRecognition";
  const version = "2019-06-14";

  const payload = JSON.stringify({
    EngSerViceType: "8k_en",
    SourceType: 1,
    VoiceFormat: "wav",
    Data: audio_base64
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = Utils.getDate(timestamp);
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedRequestPayload = await Utils.sha256(payload);

  const canonicalRequest = [
    "POST",
    "/",
    "",
    "content-type:application/json; charset=utf-8\nhost:asr.tencentcloudapi.com\nx-tc-action:sentencerecognition\n",
    signedHeaders,
    hashedRequestPayload
  ].join("\n");

  const hashedCanonicalRequest = await Utils.sha256(canonicalRequest);
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join("\n");

  // 计算签名
  const kDate = Utils.hmacSha256(date, "TC3" + SECRET_KEY);
  const kService = Utils.hmacSha256(service, kDate);
  const kSigning = Utils.hmacSha256("tc3_request", kService);
  const signature = await Utils.hmacSha256Hex(stringToSign, kSigning);

  const authorization = `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    Authorization: authorization,
    "Content-Type": "application/json; charset=utf-8",
    Host: host,
    "X-TC-Action": action,
    "X-TC-Timestamp": timestamp,
    "X-TC-Version": version
  };
  if (region) headers["X-TC-Region"] = region;
  if (TOKEN) headers["X-TC-Token"] = TOKEN;

  // 发送请求
  const res = await fetch(`https://proxy-myebook.chenyang5588.workers.dev/tencent-asr`, {
    method: "POST",
    headers,
    body: payload
  });

  const data = await res.json();

  // 提取 Response.Result
  return data.Response?.Result || "";
}



function MyAlbum() {
	const bookRef = useRef();
	const [currentPage, setCurrentPage] = useState(0);
	const [isListeningLeft, setIsListeningLeft] = useState(false);
	const [isListeningRight, setIsListeningRight] = useState(false);
	const [isModelLoading, setIsModelLoading] = useState(false);
	  // ✅ 新增：录音数据缓存
  	const recordedChunksRef = useRef([]);  
	const modelRef = useRef(null);  // 🔹 保存全局模型
	
	// const [pages, setPages] = useState([
	// 	{ text: "第一页内容", image: null },
	// 	{ text: "第二页内容", image: null },
	// 	{ text: "第三页内容", image: null },
	// 	{ text: "第四页内容", image: null },
	// ]);

	const [pages, setPages] = useState([
	  { text: "", image: null, isCover: true },
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

			// ✅ 导出 WAV 文件
			if (recordedChunksRef.current.length > 0) {
				const merged = mergeFloat32Arrays(recordedChunksRef.current);
				const wavBlob = encodeWAV(merged, 48000);
				// 将 Blob 转为 Base64 并打印
				const reader = new FileReader();
				reader.onloadend = () => {
				    const base64data = reader.result.split(",")[1];
					const maxSize = 3 * 1024 * 1024; // 3MB
					if (base64data.length > maxSize) {
						alert("录制时间太长啦，请短一点");
						return;
					}
				    video2text(base64data).then(textRes => {
						        // alert(textRes);
								const newPages = [...pages];
								// 🔹 对当前页对象做一次浅拷贝，避免修改原对象引用
								const current = { ...newPages[currentPage] }; 
								
								let textOld = '';
								if (current && current.text){
									textOld = current.text;
									if (!textOld || textOld === "" || textOld.includes('内容')){
										textOld = '';
									} 
								}
								
								let raw = textRes.trim();
								let textNew = `${raw} `;
								
								if (textNew !== ' '){
									textNew = textOld + textNew;
									current.text = textNew;
								
									// 🔹 更新数组中的当前页对象
									newPages[currentPage] = current;
									setPages(newPages);
								}
								
							}).catch(err => {
								alert("video2text 错误:", err);
							});
						};
				
					reader.readAsDataURL(wavBlob);	
					
					// 清空缓存
					recordedChunksRef.current = [];
			}

			console.log("🟥 录音已停止");
		} catch (err) {
			console.error("停止录音失败:", err);
		}
	};

	// ✅ 启动语音识别（Vosklet）
	const startSpeechRecognition = async (side) => {
		try {

			// 如果模型正在加载
			// if (isModelLoading) {
			// 	alert("模型加载中，请稍后...");
			// 	return;
			// }
		
		    if ((side === "left" && isListeningLeft) || (side === "right" && isListeningRight)) return;
		
		    // if (!modelRef.current) {
	        //     setIsModelLoading(true);
	        //     modelRef.current = await Vosk.createModel(
	        //         "https://myebook-1257475696.cos.ap-shanghai.myqcloud.com/vosk-model-small-en-us-0.15.zip"
	        //     );
	        //     setIsModelLoading(false);
	        //     console.log("✅ 模型加载完成");
        	// }
			// const recognizer = new modelRef.current.KaldiRecognizer(48000);
			// recognizer.setWords(true);
		    // recognizer.on("result", (message) => {
		    //     console.log(`Result: ${message.result.text}`);
			// 	const newPages = [...pages];
			// 	// 🔹 对当前页对象做一次浅拷贝，避免修改原对象引用
			// 	const current = { ...newPages[currentPage] }; 
				
			// 	let textOld = '';
			// 	if (current && current.text){
			// 		textOld = current.text;
			// 		if (!textOld || textOld === "" || textOld.includes('内容')){
			// 			textOld = '';
			// 		} 
			// 	}
				
			// 	let raw = message.result.text.trim();
			// 	if (raw.length > 0) {
			// 	  raw = raw.charAt(0).toUpperCase() + raw.slice(1);
			// 	}
			// 	let textNew = `${raw}. `;
				
			// 	if (textNew !== '. '){
			// 		if (textOld.endsWith(textNew)){
			// 			console.log(`重复内容： ${textNew}, 过滤掉`);
			// 			return;
			// 		}
			// 		textNew = textOld + textNew;
			// 		current.text = textNew;
				
			// 		// 🔹 更新数组中的当前页对象
			// 		newPages[currentPage] = current;
			// 		setPages(newPages);
			// 	}

		    // });
		    // recognizer.on("partialresult", (message) => {
		    //     console.log(`Partial result: ${message.result.partial}`);
				
		    // });				

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
    			// recognizer.acceptWaveform(audioBuffer); // Vosk 正确类型

			// ✅ 保存音频数据块
			  const channelData = audioBuffer.getChannelData(0);
			  recordedChunksRef.current.push(new Float32Array(channelData));
	        };
	
	        source.connect(processor);
	        processor.connect(audioContext.destination);


			// ✅ 保存上下文
	        audioCtxRef.current = audioContext;
	        micStreamRef.current = mediaStream;
	        // recognizerRef.current = recognizer;
	
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
