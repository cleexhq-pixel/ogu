// scripts/generate-audio.js
// My 90 Seconds — TTS 사전 생성 스크립트
// 실행: GOOGLE_TTS_API_KEY=your_key node scripts/generate-audio.js
// 생성 결과: public/audio/male/{id}.mp3, public/audio/female/{id}.mp3

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── 설정 ──────────────────────────────────────────────
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'audio');
const DELAY_MS = 300;

const VOICE_CONFIG = {
  male: {
    languageCode: 'ko-KR',
    name: 'ko-KR-Neural2-C',
    ssmlGender: 'MALE',
  },
  female: {
    languageCode: 'ko-KR',
    name: 'ko-KR-Neural2-A',
    ssmlGender: 'FEMALE',
  },
};

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 1.05,
  pitch: 0,
};

// ── idol-scripts.js 로드 ──────────────────────────────
function extractObjectText(raw, startPos) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = startPos;

  while (i < raw.length) {
    const ch = raw[i];

    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return raw.slice(startPos, i + 1);
        }
      }
    }
    i++;
  }
  throw new Error('idolScripts 객체 끝을 찾을 수 없습니다.');
}

function loadIdolScripts() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'idol-scripts.js');
  const raw = fs.readFileSync(filePath, 'utf-8');

  const startIdx = raw.indexOf('const idolScripts = {');
  const match = startIdx !== -1 ? [null, raw.slice(startIdx + 'const idolScripts = '.length)] : null;
  if (!match) {
    throw new Error('idolScripts 객체를 파일에서 찾을 수 없습니다. 파일 구조를 확인하세요.');
  }

  let scripts;
  try {
    const objText = extractObjectText(raw, startIdx + 'const idolScripts = '.length);
    scripts = eval('(' + objText + ')');
  } catch (e) {
    throw new Error('idolScripts 파싱 실패: ' + e.message);
  }

  return scripts;
}

// ── 대사 배열 평탄화 ────────────────────────────────────
function extractLines(scripts) {
  const lines = [];
  for (const [category, value] of Object.entries(scripts)) {
    if (!Array.isArray(value)) {
      console.log('  [SKIP] ' + category + ' — 배열 아님, 건너뜀');
      continue;
    }
    for (const item of value) {
      if (!item.id || !item.text) {
        console.log('  [SKIP] id 또는 text 없음:', item);
        continue;
      }
      lines.push({ id: item.id, text: item.text, category });
    }
  }
  return lines;
}

// ── Google TTS API 호출 ──────────────────────────────────
function callGoogleTTS(text, voiceConfig) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input: { text },
      voice: voiceConfig,
      audioConfig: AUDIO_CONFIG,
    });

    const options = {
      hostname: 'texttospeech.googleapis.com',
      path: '/v1/text:synthesize?key=' + GOOGLE_TTS_API_KEY,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error('Google TTS 오류: ' + json.error.message));
            return;
          }
          if (!json.audioContent) {
            reject(new Error('audioContent 없음. API 응답: ' + data));
            return;
          }
          resolve(Buffer.from(json.audioContent, 'base64'));
        } catch (e) {
          reject(new Error('응답 파싱 실패: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── 딜레이 함수 ───────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 메인 실행 ─────────────────────────────────────────────
async function main() {
  console.log('=== My 90 Seconds TTS 사전 생성 시작 ===\n');

  if (!GOOGLE_TTS_API_KEY) {
    console.error('GOOGLE_TTS_API_KEY 환경변수가 없습니다.');
    console.error('실행 방법: GOOGLE_TTS_API_KEY=your_key node scripts/generate-audio.js');
    process.exit(1);
  }

  const maleDir = path.join(OUTPUT_DIR, 'male');
  const femaleDir = path.join(OUTPUT_DIR, 'female');
  [maleDir, femaleDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('폴더 생성: ' + dir);
    }
  });

  console.log('idol-scripts.js 로드 중...');
  const scripts = loadIdolScripts();
  const lines = extractLines(scripts);
  console.log('총 ' + lines.length + '개 대사 로드 완료\n');

  const genders = ['male', 'female'];
  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const gender of genders) {
    const dir = gender === 'male' ? maleDir : femaleDir;
    const voiceConfig = VOICE_CONFIG[gender];
    console.log('\n[' + gender.toUpperCase() + '] 생성 시작 — Voice: ' + voiceConfig.name);
    console.log('--------------------------------------------------');

    for (let i = 0; i < lines.length; i++) {
      const { id, text } = lines[i];
      const outputPath = path.join(dir, id + '.mp3');

      if (fs.existsSync(outputPath)) {
        console.log('  [SKIP] ' + id + '.mp3 이미 존재');
        totalSkipped++;
        continue;
      }

      try {
        const audioBuffer = await callGoogleTTS(text, voiceConfig);
        fs.writeFileSync(outputPath, audioBuffer);
        const preview = text.length > 20 ? text.slice(0, 20) + '...' : text;
        console.log('  [OK] ' + gender + '/' + id + '.mp3 — "' + preview + '"');
        totalGenerated++;
      } catch (err) {
        console.error('  [FAIL] ' + gender + '/' + id + '.mp3 — ' + err.message);
        totalFailed++;
      }

      if (i < lines.length - 1) {
        await sleep(DELAY_MS);
      }
    }
  }

  console.log('\n==================================================');
  console.log('=== 생성 완료 ===');
  console.log('생성됨: ' + totalGenerated + '개');
  console.log('스킵됨: ' + totalSkipped + '개 (이미 존재)');
  console.log('실패됨: ' + totalFailed + '개');
  console.log('저장 위치: public/audio/male/, public/audio/female/');

  if (totalFailed > 0) {
    console.log('\n실패한 항목이 있습니다. 위 로그에서 [FAIL] 항목을 확인하세요.');
    console.log('스크립트를 다시 실행하면 실패한 항목만 재시도합니다.');
    process.exit(1);
  }

  console.log('\n모든 파일 생성 성공!');
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
