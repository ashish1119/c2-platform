import type {
  ActiveSignal,
  BearingMeasurement,
  DfVector,
  SignalEmitterConfig,
  SimulationConfig,
  SimulationEvent,
  SimulationFrame,
  SpectrumBin,
  WaveformPoint,
} from "../model/types";
import {
  bearingFromTo,
  destinationPoint,
  distanceMetersBetween,
  normalizeBearing,
  solveTriangulation,
} from "./dfTriangulation";

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  gaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

const TWO_PI = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toLinearScale(powerDbm: number, noiseFloorDbm: number): number {
  const normalized = Math.pow(10, (powerDbm - noiseFloorDbm) / 20);
  return clamp(normalized, 0, 4);
}

export class RfDfSimulator {
  private config: SimulationConfig;
  private random: SeededRandom;
  private startedAtMs: number;
  private eventCounter = 0;
  private phaseByEmitter = new Map<string, number>();

  constructor(config: SimulationConfig) {
    this.config = config;
    this.random = new SeededRandom(config.seed);
    this.startedAtMs = Date.now();
    this.initializeEmitterPhases();
  }

  updateConfig(nextConfig: SimulationConfig): void {
    this.config = nextConfig;

    for (const emitter of nextConfig.emitters) {
      if (!this.phaseByEmitter.has(emitter.id)) {
        this.phaseByEmitter.set(emitter.id, this.random.next() * TWO_PI);
      }
    }

    const configuredIds = new Set(nextConfig.emitters.map((emitter) => emitter.id));
    for (const id of this.phaseByEmitter.keys()) {
      if (!configuredIds.has(id)) {
        this.phaseByEmitter.delete(id);
      }
    }
  }

  reset(seed?: number): void {
    this.random = new SeededRandom(seed ?? this.config.seed);
    this.startedAtMs = Date.now();
    this.eventCounter = 0;
    this.phaseByEmitter.clear();
    this.initializeEmitterPhases();
  }

  step(timestampMs = Date.now()): SimulationFrame {
    const elapsedSeconds = (timestampMs - this.startedAtMs) / 1000;

    const trackedEmitterId = this.resolveTrackedEmitterId();
    const emitterById = new Map(this.config.emitters.map((emitter) => [emitter.id, emitter]));
    const activeSignals = this.config.emitters
      .filter((emitter) => emitter.enabled !== false)
      .map((emitter) => this.sampleEmitterState(emitter, elapsedSeconds, emitter.id === trackedEmitterId));

    const spectrum = this.buildSpectrum(activeSignals);
    const waveform = this.buildWaveform(activeSignals, elapsedSeconds);
    const bearingsByEmitter = new Map<string, BearingMeasurement[]>();
    const bearings: BearingMeasurement[] = [];

    for (const signal of activeSignals) {
      const emitterBearings = this.sampleBearings(signal, timestampMs);
      bearingsByEmitter.set(signal.emitterId, emitterBearings);
      bearings.push(...emitterBearings);
    }

    const triangulations = activeSignals
      .map((signal) => {
        const trackedEmitter = emitterById.get(signal.emitterId);
        const emitterBearings = bearingsByEmitter.get(signal.emitterId) ?? [];

        if (!trackedEmitter || emitterBearings.length === 0) {
          return null;
        }

        return solveTriangulation(trackedEmitter, emitterBearings, {
          rayLengthM: this.config.bearingRayLengthM ?? 12_000,
          parallelAngleThresholdDeg: this.config.parallelAngleThresholdDeg ?? 6,
          maxIntersectionDistanceM: this.config.maxIntersectionDistanceM ?? 25_000,
          heatmapGridSize: this.config.heatmapGridSize ?? 13,
          heatmapCellSizeM: this.config.heatmapCellSizeM ?? 180,
          confidenceLevel: 0.95,
        });
      })
      .filter((estimate): estimate is NonNullable<typeof estimate> => estimate !== null);

    const triangulation =
      triangulations.find((estimate) => estimate.emitterId === trackedEmitterId) ?? triangulations[0] ?? null;

    const dfVectors: DfVector[] = bearings.map((bearing) => ({
      emitterId: bearing.emitterId,
      sensorId: bearing.sensorId,
      label: bearing.sensorLabel,
      angleDeg: bearing.measuredBearingDeg,
      strengthDbm: bearing.receivedPowerDbm,
    }));
    const events = this.buildEvents(
      activeSignals,
      bearings,
      triangulations
        .map((estimate) => estimate.warning ?? null)
        .filter((warning): warning is string => typeof warning === "string" && warning.trim().length > 0),
      timestampMs
    );

    return {
      ts: timestampMs,
      activeSignals,
      spectrum,
      waveform,
      dfVectors,
      bearings,
      triangulation,
      triangulations,
      events,
    };
  }

