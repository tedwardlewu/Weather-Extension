import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());

const API_KEY = 'da9393ec436a49ef8b332007251611';
const BASE_URL = 'https://api.weatherapi.com/v1';

app.get('/weather', async (req, res) => {
  const { q, days } = req.query;
  try {
    const response = await fetch(`${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(q)}&days=${days || 3}&aqi=no&alerts=no`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));