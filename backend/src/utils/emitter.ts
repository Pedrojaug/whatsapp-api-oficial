import { EventEmitter } from "events";

export const messageEventEmitter = new EventEmitter();
// Cada conexão SSE registra um listener; elevar o teto evita o
// MaxListenersExceededWarning quando há muitos operadores conectados.
messageEventEmitter.setMaxListeners(100);
