"use client";

import { useRef, useState, useCallback } from "react";

interface AudioCaptureOptions {
  onAudioChunk: (pcmBase64: string) => void;
  sampleRate?: number;
}

// AudioWorklet processor: collects samples into ~40ms frames and emits Int16 PCM.
// No resampling here — the AudioContext itself runs at the target rate (16kHz),
// so the browser's built-in high-quality resampler handles 48→16 conversion
// with proper anti-aliasing. Doing it in JS via linear interpolation causes
// the "rauschen" / Thai-recognition artifacts.
const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const targetRate = options.processorOptions.targetSampleRate;
    // ~40ms of audio at target rate
    this.frameSize = Math.round(targetRate * 0.04);
    this.buffer = new Float32Array(this.frameSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex++] = channel[i];
      if (this.bufferIndex >= this.frameSize) {
        const int16 = new Int16Array(this.frameSize);
        for (let j = 0; j < this.frameSize; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
        this.bufferIndex = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useAudioCapture(options: AudioCaptureOptions) {
  const { onAudioChunk, sampleRate = 16000 } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const workletUrlRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    streamRef.current = stream;

    // Run the AudioContext at the target sample rate — the browser will
    // resample the 48kHz mic stream with a proper anti-aliasing filter.
    const audioContext = new AudioContext({
      sampleRate,
      latencyHint: "interactive",
    });
    contextRef.current = audioContext;

    const workletBlob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(workletBlob);
    workletUrlRef.current = workletUrl;
    await audioContext.audioWorklet.addModule(workletUrl);

    const source = audioContext.createMediaStreamSource(stream);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    source.connect(analyser);

    const worklet = new AudioWorkletNode(audioContext, "capture-processor", {
      processorOptions: { targetSampleRate: sampleRate },
    });
    workletRef.current = worklet;

    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const base64 = arrayBufferToBase64(event.data);
      onAudioChunk(base64);
    };

    source.connect(worklet);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    worklet.connect(silentGain).connect(audioContext.destination);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    setIsRecording(true);
  }, [onAudioChunk, sampleRate]);

  const stop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (workletRef.current) {
      workletRef.current.disconnect();
      workletRef.current.port.onmessage = null;
      workletRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close();
      contextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (workletUrlRef.current) {
      URL.revokeObjectURL(workletUrlRef.current);
      workletUrlRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  return { isRecording, audioLevel, start, stop };
}
