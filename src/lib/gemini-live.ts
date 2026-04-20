// ── Gemini Live API Client ─────────────────────────────────────────────────
// WebSocket-based real-time audio streaming with Gemini 2.0 Flash.
// Used by the Voice Agent for Content Interviews.

import {
  GoogleGenAI,
  type LiveServerMessage,
  type FunctionDeclaration,
  Modality,
} from "@google/genai";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

export interface TranscriptEntry {
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export interface VoiceSessionConfig {
  clientId: string;
  systemPrompt: string;
  tools: FunctionDeclaration[];
  languageCode?: string; // e.g. "de-DE" | "en-US". Defaults to "de-DE".
  voiceName?: string; // Gemini Live prebuilt voice name. Defaults to "Kore".
  onAudioOutput: (audioBase64: string) => void;
  onTranscript: (role: "user" | "model", text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>;
  onInterrupted: () => void;
  onError: (error: Error) => void;
}

export class GeminiLiveSession {
  private session: Awaited<ReturnType<InstanceType<typeof GoogleGenAI>["live"]["connect"]>> | null = null;
  private transcript: TranscriptEntry[] = [];
  private config: VoiceSessionConfig | null = null;
  private closed = false;
  private setupCompleteResolve: (() => void) | null = null;
  private setupCompletePromise: Promise<void> | null = null;

  async connect(config: VoiceSessionConfig): Promise<void> {
    this.config = config;
    this.closed = false;

    this.setupCompletePromise = new Promise((resolve) => {
      this.setupCompleteResolve = resolve;
    });

    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const languageCode = config.languageCode || "de-DE";
    const voiceName = config.voiceName || "Kore";

    this.session = await ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
          languageCode,
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: config.systemPrompt }],
        },
        tools: config.tools.length > 0 ? [{ functionDeclarations: config.tools }] : undefined,
      },
      callbacks: {
        onopen: () => {
          console.log("[gemini] session opened (ws connected)");
        },
        onmessage: (message: LiveServerMessage) => {
          if (message.setupComplete) {
            console.log("[gemini] ✅ setup complete — ready to send");
            this.setupCompleteResolve?.();
          }
          if (message.toolCall?.functionCalls) {
            const names = message.toolCall.functionCalls.map((c) => c.name).join(",");
            console.log(`[gemini] tool call: ${names}`);
          }
          if (message.serverContent?.turnComplete) {
            console.log("[gemini] turn complete");
          }
          this.handleMessage(message);
        },
        onerror: (error: ErrorEvent) => {
          console.error("[gemini] ❌ error:", error.message || error);
          if (!this.closed) {
            config.onError(new Error(error.message || "Gemini Live connection error"));
          }
        },
        onclose: (event: CloseEvent) => {
          console.log(`[gemini] closed code=${event.code} reason=${event.reason}`);
          this.closed = true;
        },
      },
    });

    // Wait for Gemini to send setupComplete before returning — otherwise
    // early sendText/sendClientContent calls get silently dropped.
    const timeoutMs = 10_000;
    await Promise.race([
      this.setupCompletePromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`setupComplete timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private handleMessage(message: LiveServerMessage): void {
    if (!this.config) return;

    // Audio output from Gemini. Ignore `part.text` here — on native-audio/thinking
    // models it contains chain-of-thought, not the spoken words. The actual
    // spoken transcript comes via `outputTranscription` below.
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.config.onAudioOutput(part.inlineData.data);
        }
      }
    }

    // Transcription of Gemini's spoken output — the only reliable transcript source
    const outputText = message.serverContent?.outputTranscription?.text;
    if (outputText) {
      this.addTranscript("model", outputText);
      this.config.onTranscript("model", outputText);
    }

    // Transcription of the user's microphone input
    const inputText = message.serverContent?.inputTranscription?.text;
    if (inputText) {
      this.addTranscript("user", inputText);
      this.config.onTranscript("user", inputText);
    }

    // Turn complete — transcript from model
    if (message.serverContent?.turnComplete) {
      // Turn is complete, nothing extra to do
    }

    // Interrupted — user started talking while model was speaking
    if (message.serverContent?.interrupted) {
      this.config.onInterrupted();
    }

    // Tool calls from Gemini
    if (message.toolCall?.functionCalls) {
      const calls = message.toolCall.functionCalls
        .filter((c) => c.name)
        .map((c) => ({ id: c.id, name: c.name!, args: c.args }));
      this.handleToolCalls(calls);
    }
  }

  private async handleToolCalls(
    functionCalls: Array<{ id?: string; name: string; args?: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.session || !this.config) return;

    const toolResponses: Array<{ id: string; name: string; response: { result: string } }> = [];

    for (const call of functionCalls) {
      const callId = call.id || crypto.randomUUID();
      try {
        const result = await this.config.onToolCall(call.name, call.args || {});
        toolResponses.push({
          id: callId,
          name: call.name,
          response: { result },
        });
      } catch (err) {
        toolResponses.push({
          id: callId,
          name: call.name,
          response: { result: `Error: ${err instanceof Error ? err.message : "Unknown error"}` },
        });
      }
    }

    // Send tool responses back to Gemini
    try {
      await this.session.sendToolResponse({ functionResponses: toolResponses });
    } catch (err) {
      console.error("[gemini] sendToolResponse failed:", err);
      this.config.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async sendAudio(pcmBase64: string): Promise<void> {
    if (!this.session || this.closed) return;

    await this.session.sendRealtimeInput({
      media: {
        data: pcmBase64,
        mimeType: "audio/pcm;rate=16000",
      },
    });
  }

  async sendText(text: string, options: { recordInTranscript?: boolean } = {}): Promise<void> {
    if (!this.session || this.closed) return;

    if (options.recordInTranscript !== false) {
      this.addTranscript("user", text);
    }
    await this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true,
    });
  }

  private addTranscript(role: "user" | "model", text: string): void {
    // Gemini streams transcription in tiny chunks (word fragments). Merge
    // consecutive same-role entries so the saved transcript reads as coherent
    // turns — otherwise Claude's summary sees a disjointed mess of fragments.
    const last = this.transcript[this.transcript.length - 1];
    if (last && last.role === role) {
      last.text += text;
      return;
    }
    this.transcript.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  async close(): Promise<{ transcript: TranscriptEntry[] }> {
    this.closed = true;
    if (this.session) {
      try {
        await this.session.close();
      } catch {
        // Ignore close errors
      }
      this.session = null;
    }
    return { transcript: this.getTranscript() };
  }
}
