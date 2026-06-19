import { useEffect, useRef } from "react";

/**
 * Hook para se inscrever em atualizações de mensagens em tempo real (Server-Sent Events)
 * @param onMessageUpdated Callback disparado a cada nova atualização de mensagem
 * @param onConnected Callback opcional disparado quando o SSE conecta ou reconecta
 */
export function useSSE(onMessageUpdated: (data: any) => void, onConnected?: () => void) {
  const callbackRef = useRef(onMessageUpdated);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    callbackRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    const messageHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      callbackRef.current(customEvent.detail);
    };

    const connectedHandler = () => {
      onConnectedRef.current?.();
    };

    window.addEventListener("messageUpdated", messageHandler);
    window.addEventListener("sseConnected", connectedHandler);

    return () => {
      window.removeEventListener("messageUpdated", messageHandler);
      window.removeEventListener("sseConnected", connectedHandler);
    };
  }, []);
}
