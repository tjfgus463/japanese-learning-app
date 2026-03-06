# 🇯🇵 일본어 학습 PWA (Japanese Learning App)

이 프로젝트는 한국어를 입력하면 자연스러운 일본어로 번역해주고, 단어별 뜻과 후리가나를 제공하는 학습용 PWA(Progressive Web App)입니다.

## ✨ 주요 기능
- **AI 번역**: Gemini API를 사용하여 자연스러운 일본어 번역 및 단어 분해 제공.
- **PWA 지원**: 모바일 기기에 설치하여 앱처럼 사용 가능.
- **데이터 저장**: SQLite(로컬) 및 Supabase(클라우드) 연동으로 학습 데이터 영구 보존.
- **공유 기능**: 카카오톡을 통해 학습한 문장을 친구에게 공유.

## 🛠 기술 스택
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express (Vite Middleware)
- **Database**: SQLite (Local Dev), Supabase (Production)
- **AI**: Google Gemini API (@google/genai)

## 🚀 시작하기

### 1. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 만들고 아래 키들을 입력합니다.

```env
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_KAKAO_JS_KEY=your_kakao_js_key
```

### 2. 설치 및 실행
```bash
npm install
npm run dev
```

## 📱 모바일 설치 방법
1. 배포된 URL에 접속합니다.
2. 브라우저 설정 메뉴에서 **"홈 화면에 추가"**를 선택합니다.
3. 바탕화면에 생성된 아이콘을 통해 앱으로 실행합니다.

## 📄 라이선스
MIT License
