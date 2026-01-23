import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());

const API_KEY = 'da9393ec436a49ef8b332007251611';
const BASE_URL = 'https://api.weatherapi.com/v1';
const PORT = process.env.PORT || 3000; 

const weatherCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; 

async function fetchWeather(city, days = 7) {
  const url = `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=${days}&aqi=no&alerts=no`;
  const res = await fetch(url);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

app.get('/weather', async (req, res) => {
  const { q, days } = req.query;
  if (!q) return res.status(400).json({ error: 'Query missing' });

  const city = q.trim().toLowerCase();
  const numDays = parseInt(days) || 7;

  const cached = weatherCache.get(city);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  if (cached) {
    res.json(cached.data); 
  } 
  
  else {
    res.json({
      location: { name: city, country: '', localtime: '' },
      current: { temp_c: 0, condition: { text: '', icon: '' }, feelslike_c: 0, humidity: 0, wind_kph: 0, pressure_mb: 0, vis_km: 0, uv: 0, precip_mm: 0 },
      forecast: { forecastday: [] }
    });
  }

  fetchWeather(city, numDays).then(data => {
    weatherCache.set(city, { data, timestamp: Date.now() });
  }).catch(err => {
    console.error('Weather fetch failed:', err);
  });
});

app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query missing' });

  try {
    const response = await fetch(`${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/healthz', (req, res) => {
  console.log('Healthcheck ping received');  
  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));