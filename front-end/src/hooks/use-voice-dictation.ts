import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Wraps expo-speech-recognition into a simple draft-oriented hook.
 *
 * - Requests mic + speech permissions on first start
 * - Streams interim results into the draft so the user sees the text appear live
 * - Auto-stops once the final result event fires (iOS and Android behave equivalently)
 * - Falls back gracefully on Expo Go or unsupported devices — in those cases
 *   `supported` is false and start() becomes a no-op with a helpful error
 *
 * NOTE: The native module requires a dev client build (`npx expo run:ios` or
 * `npx expo run:android`). In Expo Go the require will throw, which we catch
 * below, leaving the feature disabled without crashing the app.
 */

interface UseVoiceDictationOptions {
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  /** Called with the current transcript (partial or final) so the draft updates live. */
  onInterimTranscript: (text: string) => void;
  language?: string;
}

interface NativeModuleShape {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: {
    lang?: string;
    interimResults?: boolean;
    continuous?: boolean;
    requiresOnDeviceRecognition?: boolean;
    addsPunctuation?: boolean;
  }) => void;
  stop: () => void;
}

interface NativeHelpers {
  module: NativeModuleShape;
  useSpeechRecognitionEvent: <K extends 'start' | 'end' | 'result' | 'error'>(
    eventName: K,
    listener: (event: any) => void,
  ) => void;
}

function loadNative(): NativeHelpers | null {
  try {
    const mod = require('expo-speech-recognition');
    if (!mod?.ExpoSpeechRecognitionModule || !mod?.useSpeechRecognitionEvent) {
      return null;
    }
    return {
      module: mod.ExpoSpeechRecognitionModule as NativeModuleShape,
      useSpeechRecognitionEvent: mod.useSpeechRecognitionEvent,
    };
  } catch {
    return null;
  }
}

const NATIVE = loadNative();

// Fallback hook used when the native module isn't available (e.g. Expo Go).
// Satisfies the rules-of-hooks contract by registering no listeners.
function useNoop(_event: string, _listener: (event: any) => void) {
  // intentionally empty
}

export function useVoiceDictation({
  onFinalTranscript,
  onError,
  onInterimTranscript,
  language = 'en-US',
}: UseVoiceDictationOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const bufferRef = useRef('');
  // iOS SFSpeechRecognizer keeps delivering trailing 'result' events for a few
  // hundred ms after we call stop(). Without this flag, those late results
  // would re-populate the text input the user just cleared/sent.
  const suppressResultsRef = useRef(false);

  const useSpeechRecognitionEvent = NATIVE?.useSpeechRecognitionEvent ?? useNoop;

  useEffect(() => {
    // "supported" only gates the fallback-error messaging. We intentionally DO
    // NOT call isRecognitionAvailable() here — on iOS simulator it returns
    // false (no on-device model), which would incorrectly disable the mic
    // button even though network-based recognition still works fine.
    setSupported(Boolean(NATIVE));
  }, []);

  useSpeechRecognitionEvent('start', () => {
    bufferRef.current = '';
    suppressResultsRef.current = false;
    setListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const finalText = bufferRef.current.trim();
    // Skip the final callback if stop() was called as part of a send flow —
    // the caller already has the text.
    if (finalText && !suppressResultsRef.current && onFinalTranscript) {
      onFinalTranscript(finalText);
    }
    bufferRef.current = '';
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    if (suppressResultsRef.current) return;
    const first = event?.results?.[0];
    if (!first) return;
    const transcript = first.transcript ?? '';
    bufferRef.current = transcript;
    onInterimTranscript(transcript);
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    setListening(false);
    suppressResultsRef.current = true;
    if (onError) {
      onError(event?.message ?? event?.error ?? 'Speech recognition error');
    }
  });

  const start = useCallback(async () => {
    if (listening) return;
    if (!NATIVE) {
      onError?.(
        'Voice dictation requires a dev build. Run `npx expo run:ios` or `npx expo run:android`.',
      );
      return;
    }
    try {
      const { granted } = await NATIVE.module.requestPermissionsAsync();
      if (!granted) {
        onError?.(
          Platform.select({
            ios: 'Enable Microphone and Speech Recognition for NuTradish in Settings to dictate.',
            android: 'Enable Microphone access for NuTradish to dictate.',
            default: 'Microphone permission is required to dictate.',
          })!,
        );
        return;
      }
      bufferRef.current = '';
      suppressResultsRef.current = false;
      NATIVE.module.start({
        lang: language,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (e) {
      setListening(false);
      onError?.(e instanceof Error ? e.message : 'Could not start dictation.');
    }
  }, [language, listening, onError]);

  const stop = useCallback(() => {
    // Flip suppression FIRST so any late 'result' events after stop() fires
    // don't re-populate the input.
    suppressResultsRef.current = true;
    setListening(false);
    if (!NATIVE) return;
    try {
      NATIVE.module.stop();
    } catch {
      // no-op — module will fire 'end' regardless
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return { listening, supported, start, stop, toggle };
}
