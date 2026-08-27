// Open-Meteo: ücretsiz, API anahtarı gerektirmeyen hava durumu servisi.
// https://open-meteo.com/en/docs

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Hava durumu alınamadı');
  const json = await res.json();
  return {
    temperature: Math.round(json.current.temperature_2m),
    weatherCode: json.current.weather_code,
    isDay: json.current.is_day === 1,
  };
}

export interface WeatherLook {
  labelKey: string;
  tipKey: string | null;
  iconName: string;
  image: any;
  onColor: string;
}

const IMG = {
  gunesli: require('../../assets/weather/gunesli.png'),
  parcali: require('../../assets/weather/parcalibulutlu.png'),
  sisli: require('../../assets/weather/sisli.png'),
  yagmurlu: require('../../assets/weather/yagmurlu.png'),
  karli: require('../../assets/weather/karli.png'),
};

export function describeWeatherCode(code: number, isDay: boolean = true): WeatherLook {
  if (code === 0) {
    return {
      labelKey: 'weather.clear',
      iconName: isDay ? 'sunny' : 'moon',
      image: IMG.gunesli,
      onColor: '#FFFFFF',
      tipKey: isDay ? 'weather.clearTipDay' : 'weather.clearTipNight',
    };
  }
  if (code === 1 || code === 2) {
    return { labelKey: 'weather.partlyCloudy', iconName: 'partly-sunny', image: IMG.parcali, onColor: '#FFFFFF', tipKey: 'weather.partlyCloudyTip' };
  }
  if (code === 3) {
    return { labelKey: 'weather.cloudy', iconName: 'cloud', image: IMG.parcali, onColor: '#FFFFFF', tipKey: 'weather.cloudyTip' };
  }
  if (code === 45 || code === 48) {
    return { labelKey: 'weather.foggy', iconName: 'cloud-outline', image: IMG.sisli, onColor: '#FFFFFF', tipKey: 'weather.foggyTip' };
  }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { labelKey: 'weather.drizzle', iconName: 'rainy-outline', image: IMG.yagmurlu, onColor: '#FFFFFF', tipKey: 'weather.drizzleTip' };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { labelKey: 'weather.rainy', iconName: 'rainy', image: IMG.yagmurlu, onColor: '#FFFFFF', tipKey: 'weather.rainyTip' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { labelKey: 'weather.snowy', iconName: 'snow', image: IMG.karli, onColor: '#FFFFFF', tipKey: 'weather.snowyTip' };
  }
  if ([95, 96, 99].includes(code)) {
    return { labelKey: 'weather.stormy', iconName: 'thunderstorm', image: IMG.yagmurlu, onColor: '#FFFFFF', tipKey: 'weather.stormyTip' };
  }
  return { labelKey: 'weather.default', iconName: 'partly-sunny', image: IMG.parcali, onColor: '#FFFFFF', tipKey: null };
}
