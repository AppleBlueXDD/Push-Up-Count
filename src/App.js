import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";
import { movenet } from "@tensorflow-models/pose-detection";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const lastStageRef = useRef("up");

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [counter, setCounter] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    async function getDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        alert("Cannot access media devices.");
        return;
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    }
    getDevices();
  }, []);

  const setupCamera = async (deviceId) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("getUserMedia is not supported in your browser/environment.");
      return;
    }
    try {
      const constraints = deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
      };
    } catch (err) {
      alert("Error accessing camera: " + err.message);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      setupCamera(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  function getAngle(p1, p2, p3) {
    const angle =
      (Math.atan2(p3.y - p2.y, p3.x - p2.x) -
        Math.atan2(p1.y - p2.y, p1.x - p2.x)) *
      (180 / Math.PI);
    return Math.abs(angle);
  }

  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      const detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
        modelType: movenet.modelType.SINGLEPOSE_LIGHTNING
      });
      detectorRef.current = detector;
    };

    loadModel();
  }, []);

  useEffect(() => {
    if (isStarted && detectorRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const intervalId = setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) return;
        if (
          videoRef.current.videoWidth === 0 ||
          videoRef.current.videoHeight === 0
        )
          return;

        if (
          canvas.width !== videoRef.current.videoWidth ||
          canvas.height !== videoRef.current.videoHeight
        ) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }

        const poses = await detectorRef.current.estimatePoses(videoRef.current);
        if (poses.length > 0) {
          const keypoints = poses[0].keypoints;

          const shoulder = keypoints[6];
          const elbow = keypoints[8];
          const wrist = keypoints[10];

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          if (shoulder && elbow && wrist) {
            ctx.strokeStyle = "red";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(shoulder.x, shoulder.y);
            ctx.lineTo(elbow.x, elbow.y);
            ctx.lineTo(wrist.x, wrist.y);
            ctx.stroke();

            const angle = getAngle(shoulder, elbow, wrist);
            let pct = ((160 - angle) / (160 - 90)) * 100;
            pct = Math.min(100, Math.max(0, pct));
            setProgress(pct);

            if (angle < 90) {
              setStatus("Down");
              if (lastStageRef.current === "up") {
                lastStageRef.current = "down";

                const utterance = new SpeechSynthesisUtterance("Down");
                window.speechSynthesis.speak(utterance);
              }
            } else if (angle > 160) {
              setStatus("Up");
              if (lastStageRef.current === "down") {
                setCounter(prev => prev + 1);
                lastStageRef.current = "up";

                const utteranceUp = new SpeechSynthesisUtterance("Up");
                window.speechSynthesis.speak(utteranceUp);
              }
            }
          }

          keypoints.forEach(p => {
            if (p.score > 0.5) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "blue";
              ctx.fill();
            }
          });
        }
      }, 200);

      return () => clearInterval(intervalId);
    }
  }, [isStarted]);

  useEffect(() => {
    if (counter > 0) {
      const utteranceCount = new SpeechSynthesisUtterance(counter.toString());
      window.speechSynthesis.speak(utteranceCount);
    }
  }, [counter]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 font-sans">
      <button
        onClick={() => setIsStarted(true)}
        className="mb-6 px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 transition"
      >
        เริ่มนับ
      </button>
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-3xl w-full flex items-center space-x-10">
        
        {/* กล้องเล็ก ๆ */}
        <div className="flex flex-col items-center">
          <select
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
            className="mb-4 w-full p-2 border border-gray-300 rounded"
          >
            <optgroup label="Available Cameras">
              {devices.filter(d => d.label).map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Unavailable Cameras">
              {devices.filter(d => !d.label).map(device => (
                <option key={device.deviceId} value={device.deviceId} disabled>
                  {`Camera ${device.deviceId} (Unavailable)`}
                </option>
              ))}
            </optgroup>
          </select>

          <video
            ref={videoRef}
            width="100"
            height="75"
            autoPlay
            muted
            className="rounded-lg shadow border border-gray-300"
          />
          <p className="mt-2 text-gray-700 font-medium text-sm">Camera</p>
        </div>
        
        {/* คำ UP / DOWN ตัวใหญ่ตรงกลาง */}
        <div className="flex flex-col items-center flex-1">
          <h1 className="text-[12rem] font-extrabold text-gray-900 select-none leading-none">
            {status.toUpperCase() || "IDLE"}
          </h1>
          <p className="text-4xl font-semibold text-blue-600 mt-4 tracking-wide">
            Count: {counter}
          </p>
        </div>
        
        {/* หลอดแนวตั้งใหญ่ */}
        <div className="flex flex-col items-center">
          <div
            className="relative w-14 h-72 bg-gray-300 rounded-full overflow-hidden shadow-inner"
            title={`Progress: ${Math.round(progress)}%`}
          >
            <div
              className="bg-blue-500 w-full absolute bottom-0 transition-all duration-200"
              style={{ height: `${progress}%` }}
            ></div>
          </div>
          <p className="mt-4 text-5xl font-bold text-blue-700 select-none">
            {Math.round(progress)}%
          </p>
          <p className="text-gray-600 font-medium select-none">Push-Down Progress</p>
        </div>
      </div>
      {/* canvas สำหรับ logic ตรวจจับ */}
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ border: "1px solid red" }}
      />
    </div>
  );
}

export default App;
