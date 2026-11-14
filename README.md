# 🐾 PocketMeow

> Your pocket-sized, sassy 3D AI companion with real-time dynamic skin mapping and witty personality translation.

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=React&logoColor=black)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R150+-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Overview

**PocketMeow** is a next-generation cyber-pet application that brings your real-life feline friends into an interactive 3D virtual space. Designed with an agile "Web-first" MVP approach and migrating towards cross-platform native capabilities, PocketMeow combines lightweight 3D rendering, intelligent local vision algorithms, and humorous, sassy AI interactions.

---

## 🚀 Key Features

* **🎨 AI-Driven Dynamic Skin Mapping:** Upload any cat photo, and the app instantly extracts its unique fur color, patterns, and features to remap the 3D model in real time. Features both an advanced Gemini Vision API mode and an offline-first robust fallback (Edge Flood Fill + 50–80th luminosity percentile sampling).
* **🐾 Interactive 3D Pet Engine:** Powered by Three.js / React Three Fiber, featuring smooth procedural animations including breathing, tail-wagging, blinking, and active listening postures.
* **🎙️ Zero-Latency Local "Cat-to-Human" Translation:** Integrates the Web Audio API to capture micro-audio features locally, matching them instantly with a cached repository of witty and sarcastic pet quotes.
* **🔒 Privacy-First & Zero-Backend:** Core algorithms and visual parsing run entirely on the client side, ensuring zero cloud overhead and lightning-fast responsiveness.
* **📱 Cross-Platform Architecture:** Initial Web MVP built on Vite + React, with a seamless migration path to **React Native (Expo)** for native iOS and Android deployment.

---

## 🛠️ Tech Stack

* **Frontend & Rendering:** Vite, React, TypeScript, Three.js / `@react-three/fiber`
* **AI & Vision Pipeline:** Google AI Studio (Gemini API) + Local K-Means / Flood Fill Color Engine
* **Audio Processing:** Web Audio API (Client-side feature extraction)
* **Future Native Runtime:** React Native (Expo)

---

## 🗺️ Development Roadmap

- [x] **Phase 1:** 3D Environment Initialization & Skeletal Animations (Breathing, Tail-wagging, Blinking)
- [x] **Phase 2:** AI Visual Skin Mapping & Flood Fill Color Calibration Engine
- [ ] **Phase 3:** Audio Feature Extraction, Sassy Quote Caching, and Social Sharing Card Generation
- [ ] **Phase 4:** React Native (Expo) Migration & Cross-Platform Native Packaging

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
