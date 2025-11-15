// @ts-check

import fs from "fs";
import fetch from "node-fetch";

const API_URL = "https://tiktok-tts.weilnet.workers.dev/api/generation";
const VOICES_URL = "https://raw.githubusercontent.com/VRCWizard/TTS-Voice-Wizard/refs/heads/main/OSCVRCWiz/Assets/voices/tiktokVoices.json";

let AVAILABLE_VOICES = [];

/** Load TikTok voices from GitHub */
async function loadVoices() {
  if (AVAILABLE_VOICES.length > 0) return AVAILABLE_VOICES; // prevent reloading

  const res = await fetch(VOICES_URL);
  if (!res.ok) throw new Error("Failed to load TikTok voices JSON");

  const data = await res.json();

  // Ensure the array has voice_id + name
  AVAILABLE_VOICES = data.map(v => ({
    voice_id: v.value || v.voice_id,
    name: v.name || v.display_name || "Unknown"
  }));

  return AVAILABLE_VOICES;
}

/**
 * Call the TikTok TTS API
 * @param {string} text 
 * @param {string} voiceId 
 * @returns {Promise<string>} Base64 MP3
 */
async function callAPI(text, voiceId) {
  const body = JSON.stringify({ text, voice: voiceId });

  const req = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  if (req.status !== 200) {
    throw new Error(`API Error ${req.status}: ${req.statusText}`);
  }

  const json = await req.json();
  return json.data; // base64 mp3
}

function writeFile(dirPath, fileName, data, encoding = "utf8") {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
  fs.writeFileSync(`${dirPath}/${fileName}`, data, { encoding });
}

function writeMP3File(mp3, index, dirPath) {
  writeFile(dirPath, `audio-${index}.mp3`, mp3, "base64");
}

function writeTextFile(text, index, dirPath) {
  writeFile(dirPath, `text-${index}.txt`, text);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert text to speech using TikTok voices
 * @param {string} voiceId 
 * @param {string} text 
 * @param {string} textDirPath 
 * @param {string} audioDirPath 
 */
async function textToSpeechIt(voiceId, text, textDirPath, audioDirPath) {
  const voices = await loadVoices();

  const valid = voices.find(v => v.voice_id === voiceId);
  if (!valid)
    throw new Error(
      `Invalid voice_id "${voiceId}". Use one of:\n${voices
        .map(v => `${v.voice_id} (${v.name})`)
        .join("\n")}`
    );

  if (!text) throw "A text must be passed as the second argument.";

  const words = text.split(" ");
  const texts = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const next = `${current} ${words[i]}`.trim();

    if (next.length > 250 || i === words.length - 1) {
      texts.push(next);
      current = "";
    } else {
      current = next;
    }
  }

  for (let i = 0; i < texts.length; i++) {
    if (i !== 0) await sleep(5);

    const part = texts[i];
    const mp3 = await callAPI(part, voiceId);

    writeMP3File(mp3, i, audioDirPath);
    writeTextFile(part, i, textDirPath);
  }
}

export default textToSpeechIt;
