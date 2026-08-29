<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/736a490c-3dc4-4404-9fb1-cbc3de58a7e9

## Run Locally

**Prerequisites:**  Node.js, Python 3.10+


1. Install frontend dependencies:
   `npm install`
2. Install backend dependencies:
   `pip install -r backend/requirements.txt`
3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
4. Run the app (starts the Vite frontend and Python/FastAPI backend together):
   `npm run dev`