  private initializeEmitterPhases(): void {
    for (const emitter of this.config.emitters) {
      this.phaseByEmitter.set(emitter.id, this.random.next() * TWO_PI);
    }
  }

  private resolveTrackedEmitterId(): string | null {
    if (this.config.trackingEmitterId) {
      return this.config.trackingEmitterId;
    }

    return this.config.emitters.find((emitter) => emitter.enabled !== false)?.id ?? null;
  }

  private sampleEmitterState(
    emitter: SignalEmitterConfig,
    elapsedSeconds: number,
    isTrackedTarget: boolean
  ): ActiveSignal {
    const phase = this.phaseByEmitter.get(emitter.id) ?? 0;

    const driftHz = emitter.driftHz * Math.sin(TWO_PI * emitter.driftRateHz * elapsedSeconds + phase);
    const frequencyJitterHz = this.random.gaussian(0, Math.max(25, emitter.bandwidthHz * 0.01));

    const fadeDb = emitter.fadeDepthDb * Math.sin(TWO_PI * emitter.fadeRateHz * elapsedSeconds + phase * 0.65);
    const noiseDb = this.random.gaussian(0, 1.35);
    const burstDb = this.random.next() > 0.996 ? this.random.gaussian(8, 1.25) : 0;

    const headingDeg = normalizeBearing((emitter.headingDeg ?? 0) + (emitter.turnRateDegPerSec ?? 0) * elapsedSeconds);
    const travelDistanceMeters = Math.max(0, emitter.speedMps ?? 0) * elapsedSeconds;
    let location =
      travelDistanceMeters > 0
        ? destinationPoint(emitter.initialLocation, headingDeg, travelDistanceMeters)
        : emitter.initialLocation;

    const weaveMeters = Math.sin(elapsedSeconds * 0.11 + phase) * 18;
    if (Math.abs(weaveMeters) > 0.1) {
      location = destinationPoint(location, normalizeBearing(headingDeg + (weaveMeters >= 0 ? 90 : 270)), Math.abs(weaveMeters));
    }

    return {
      emitterId: emitter.id,
      label: emitter.label,
      frequencyHz: emitter.baseFrequencyHz + driftHz + frequencyJitterHz,
      powerDbm: emitter.basePowerDbm + fadeDb + noiseDb + burstDb,
      bandwidthHz: emitter.bandwidthHz,
      location,
      headingDeg,
      speedMps: Math.max(0, emitter.speedMps ?? 0),
      isTrackedTarget,
    };
  }

  private estimateReceivedPower(signal: ActiveSignal, distanceMeters: number): number {
    const normalizedRange = Math.max(1, distanceMeters / 100);
    const rangeLossDb = 18 * Math.log10(normalizedRange) + 6;
    const frequencyPenaltyDb = 4 * Math.log10(Math.max(signal.frequencyHz / 1_000_000, 1) / 400);
    return signal.powerDbm - rangeLossDb - frequencyPenaltyDb + this.random.gaussian(0, 1.1);
  }

  private sampleBearings(signal: ActiveSignal, timestampMs: number): BearingMeasurement[] {
    return this.config.sensors
      .filter((sensor) => sensor.enabled !== false)
      .map((sensor) => {
        const trueBearingDeg = bearingFromTo(sensor.location, signal.location);
        const biasDeg = sensor.bearingBiasDeg ?? 0;
        const noiseStdDeg = Math.max(0.5, sensor.bearingNoiseStdDeg);
        const noiseDeg = this.random.gaussian(0, noiseStdDeg);
        const distanceMeters = distanceMetersBetween(sensor.location, signal.location);
        const receivedPowerDbm = this.estimateReceivedPower(signal, distanceMeters);

        return {
          sensorId: sensor.id,
          sensorLabel: sensor.label,
          sensorLocation: sensor.location,
          emitterId: signal.emitterId,
          emitterLabel: signal.label,
          measuredBearingDeg: normalizeBearing(trueBearingDeg + biasDeg + noiseDeg),
          trueBearingDeg,
          noiseDeg,
          biasDeg,
          noiseStdDeg,
          confidence: clamp(sensor.confidence ?? 0.9, 0.1, 0.99),
          receivedPowerDbm,
          distanceMeters,
          timestampMs,
        };
      });
  }

