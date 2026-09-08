/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#0A130F', // vert-nuit très sombre, fond principal
          900: '#0F1D17',
          800: '#16281F',
          700: '#20362B',
        },
        turf: {
          500: '#2FA84F', // vert terrain, accent principal
          400: '#45C468',
        },
        flood: {
          400: '#F0A93F', // ambre projecteur de stade, accent secondaire (tips/scores)
          500: '#DB8E22',
        },
        chalk: {
          100: '#EEF2EE', // texte principal
          300: '#B7C4BB',
          500: '#7C8B81',
        },
        danger: '#E2574C',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
