import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { SimulationConfig, SimulationFrame } from "../model/types";
import { RfDfSimulator } from "../simulator/rfDfSimulator";

type SimulationState = {
  running: boolean;
  latestFrame: SimulationFrame | null;
  history: SimulationFrame[];
};

type SimulationAction =
  | { type: "start" }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "frame"; frame: SimulationFrame; historyLimit: number };

const INITIAL_STATE: SimulationState = {
  running: true,
  latestFrame: null,
  history: [],
};

function simulationReducer(state: SimulationState, action: SimulationAction): SimulationState {
  if (action.type === "start") {
    return { ...state, running: true };
  }

  if (action.type === "stop") {
    return { ...state, running: false };
  }

  if (action.type === "reset") {
    return { ...state, latestFrame: null, history: [] };
  }

  const nextHistory = [...state.history, action.frame];
  while (nextHistory.length > action.historyLimit) {
    nextHistory.shift();
  }

  return {
    ...state,
    latestFrame: action.frame,
    history: nextHistory,
  };
}

export function useSignalSimulation(config: SimulationConfig) {
  const [state, dispatch] = useReducer(simulationReducer, INITIAL_STATE);
  const simulatorRef = useRef<RfDfSimulator | null>(null);

  useEffect(() => {
    simulatorRef.current = new RfDfSimulator(config);
  }, []);

  useEffect(() => {
    simulatorRef.current?.updateConfig(config);
  }, [config]);

  useEffect(() => {
    if (!state.running) {
      return;
    }

    const timer = window.setInterval(() => {
      const frame = simulatorRef.current?.step(Date.now());
      if (!frame) {
        return;
      }

      dispatch({ type: "frame", frame, historyLimit: config.historyLimit });
    }, config.updateIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.running, config.updateIntervalMs, config.historyLimit]);

  const start = useCallback(() => {
    dispatch({ type: "start" });
  }, []);

  const stop = useCallback(() => {
    dispatch({ type: "stop" });
  }, []);

  const reset = useCallback(() => {
    simulatorRef.current?.reset();
    dispatch({ type: "reset" });
  }, []);

  const controls = useMemo(
    () => ({
      start,
      stop,
      reset,
    }),
    [start, stop, reset]
  );

  return {
    state,
    controls,
  };
}
