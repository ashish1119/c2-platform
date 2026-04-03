import { useCallback, useEffect, useRef, useState } from "react";
import { resolveBackendWsUrl } from "../../../api/ws";

export type WsChannelStatus = "connecting" | "live" | "reconnecting" | "closed";

export type WsHealth = {
  smsLive: WsChannelStatus;
  rfLive: WsChannelStatus;
  alertsLive: WsChannelStatus;
};

function resolveSmsLiveWsUrl(): string {
  return resolveBackendWsUrl("/sms/ws/live");
}

function resolveAlertsWsUrl(): string {
  return resolveBackendWsUrl("/ws/alerts");
}

const WS_RECONNECT_BASE_MS = 1200;
const WS_RECONNECT_MAX_MS = 10000;

interface UseWsHealthOptions {
  enabled: boolean;
  onSmsMessage?: (event: MessageEvent) => void;
  onRfMessage?: (event: MessageEvent) => void;
  onAlertsMessage?: (event: MessageEvent) => void;
}

export function useWsHealth({
  enabled,
  onSmsMessage,
  onRfMessage,
  onAlertsMessage,
}: UseWsHealthOptions): WsHealth {
  const [smsLive, setSmsLive] = useState<WsChannelStatus>("connecting");
  const [rfLive, setRfLive] = useState<WsChannelStatus>("connecting");
  const [alertsLive, setAlertsLive] = useState<WsChannelStatus>("connecting");

  const smsSocketRef = useRef<WebSocket | null>(null);
  const smsReconnectRef = useRef<number | null>(null);
  const smsAttemptRef = useRef(0);

  const rfSocketRef = useRef<WebSocket | null>(null);
  const rfReconnectRef = useRef<number | null>(null);
  const rfAttemptRef = useRef(0);

  const alertsSocketRef = useRef<WebSocket | null>(null);

  // ─── SMS live channel ──────────────────────────────────────────────────────
  const connectSms = useCallback(() => {
    if (!enabled) return;
    setSmsLive("connecting");

    const ws = new WebSocket(resolveSmsLiveWsUrl());
    smsSocketRef.current = ws;

    ws.onopen = () => {
      smsAttemptRef.current = 0;
      setSmsLive("live");
    };

    ws.onmessage = (ev) => {
      onSmsMessage?.(ev);
    };

    ws.onclose = () => {
      if (smsSocketRef.current !== ws) return;
      smsSocketRef.current = null;
      setSmsLive("reconnecting");

      const attempt = smsAttemptRef.current + 1;
      smsAttemptRef.current = attempt;
      const delay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** (attempt - 1));
      smsReconnectRef.current = window.setTimeout(() => connectSms(), delay);
    };

    ws.onerror = () => ws.close();
  }, [enabled, onSmsMessage]);

  // ─── RF live channel ───────────────────────────────────────────────────────
  const connectRf = useCallback(() => {
    if (!enabled) return;
    setRfLive("connecting");

    const ws = new WebSocket(resolveBackendWsUrl("/ws/rf"));
    rfSocketRef.current = ws;

    ws.onopen = () => {
      rfAttemptRef.current = 0;
      setRfLive("live");
    };

    ws.onmessage = (ev) => {
      onRfMessage?.(ev);
    };

    ws.onclose = () => {
      if (rfSocketRef.current !== ws) return;
      rfSocketRef.current = null;
      setRfLive("reconnecting");

      const attempt = rfAttemptRef.current + 1;
      rfAttemptRef.current = attempt;
      const delay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** (attempt - 1));
      rfReconnectRef.current = window.setTimeout(() => connectRf(), delay);
    };

    ws.onerror = () => ws.close();
  }, [enabled, onRfMessage]);

  // ─── Alerts channel (no reconnect – alerts WS is lower priority) ───────────
  useEffect(() => {
    if (!enabled) {
      setAlertsLive("closed");
      return;
    }

    const ws = new WebSocket(resolveAlertsWsUrl());
    alertsSocketRef.current = ws;
    setAlertsLive("connecting");

    ws.onopen = () => setAlertsLive("live");
    ws.onmessage = (ev) => onAlertsMessage?.(ev);
    ws.onclose = () => setAlertsLive("closed");
    ws.onerror = () => ws.close();

    return () => {
      ws.close();
      alertsSocketRef.current = null;
    };
  }, [enabled, onAlertsMessage]);

  // ─── SMS channel lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setSmsLive("closed");
      return;
    }

    connectSms();

    return () => {
      if (smsReconnectRef.current !== null) {
        window.clearTimeout(smsReconnectRef.current);
        smsReconnectRef.current = null;
      }
      smsSocketRef.current?.close();
      smsSocketRef.current = null;
    };
  }, [enabled, connectSms]);

  // ─── RF channel lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setRfLive("closed");
      return;
    }

    connectRf();

    return () => {
      if (rfReconnectRef.current !== null) {
        window.clearTimeout(rfReconnectRef.current);
        rfReconnectRef.current = null;
      }
      rfSocketRef.current?.close();
      rfSocketRef.current = null;
    };
  }, [enabled, connectRf]);

  return { smsLive, rfLive, alertsLive };
}
