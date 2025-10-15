const API_KEY = '52dcbd0a6754456ebaf83447250710';
const BASE_URL = 'https://api.weatherapi.com/v1';

class WeatherExtension {
  constructor() {
    this.currentCity = 'London';
    this.init();
  }

  init() {
    this.loadSavedCity();
    this.bindEvents();
    this.fetchWeatherData();
  }

  loadSavedCity() {
    chrome.storage.local.get(['selectedCity'], (result) => {
      if (result.selectedCity) {
        this.currentCity = result.selectedCity;
        document.getElementById('citySelect').value = this.currentCity;
      }
    });
  }

  bindEvents() {
    document.getElementById('citySelect').addEventListener('change', (e) => {
      this.currentCity = e.target.value;
      chrome.storage.local.set({ selectedCity: this.currentCity });
      this.fetchWeatherData();
    });
  }

  async fetchWeatherData() {
    this.showLoading();
    this.hideError();
    this.hideWeatherData();

    try {
      const response = await fetch(
        `${BASE_URL}/forecast.json?key=${API_KEY}&q=${this.currentCity}&days=3&aqi=no&alerts=no`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.displayWeatherData(data);
      this.updateBackground(data.location.localtime);
    } catch (error) {
      this.showError(`Failed to fetch weather data: ${error.message}`);
    }
  }

  displayWeatherData(data) {
    this.hideLoading();
    this.showWeatherData();
    
    //current weather
    document.getElementById('locationName').textContent = 
      `${data.location.name}, ${data.location.country}`;

    document.getElementById('currentDate').textContent = 
      new Date(data.location.localtime).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    document.getElementById('currentTemp').textContent = 
      `${Math.round(data.current.temp_c)}°C`;

    document.getElementById('conditionText').textContent = 
      data.current.condition.text;

    document.getElementById('weatherIcon').src = 
      `https:${data.current.condition.icon}`;


    // Weather details
    document.getElementById('feelsLike').textContent = 
      `${Math.round(data.current.feelslike_c)}°C`;

    document.getElementById('humidity').textContent = 
      `${data.current.humidity}%`;

    document.getElementById('wind').textContent = 
      `${data.current.wind_kph} km/h`;

    document.getElementById('pressure').textContent = 
      `${data.current.pressure_mb} mb`;

    document.getElementById('visibility').textContent = 
      `${data.current.vis_km} km`;

    document.getElementById('uv').textContent = 
      data.current.uv;


    this.displayForecast(data.forecast.forecastday);
  }

  displayForecast(forecastDays) {
    const forecastContainer = document.getElementById('forecastDays');
    forecastContainer.innerHTML = '';

    forecastDays.forEach(day => {
      const date = new Date(day.date);
      const forecastDay = document.createElement('div');
      forecastDay.className = 'forecast-day';
      
      forecastDay.innerHTML = `
        <div class="day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}">
        <div class="forecast-temp">${Math.round(day.day.maxtemp_c)}° / ${Math.round(day.day.mintemp_c)}°</div>
        <div class="condition">${day.day.condition.text}</div>
      `;
      
      forecastContainer.appendChild(forecastDay);
    });
  }

  updateBackground(localTime) {
    const hour = new Date(localTime).getHours();
    const body = document.body;
    
 
    body.classList.remove('background-morning', 'background-day', 'background-evening', 'background-night');
    //changesbackground based on time of day
    if (hour >= 6 && hour < 12) {
      body.classList.add('background-morning');
    } else if (hour >= 12 && hour < 17) {
      body.classList.add('background-day');
    } else if (hour >= 17 && hour < 20) {
      body.classList.add('background-evening');
    } else {
      body.classList.add('background-night');
    }
  }

  showLoading() {
    document.getElementById('loading').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }

  showWeatherData() {
    document.getElementById('weatherData').classList.remove('hidden');
  }

  hideWeatherData() {
    document.getElementById('weatherData').classList.add('hidden');
  }

  showError(message) {
    this.hideLoading();
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error').classList.add('hidden');
  }
}

// Initialize the extension when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WeatherExtension();
});