  private buildSpectrum(signals: ActiveSignal[]): SpectrumBin[] {
    const bins: SpectrumBin[] = [];
    const minHz = this.config.spectrumMinHz;
    const maxHz = this.config.spectrumMaxHz;
    const count = this.config.spectrumBins;
    const spanHz = maxHz - minHz;

    for (let index = 0; index < count; index += 1) {
      const ratio = index / Math.max(1, count - 1);
      const frequencyHz = minHz + ratio * spanHz;
      const floorDbm = this.config.noiseFloorDbm + this.random.gaussian(0, 1.75);
      bins.push({ frequencyHz, powerDbm: floorDbm });
    }

    for (const signal of signals) {
      const sigma = Math.max(500, signal.bandwidthHz * 0.55);
      for (let i = 0; i < bins.length; i += 1) {
        const delta = bins[i].frequencyHz - signal.frequencyHz;
        const gaussianShape = Math.exp(-0.5 * Math.pow(delta / sigma, 2));
        const localPeakDbm = signal.powerDbm - 28 * (1 - gaussianShape);
        bins[i].powerDbm = Math.max(bins[i].powerDbm, localPeakDbm);
      }
    }

    return bins;
  }

  private buildWaveform(signals: ActiveSignal[], elapsedSeconds: number): WaveformPoint[] {
    const points: WaveformPoint[] = [];
    const sampleRate = this.config.waveformSampleRateHz;
    const sampleCount = this.config.waveformSamples;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const t = sampleIndex / sampleRate;
      let value = 0;

      for (const signal of signals) {
        const powerScalar = toLinearScale(signal.powerDbm, this.config.noiseFloorDbm) * 0.17;
        const basebandToneHz = 1500 + Math.abs((signal.frequencyHz - this.config.spectrumMinHz) % 65000);
        const emitterPhase = this.phaseByEmitter.get(signal.emitterId) ?? 0;
        value += powerScalar * Math.sin(TWO_PI * basebandToneHz * t + emitterPhase + elapsedSeconds * 0.2);
      }

      value += this.random.gaussian(0, 0.045);
      points.push({ t, value: clamp(value, -1.2, 1.2) });
    }

    return points;
  }

  private buildEvents(
    signals: ActiveSignal[],
    bearings: BearingMeasurement[],
    triangulationWarnings: string[],
    timestampMs: number
  ): SimulationEvent[] {
    const events: SimulationEvent[] = [];

    for (const signal of signals) {
      if (signal.powerDbm > -48) {
        events.push({
          id: `evt-${this.eventCounter++}`,
          ts: timestampMs,
          severity: "critical",
          message: `${signal.label} high power burst at ${(signal.frequencyHz / 1_000_000).toFixed(3)} MHz`,
        });
      } else if (signal.powerDbm > -62) {
        events.push({
          id: `evt-${this.eventCounter++}`,
          ts: timestampMs,
          severity: "warning",
          message: `${signal.label} elevated signal level ${signal.powerDbm.toFixed(1)} dBm`,
        });
      } else if (this.random.next() > 0.9985) {
        events.push({
          id: `evt-${this.eventCounter++}`,
          ts: timestampMs,
          severity: "info",
          message: `${signal.label} nominal drift ${(signal.frequencyHz / 1_000_000).toFixed(3)} MHz`,
        });
      }
    }

    if (bearings.length > 0) {
      const strongestBearing = [...bearings].sort((left, right) => right.receivedPowerDbm - left.receivedPowerDbm)[0];
      if (strongestBearing.receivedPowerDbm > -62) {
        events.push({
          id: `evt-${this.eventCounter++}`,
          ts: timestampMs,
          severity: "info",
          message: `${strongestBearing.sensorLabel} tracking ${strongestBearing.emitterLabel} at ${strongestBearing.measuredBearingDeg.toFixed(1)} deg`,
        });
      }
    }

    for (const warning of triangulationWarnings) {
      events.push({
        id: `evt-${this.eventCounter++}`,
        ts: timestampMs,
        severity: "warning",
        message: warning,
      });
    }

    return events.slice(0, 4);
  }
}
