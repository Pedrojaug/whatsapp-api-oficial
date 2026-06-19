import { useEffect, useRef } from "react";

/**
 * Hook para se inscrever em atualizações de mensagens em tempo real (Server-Sent Events)
 * @param onMessageUpdated Callback disparado a cada nova atualização
 */
export function useSSE(onMessageUpdated: (data: any) => void) {
  const callbackRef = useRef(onMessageUpdated);

  useEffect(() => {
    callbackRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      callbackRef.current(customEvent.detail);
    };

    window.addEventListener("messageUpdated", handler);

    return () => {
      window.removeEventListener("messageUpdated", handler);
    };
  }, []);
}
