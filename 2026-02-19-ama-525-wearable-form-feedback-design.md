# AMA-525: Real-time Form Feedback Using Wearable Motion Sensors — Spike Design

**Date:** 2026-02-19
**Issue:** [AMA-525](https://linear.app/amakaflow/issue/AMA-525/spike-real-time-form-feedback-using-wearable-motion-sensors)
**Status:** Approved — ready for implementation planning

---

## Overview

Investigate using wearable motion sensors (accelerometer/gyroscope) to provide real-time form feedback during strength training. The spike covers motion pattern recognition, on-device processing, haptic feedback design, and bar path analysis across three wearable platforms: Apple Watch, Wear OS, and Garmin.

**Success criteria:**
- ≥85% accuracy detecting form deviations (Apple Watch PoC)
- <2s end-to-end latency from deviation to haptic cue
- Meaningful, injury-preventing corrections delivered via haptics
- Platform feasibility verdict for Wear OS and Garmin
- Partner device ecosystem mapped (bar-mounted sensors)

---

## Spike Goals

The spike answers four questions with evidence, not just theory:

1. **Data** — What is the best available labeled IMU dataset for strength training? Do we need to collect our own, and how?
2. **Platform feasibility** — Can Apple Watch, Wear OS, and Garmin each meet <2s latency with on-device processing? What are the hardware ceilings?
3. **Partner device ecosystem** — What bar-mounted or body-mounted sensor partners exist (à la Stryd for running)? What APIs/SDKs do they expose?
4. **Haptic language** — Can haptics convey meaningful, actionable coaching cues in real time? What patterns work?

**Spike output:**
- Technical findings report covering all four questions with a recommendation per platform
- Working PoC on Apple Watch: squat detection + depth deviation cue via haptics
- Haptic pattern vocabulary v0.1, blind-recognition validated
- Partner device shortlist with integration feasibility rating

---

## Approach

### Three-tier Strategy

- **Approach A (Classical signal processing):** Windowed peak detection, symmetry ratios, velocity thresholds — rule-based. Used for Garmin where no ML runtime exists.
- **Approach B (On-device ML):** Lightweight 1D-CNN trained on labeled IMU data, deployed via Core ML (Apple Watch) or LiteRT (Wear OS). Primary approach for accuracy.
- **Approach C — North Star (Adaptive/personalised model):** Watch learns your movement patterns over time. Your "good rep" becomes the reference. Haptic trigger points adapt to your neuromuscular response time. Designed as the Phase 2+ evolution, not in scope for this spike but must be architecturally enabled.

---

## Platform Architecture

### Adapter Pattern

Each platform exposes a Sensor Adapter that normalises raw IMU data into a common `MotionSample` stream. Everything above that layer — classification, haptic output, data logging — is shared logic.

```
┌──────────────────────────────────────────────┐
│           Form Feedback Engine               │
│  (exercise classifier + deviation detector)  │
└───────────────┬──────────────────────────────┘
                │ MotionSample stream
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Apple        Wear OS    Garmin
 Watch        Adapter    Adapter
 Adapter      (LiteRT)   (classical)
(Core ML)
```

### Per-Platform Strategy

| Platform | Sensor API | ML Runtime | Approach | Feasibility |
|----------|------------|------------|----------|-------------|
| **Apple Watch** | Core Motion (200Hz accel + gyro) | Core ML + Neural Engine | B (ML-first) | High — Neural Engine makes on-device inference fast and power-efficient |
| **Wear OS** | SensorManager (200Hz) | LiteRT (TFLite successor, 2024) | B | Medium-High — hardware-dependent, quantised INT8 models needed |
| **Garmin** | Connect IQ `Sensor.registerSensorDataListener()` | Monkey C — no ML runtime | A (classical rules) | Medium — constrained but viable for threshold-based detection |

**Garmin constraint:** Connect IQ SDK (v8.2) exposes accelerometer data but has no ML inference runtime. Classical signal processing is the only viable path — sufficient for coarse form deviations (bar speed drop, asymmetric loading, depth).

---

## Data & ML Strategy

### Recommended Datasets

**Primary: StrengthSense (2025)**
- 8.5 hours, 29 participants, 9-axis IMU at 10 body locations
- 11 strength-demanding activities, joint angles validated against video
- Multi-sensor — extract wrist-position data to simulate watch placement
- Source: https://arxiv.org/html/2511.02027v1

**Secondary: RecGym (2025, UCI)**
- Includes bench press and squat — directly relevant
- 50 sessions across 5 days per participant — good longitudinal coverage
- Source: https://archive.ics.uci.edu/dataset/1128/recgym:+gym+workouts+recognition+dataset+with+imu+and+capacitive+sensor-7

**Critical gap:** Neither dataset includes form quality labels (good vs. bad form). They classify *what* exercise, not *how well*. Two paths to close this gap:

1. **Synthetic augmentation** — take good-form reps from existing datasets, algorithmically introduce known deviations (depth, asymmetry, bar path drift) and label them. Fast to bootstrap, needs validation.
2. **Ground truth collection** — record controlled sessions with a coach marking good/bad reps in real time. Higher quality, slower. Use GymAware/Output Sports as ground truth for bar velocity.

The spike prototypes path 1 first and assesses whether accuracy is sufficient before committing to data collection.

### Model Architecture (Apple Watch + Wear OS)

```
Raw IMU (200Hz accel + gyro)
        ↓
Sliding window (2s, 50% overlap)
        ↓
Feature extraction (RMS, peak detection, symmetry ratio, FFT bands)
        ↓
1D-CNN (lightweight, ~50KB target for watch deployment)
        ↓
Exercise class + form quality score (0–100)
        ↓
Deviation classifier (what's wrong: depth / symmetry / bar path / tempo)
```

### Garmin Pipeline (Classical)

```
Raw accelerometer (Connect IQ, ~25Hz typical)
        ↓
Peak detection + rep segmentation
        ↓
Rule engine: velocity threshold, symmetry ratio, rep duration
        ↓
Deviation flags (coarse: depth / speed / asymmetry)
```

### Target Model Performance

| Platform | Model size | Inference time target | Accuracy target |
|----------|------------|----------------------|-----------------|
| Apple Watch | <200KB (Core ML INT8) | <50ms per window | ≥85% form deviation detection |
| Wear OS | <100KB (LiteRT INT8 quantised) | <100ms per window | ≥80% |
| Garmin | No model — rule-based | <20ms | ≥70% (coarse deviations only) |

**Latency budget breakdown (Apple Watch):** ~1s sliding window + <0.1s inference + ~0.5s haptic trigger = ~1.6s. Well within the 2s requirement.

---

## Haptic Language Design

### Principles

- **Immediacy over information density** — one cue, one meaning, triggered at the right moment in the rep
- **Spatial metaphor** — patterns feel directionally intuitive (rising pulse = go deeper, sharp cut = stop)
- **Learnability** — athletes reliably learn 5–7 distinct patterns; design within that budget
- **Severity gradient** — same cue type, different intensity = warning vs. critical

### Haptic Vocabulary v0.1

| Cue | Pattern | Trigger | Meaning |
|-----|---------|---------|---------|
| **Depth prompt** | Single slow rising pulse (0.3s ramp up) | Squat/deadlift not hitting depth threshold | "Go deeper" |
| **Stop / danger** | Three sharp rapid taps (0.1s each) | Dangerous bar path deviation or velocity collapse | "Rack it / stop" |
| **Asymmetry warning** | Double pulse, left-weighted or right-weighted | Lateral imbalance detected | "Check your balance" |
| **Tempo too fast** | Short staccato buzz | Rep speed exceeding safe range | "Slow down" |
| **Good rep confirmation** | Single clean crisp tap | Form within all thresholds | Positive reinforcement |
| **Fatigue warning** | Long slow fade-out pulse | Velocity drop >15% vs. session average | "You're fading" |

### Implementation

- **Apple Watch:** Core Haptics (`CHHapticEngine`) — full control over intensity, sharpness, timing, and audio overlay. `WKInterfaceDevice.current().play()` as fallback.
- **Wear OS:** `VibratorManager` API supports custom waveforms — same vocabulary implementable, slightly less nuanced.
- **Garmin:** `Attention.vibrate()` with duration/intensity arrays — coarser control. Depth prompt, stop, and good rep confirmation achievable.

### Validation

Run a blind recognition test with ≥5 athletes. Target: ≥80% correct identification per pattern within 2 reps of first experiencing it.

### North Star: Adaptive Haptic Language (Approach C)

Over time, the watch learns your response latency — how quickly you correct after a cue. If the depth prompt at 60% depth works for you, great. If you need it earlier, the model shifts the trigger point. The haptic language adapts to your neuromuscular response time, not a fixed threshold. This is what makes AmakaFlow different from every VBT device on the market — they measure, we coach.

---

## Partner Device Ecosystem (Bar Sensors)

Wrist-based inference is the primary approach for bar path. The spike evaluates whether dedicated bar-mounted sensors are worth partnering with, rather than building our own hardware.

| Device | Technology | API Available? | Notes |
|--------|-----------|----------------|-------|
| **GymAware FLEX** | Laser + IMU, clips to bar | Yes — REST API (Cloud Pro) | Most mature API in the space; 20+ years of VBT data. API guide at gymaware.zendesk.com |
| **Output Sports V2** | 9-axis IMU, 1000Hz | Yes — API integrations listed | Designed for team use, 99% accuracy vs. force plate |
| **RepOne** | Encoder-based, open-source origin (OpenBarbell) | Partial — contact needed | Current API status unclear; outreach required |
| **Perch** | 3D camera (not wearable) | Likely proprietary | Camera-based; different integration model |
| **Metric VBT** | Computer vision via phone camera | App-only currently | No hardware sensor to partner with |

**Spike action:** Contact GymAware and Output Sports directly to confirm API access. These give bar path velocity data that complements wrist-based inference — the two streams together produce a richer picture than either alone.

---

## PoC Scope

### Apple Watch Form Detector (Minimum Viable)

**Target: squat detection + depth cue only. One exercise, one cue, end-to-end.**

```
watchOS app (SwiftUI)
  ├── CMMotionManager — 100Hz accel + gyro
  ├── RepSegmenter — peak detection to isolate reps
  ├── FormClassifier.mlmodel — Core ML, trained on StrengthSense + synthetic bad-form data
  ├── HapticCoach — CHHapticEngine, plays depth prompt pattern
  └── DebugView — live waveform + classification confidence (spike only)
```

**What the PoC proves:**
- Can we segment individual reps from raw IMU in real time?
- Can a <200KB Core ML model detect squat depth deviation at ≥85% accuracy?
- Does the haptic cue fire within the 2s latency budget?
- Does battery hold up for a 45-minute session?

---

## Spike Research Tasks

| Task | Output |
|------|--------|
| Evaluate StrengthSense + RecGym datasets | Dataset recommendation + wrist-placement extraction approach |
| Synthetic bad-form data generation | Labelled dataset ready for training |
| Train + quantise 1D-CNN | `FormClassifier.mlmodel` <200KB |
| Garmin Connect IQ feasibility test | Can `Sensor.registerSensorDataListener()` sustain 25Hz + rule engine without OOM? |
| Wear OS LiteRT feasibility test | Inference latency benchmark on mid-range Wear OS device |
| GymAware + Output Sports API outreach | API access confirmed or denied, integration model documented |
| Haptic pattern blind recognition test (≥5 athletes) | Recognition accuracy per pattern |

---

## Definition of Done

- [ ] PoC running on Apple Watch: squat depth cue fires correctly on ≥85% of bad-form reps in controlled test
- [ ] Garmin feasibility verdict: yes/no with evidence
- [ ] Wear OS feasibility verdict: yes/no with latency benchmark
- [ ] Dataset recommendation written up with rationale
- [ ] Partner device shortlist: GymAware and Output Sports API access status confirmed
- [ ] Haptic vocabulary v0.1 validated with ≥80% blind recognition per pattern
- [ ] Technical report covering all findings + recommended path to full implementation

## Explicitly Out of Scope

- Bench press or deadlift detection (Phase 2)
- Personalisation/adaptive model — Approach C is the north star for Phase 2+
- Production-ready watchOS app
- Garmin or Wear OS PoC (feasibility report only for this spike)

---

## References

- [StrengthSense Dataset (2025)](https://arxiv.org/html/2511.02027v1)
- [RecGym Dataset — UCI (2025)](https://archive.ics.uci.edu/dataset/1128/recgym:+gym+workouts+recognition+dataset+with+imu+and+capacitive+sensor-7)
- [Core Motion — Apple Developer](https://developer.apple.com/documentation/coremotion)
- [Core Haptics — Apple Developer](https://developer.apple.com/documentation/corehaptics/)
- [MLActivityClassifier — Apple Developer](https://developer.apple.com/documentation/createml/mlactivityclassifier)
- [LiteRT (TFLite successor) — Google AI Edge](https://ai.google.dev/edge/litert/conversion/tensorflow/build/ondevice_training)
- [Garmin Connect IQ SDK](https://developer.garmin.com/connect-iq/)
- [GymAware API Integration](https://gymaware.zendesk.com/hc/en-us/articles/360001396875-API-Integration)
- [GymAware FLEX](https://gymaware.com/product/flex-barbell-tracker/)
- [Output Sports V2 Sensor](https://www.outputsports.com/performance/velocity-based-training)
- [VBT Devices Buyer's Guide 2025](https://www.vbtcoach.com/blog/velocity-based-training-devices-buyers-guide)
