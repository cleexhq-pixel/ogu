/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" }
        },
        "bubble-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "chat-card-lift": {
          "0%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-10px)" },
          "100%": { transform: "translateY(0)" }
        },
        "chat-ai-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "correction-slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "pulse-soft": "pulse-soft 1.2s ease-in-out infinite",
        "bubble-in": "bubble-in 0.3s ease-out forwards",
        "chat-card-lift": "chat-card-lift 0.3s ease forwards",
        "chat-ai-fade": "chat-ai-fade 0.3s ease forwards",
        "correction-slide-up": "correction-slide-up 0.3s ease forwards"
      },
      animationDelay: {
        "100": "100ms",
        "200": "200ms",
        "300": "300ms",
        "400": "400ms",
        "500": "500ms"
      }
    }
  },
  plugins: []
};

