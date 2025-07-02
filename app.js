// Web-based Push-Up Counter using TensorFlow.js and MoveNet
// Requirements: TensorFlow.js, @tensorflow-models/pose-detection

import React, { useRef, useEffect, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const [counter, setCounter] = useState(0);
  const [status, setStatus] = useState("");
  const detectorRef = useRef(null);
  const lastStageRef = useRef("up");

  useEffect(() => {
    const loadModel = async () => {
      const detector = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        { modelType: 'SinglePose.Lightning' }
      );
      detectorRef.current = detector;
      runDetection();
    };

    const setupCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    };

    setupCamera();
    loadModel();
  }, []);

  const getAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const runDetection = async () => {
    if (!videoRef.current || !detectorRef.current) return;

    setInterval(async () => {
      const poses = await detectorRef.current.estimatePoses(videoRef.current);
      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;

        const shoulder = keypoints.find(p => p.name === 'right_shoulder');
        const elbow = keypoints.find(p => p.name === 'right_elbow');
        const wrist = keypoints.find(p => p.name === 'right_wrist');

        if (shoulder && elbow && wrist) {
          const angle = getAngle(shoulder, elbow, wrist);
          if (angle < 90) {
            setStatus("Down");
            if (lastStageRef.current === "up") {
              lastStageRef.current = "down";
            }
          } else if (angle > 160) {
            setStatus("Up");
            if (lastStageRef.current === "down") {
              setCounter(prev => prev + 1);
              lastStageRef.current = "up";
            }
          }
        }
      }
    }, 200);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <video ref={videoRef} width="640" height="480" className="rounded-xl shadow-lg" />
      <div className="mt-4 text-center">
        <h2 className="text-xl font-bold">Push-Up Count: {counter}</h2>
        <p className="text-md text-gray-500">Status: {status}</p>
      </div>
    </div>
  );
}
