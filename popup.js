const API_KEY = '52dcbd0a6754456ebaf83447250710';
const BASE_URL = 'https://api.weatherapi.com/v1';

class WeatherExtension {
  constructor() {
    this.currentCity = 'London';
    this.recentSearches = [];
    this.searchTimeout = null;
    this.init();
  }

  init() {
    this.loadSavedCity();
    this.loadRecentSearches();
    this.bindEvents();
    this.fetchWeatherData();
  }

  loadSavedCity() {
    chrome.storage.local.get(['selectedCity', 'recentSearches'], (result) => {
      if (result.selectedCity) {
        this.currentCity = result.selectedCity;
        document.getElementById('citySearch').value = this.currentCity;
      }
      if (result.recentSearches) {
        this.recentSearches = result.recentSearches;
        this.updateRecentSearches();
      }
    });
  }

  loadRecentSearches() {
    chrome.storage.local.get(['recentSearches'], (result) => {
      if (result.recentSearches) {
        this.recentSearches = result.recentSearches;
        this.updateRecentSearches();
      }
    });
  }

  saveRecentSearches() {
    chrome.storage.local.set({ recentSearches: this.recentSearches });
  }

  addToRecentSearches(city) {

    this.recentSearches = this.recentSearches.filter(item => item !== city);
    

    this.recentSearches.unshift(city);
    
    if (this.recentSearches.length > 5) {
      this.recentSearches = this.recentSearches.slice(0, 5);
    }
    
    this.saveRecentSearches();
    this.updateRecentSearches();
  }

  updateRecentSearches() {
    const recentList = document.getElementById('recentList');
    const recentContainer = document.getElementById('recentSearches');
    
    if (this.recentSearches.length > 0) {
      recentContainer.classList.remove('hidden');
      recentList.innerHTML = '';
      
      this.recentSearches.forEach(city => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.textContent = city;
        item.addEventListener('click', () => {
          this.currentCity = city;
          document.getElementById('citySearch').value = city;
          this.fetchWeatherData();
        });
        recentList.appendChild(item);
      });
    } else {
      recentContainer.classList.add('hidden');
    }
  }

  bindEvents() {
    const citySearch = document.getElementById('citySearch');
    
    citySearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      if (query.length > 2) {
        this.searchTimeout = setTimeout(() => {
          this.searchCities(query);
        }, 300);
      } else {
        this.hideSearchResults();
      }
    });
    
    citySearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
          this.currentCity = query;
          this.hideSearchResults();
          this.fetchWeatherData();
        }
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.city-selector')) {
        this.hideSearchResults();
      }
    });
  }

  async searchCities(query) {
    try {
      const response = await fetch(
        `${BASE_URL}/search.json?key=${API_KEY}&q=${query}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.displaySearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      this.hideSearchResults();
    }
  }

  displaySearchResults(cities) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    
    if (cities.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'search-result-item';
      noResult.textContent = 'No cities found';
      resultsContainer.appendChild(noResult);
    } else {
      cities.forEach(city => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.textContent = `${city.name}, ${city.country}`;
        resultItem.addEventListener('click', () => {
          this.currentCity = `${city.name}, ${city.country}`;
          document.getElementById('citySearch').value = this.currentCity;
          this.hideSearchResults();
          this.fetchWeatherData();
        });
        resultsContainer.appendChild(resultItem);
      });
    }
    
    resultsContainer.classList.remove('hidden');
  }

  hideSearchResults() {
    document.getElementById('searchResults').classList.add('hidden');
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
      
      this.addToRecentSearches(this.currentCity);
      
      chrome.storage.local.set({ selectedCity: this.currentCity });
    } catch (error) {
      this.showError(`Failed to fetch weather data: ${error.message}`);
    }
  }

  displayWeatherData(data) {
    this.hideLoading();
    this.showWeatherData();
    
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
    
    body.classList.remove('background-morning', 'background-day', 'background-afternoon', 'background-evening', 'background-night');
    

    if (hour >= 6 && hour < 12) {
      body.classList.add('background-morning');
    } else if (hour >= 12 && hour < 15) {
      body.classList.add('background-day');
    } else if (hour >= 15 && hour < 18) {
      body.classList.add('background-afternoon');
    } else if (hour >= 18 && hour < 21) {
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

document.addEventListener('DOMContentLoaded', () => {
  new WeatherExtension();
});