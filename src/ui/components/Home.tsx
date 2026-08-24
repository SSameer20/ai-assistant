import "../App.css";
import { useEffect, useRef, useState } from "react";
import Navigation from "../components/Navigation";
import {
  useScreenshotState,
  useChatState,
  useAppState,
  useAskState,
  useDispatch,
  useAuth,
} from "../store";
import { type QluelyInput, type StreamChunk } from "../lib/types";
import { parseDataUrl } from "../helper/image";
import { CircleX, Send } from "lucide-react";
import Recorder from "./Recorder";
import { MessageRenderer } from "./MessageComponents";
// import type { ChatMessage } from "../store/types";
import { useDebouncedWindowFit, useLayoutMonitor } from "../hooks/useWindowFit";
import { Item, ItemContent, ItemMedia, ItemTitle } from "./ui/item";
import { Spinner } from "./ui/spinner";
import Transcription from "./Transcription";
import Upgrade from "./Upgrade";
import { useNotifications } from "../store";

export default function Home() {
  const resultRef = useRef<HTMLDivElement>(null);
  const processedImageRef = useRef<string | null>(null);

  const {
    currentPrompt,
    result,
    isStreaming,
    accumulatedContent,
    messages,
    streamingMessage,
    setPrompt,
    setResult,
    startStreaming,
    stopStreaming,
    clearContent,
    finalizeStreamingMessage,
    clearMessages,
    processChunk,
  } = useChatState();
  const { image, isCapturing, reset } = useScreenshotState();
  const { isLoading, setLoading } = useAppState();

  const { isAskMode } = useAskState();
  const dispatch = useDispatch();
  const { quotaExhausted, hideQuotaExhausted } = useNotifications();
  // spinner mount
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const { user } = useAuth();

  // Refetch user credits
  const refreshCredits = async () => {
    try {
      if (!user?.email) return;
      const details = await window.auth.getUserDetails();
      if (details) {
        dispatch({ type: "AUTH_UPDATE_USER", payload: details as any });
      }
    } catch (e) {
      console.error("Failed to refresh credits:", e);
    }
  };

  // Always enable content protection — screen-share hiding is permanently on
  useEffect(() => {
    window.protection.setContentProtection(true);
  }, []);

  const content = result || isStreaming || messages.length > 0 || streamingMessage;

  // Use debounced window fitting for better performance
  useDebouncedWindowFit([
    result,
    accumulatedContent,
    isLoading,
    isStreaming,
    isCapturing,
    image,
    currentPrompt,
    messages,
    streamingMessage,
    isAskMode,
    user?.creditsRemaining,
  ]);

  // Monitor layout for overflow issues
  useLayoutMonitor();

  // Handle component mount - clear any stale state
  useEffect(() => {
    // Only clear if we're truly starting fresh (no existing content)
    if (!result && !accumulatedContent && messages.length === 0) {
      clearContent();
      setResult("");
      clearMessages();
    }
    setLoading(false);
    stopStreaming();
  }, [isAskMode]); // Re-run when isAskMode changes

  useEffect(() => {
    const unsubscribeChunk = window.qluely.onChunk((chunk: string | object) => {
      try {
        console.log("Received chunk:", chunk);

        // Parse the JSON chunk
        let parsedChunk: StreamChunk | null = null;
        if (typeof chunk === "string") {
          try {
            parsedChunk = JSON.parse(chunk);
          } catch {
            parsedChunk = { type: "answer", delta: chunk };
          }
        } else {
          parsedChunk = chunk as StreamChunk;
        }

        if (!parsedChunk) return;

        // If chunk has no type but has delta, treat as answer
        if (!parsedChunk.type && (parsedChunk as any).delta) {
          parsedChunk = { type: "answer", delta: (parsedChunk as any).delta };
        }

        if (!parsedChunk.type) return;

        // Ignore start/end types
        if (parsedChunk.type === "start" || parsedChunk.type === "end") {
          return;
        }

        // Generate a stable-ish timestamp and random ID for new messages
        const now = Date.now();
        const chunkId = `${now}-${Math.random().toString(36).substring(2, 9)}`;

        // Process chunk atomically in reducer
        processChunk(parsedChunk, chunkId, now);

        if (resultRef.current) {
          resultRef.current.scrollTop = resultRef.current.scrollHeight;
        }

        // We got a chunk, so the AI has started answering. Hide the "Thinking" spinner.
        setLoading(false);

        // Fit window to content
        window.size.fitToContent();
      } catch (error) {
        console.error("Error processing chunk:", error);
      }
    });

    const unsubscribeEnd = window.qluely.onEnd(() => {
      setLoading(false);
      finalizeStreamingMessage();
      stopStreaming();
      refreshCredits(); // Refresh credits instantly after action
    });

    const unsubscribeQuotaAlert = window.quota.onAlert((event: any) => {
      dispatch({
        type: "NOTIFICATION_SHOW_QUOTA_ALERT",
        payload: { message: event.data.message, remainingCredits: event.data.remainingCredits },
      });
    });

    const unsubscribeQuotaExhausted = window.quota.onExhausted((event: any) => {
      dispatch({
        type: "NOTIFICATION_SHOW_QUOTA_EXHAUSTED",
        payload: { message: event.data.message },
      });
    });

    return () => {
      unsubscribeEnd();
      unsubscribeChunk();
      unsubscribeEnd();
      unsubscribeQuotaAlert();
      unsubscribeQuotaExhausted();
    };
  }, [setLoading, stopStreaming, finalizeStreamingMessage, processChunk, dispatch]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      console.log("Home component unmounting - cleaning up");
      setLoading(false);
      stopStreaming();
      clearContent();
      setResult("");
      clearMessages();
      processedImageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const off = window.qluely.onError((msg) => {
      console.error("AI error:", msg);
      setLoading(false);
      stopStreaming();

      // Show specific error message instead of generic "Please Try Again"
      if (msg && msg.toLowerCase().includes("quota")) {
        setResult("Quota Exhausted - Please upgrade your plan or wait for quota renewal");
      } else if (msg && msg.toLowerCase().includes("authenticate")) {
        setResult("Authentication Error - Please login again");
      } else {
        setResult("Please Try Again");
      }

      refreshCredits(); // Refresh credits even on error in case partial cost applied
      setPrompt("");
      reset();
      // Don't auto-clear image on error - let user decide with clear button
    });

    return () => off(); // cleanup on unmount
  }, [image, reset, setLoading, setPrompt, setResult, stopStreaming]);

  const handleClearScreen = () => {
    setPrompt("");
    setResult("");
    clearContent();
    clearMessages();
    setLoading(false);
  };

  // Handle suggestion clicks
  const handleSuggestionClick = (suggestionText: string) => {
    if (isLoading) return;

    handleClearScreen();
    setLoading(true);
    startStreaming();
    const payload: QluelyInput = { type: "text", text: suggestionText };
    window.qluely.start(payload);
  };

  const sendImage = async (imgData?: string) => {
    try {
      const imageToSend = imgData || image;
      if (!imageToSend) return;

      // Check credits
      if (user?.imageCredits === 0) return;

      // Mark this image as processed
      processedImageRef.current = imageToSend;

      setLoading(true);
      startStreaming();
      setResult(""); // Clear previous results
      clearContent(); // Reset global buffer
      clearMessages(); // Clear message history
      const promptToSend = `Analyse the Image and Provide output based on query=${currentPrompt}. If query is empty just analyse the image if related to any coding environment just respond based on the scenario if not just reply relatively `;

      const parsedImage = parseDataUrl(imageToSend);

      let payload: QluelyInput = {
        type: "image",
        text: promptToSend,
        image: { base64: parsedImage?.base64!, mimeType: parsedImage?.mimeType! },
      };
      window.qluely.start(payload);
    } catch (error) {
      setPrompt("");
      setResult("Error: " + (error instanceof Error ? error.message : String(error)));
      setLoading(false);
      stopStreaming();
    }
  };

  const send = async () => {
    if (!currentPrompt.trim() && !image) return;

    const promptToSend = currentPrompt.trim();

    try {
      // Clear prompt immediately
      setPrompt("");

      setLoading(true);
      startStreaming();
      setResult(""); // Clear previous results
      clearContent(); // Reset global buffer
      clearMessages(); // Clear message history

      console.log("Sending prompt:", promptToSend);

      let payload: QluelyInput = { type: "text", text: promptToSend };

      window.qluely.start(payload);
    } catch (error) {
      console.error("IPC Error:", error);
      // Restore prompt on error
      setPrompt(promptToSend);
      setResult("Error: Please Try Again");

      stopStreaming();
      setLoading(false);
    }
  };

  const handleExplicitSend = () => {
    if (image) {
      sendImage();
    } else send();
  };

  const handleTranscriptionAnswer = (text: string) => {
    setPrompt("");
    setLoading(true);
    startStreaming();
    setResult("");
    clearContent();
    clearMessages();

    // Stop recorder if it's running
    dispatch({ type: "REQUEST_STOP_RECORDING" });

    window.transcription.sendAudioMessage(text);
  };

  const [hasDismissedExhaustion, setHasDismissedExhaustion] = useState(false);

  const creditsExhausted = user?.creditsRemaining === 0 && user?.imageCredits === 0;

  // Reset dismissal when credits are refilled
  useEffect(() => {
    if (!creditsExhausted) {
      setHasDismissedExhaustion(false);
    }
  }, [creditsExhausted]);

  const showUpgrade = quotaExhausted?.visible || (creditsExhausted && !hasDismissedExhaustion);

  const handleCloseUpgrade = () => {
    hideQuotaExhausted();
    if (creditsExhausted) {
      setHasDismissedExhaustion(true);
    }
    setLoading(false);
    stopStreaming();
  };

  if (showUpgrade)
    return (
      <div
        className="flex flex-col gap-3 p-6 bg-transparent w-full h-full min-w-150 items-center"
        data-main-container
      >
        <Upgrade onClose={handleCloseUpgrade} />
      </div>
    );

  return (
    <div
      className="flex flex-col gap-3 p-6 bg-transparent w-full h-full min-w-150 items-center overflow-hidden"
      data-main-container
    >
      {/* Upgrade Overlay */}

      {/* --- Top Control Bar --- */}
      {isAskMode && <Navigation send={sendImage} disabled={user?.imageCredits === 0} />}

      {isAskMode && (
        <div
          id="qluely-main-card"
          className="w-full h-full min-h-0 flex-1 p-5 bg-zinc-900/65 backdrop-blur-2xl border border-white/15 rounded-2xl text-white flex flex-col gap-4"
        >
          <>
            <div className="flex items-center gap-3 justify-center">
              {/* System audio recorder */}
              <Recorder disabled={user?.audioCredits == 0} />

              <div className="flex-1 flex items-center justify-center gap-1">
                <input
                  type="text"
                  value={currentPrompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask anything"
                  disabled={isLoading}
                  className="w-full py-1.5 px-4 bg-black/20 border border-white/10 rounded-sm outline-none focus:border-white/30 transition-all text-sm placeholder:text-zinc-500 disabled:opacity-50"
                />
                {currentPrompt && image ? (
                  <button
                    className="mx-2 flex items-center gap-0.5 h-3 hover:opacity-70 transition-opacity disabled:opacity-30 text-white/70 hover:text-white"
                    onClick={handleExplicitSend}
                    disabled={isLoading || (!currentPrompt.trim() && !image)}
                    aria-label="Send message"
                  >
                    <Send size={16} fill="white" />
                  </button>
                ) : (
                  <button
                    className="mx-2 flex items-center gap-0.5 h-3 hover:opacity-70 transition-opacity disabled:opacity-30 text-white/70 hover:text-white"
                    onClick={handleExplicitSend}
                    disabled={isLoading}
                    aria-label="Send image"
                  >
                    <Send size={16} fill="white" />
                  </button>
                )}
              </div>
            </div>

            <Transcription onAnswer={handleTranscriptionAnswer} />
          </>

          {/* Divider */}
          {content && <div className="h-px bg-white/10 -mx-5" />}

          {/* Content display - React components */}
          {content && (
            <div className="ai-content flex-1 min-h-20 max-w-[80vw] relative">
              {/* Loading indicator */}
              {hasMounted && isLoading && (
                <Item variant="default">
                  <ItemMedia>
                    <Spinner />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="line-clamp-1">Thinking</ItemTitle>
                  </ItemContent>
                </Item>
              )}
              {!isLoading && (
                <button
                  className="absolute -top-3 -right-4 cursor-pointer opacity-50 hover:opacity-100 transition-opacity z-10"
                  onClick={handleClearScreen}
                >
                  <CircleX size={18} />
                </button>
              )}
              <div
                ref={resultRef}
                className="text-white/90 text-sm overflow-auto w-full h-full space-y-2"
                style={{
                  minHeight: "60px",
                  maxWidth: "100%",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {/* Render finalized messages */}
                {messages.map((message) => {
                  return (
                    <MessageRenderer
                      key={message.id}
                      message={message}
                      onSuggestionClick={handleSuggestionClick}
                    />
                  );
                })}

                {/* Render streaming message */}
                {streamingMessage && (
                  <MessageRenderer
                    message={streamingMessage}
                    onSuggestionClick={handleSuggestionClick}
                  />
                )}

                {/* Fallback to legacy HTML content if needed */}
                {!messages.length && !streamingMessage && result && (
                  <div dangerouslySetInnerHTML={{ __html: result }} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
