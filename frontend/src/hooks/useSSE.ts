import { useEffect } from "react";

/**
 * Hook para se inscrever em atualizações de mensagens em tempo real (Server-Sent Events)
 * @param onMessageUpdated Callback disparado a cada nova atualização
 */
export function useSSE(onMessageUpdated: (data: any) => void) {
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      onMessageUpdated(customEvent.detail);
    };

    window.addEventListener("messageUpdated", handler);

    return () => {
      window.removeEventListener("messageUpdated", handler);
    };
  }, [onMessageUpdated]);
}
