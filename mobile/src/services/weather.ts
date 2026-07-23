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
  label: string;
  iconName: string;
  image: any;
  onColor: string;
  tip: string;
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
      label: 'Açık',
      iconName: isDay ? 'sunny' : 'moon',
      image: IMG.gunesli,
      onColor: '#FFFFFF',
      tip: isDay ? 'Bitkilerini doğrudan güneşte fazla bırakma.' : 'Gece serinliği için pencereyi kontrol et.',
    };
  }
  if (code === 1 || code === 2) {
    return { label: 'Parçalı Bulutlu', iconName: 'partly-sunny', image: IMG.parcali, onColor: '#FFFFFF', tip: 'Çoğu iç mekan bitkisi için ideal bir gün.' };
  }
  if (code === 3) {
    return { label: 'Bulutlu', iconName: 'cloud', image: IMG.parcali, onColor: '#FFFFFF', tip: 'Işık az — bitkileri pencereye yaklaştır.' };
  }
  if (code === 45 || code === 48) {
    return { label: 'Sisli', iconName: 'cloud-outline', image: IMG.sisli, onColor: '#FFFFFF', tip: 'Nem yüksek, sulamayı azaltabilirsin.' };
  }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { label: 'Çiseleme', iconName: 'rainy-outline', image: IMG.yagmurlu, onColor: '#FFFFFF', tip: 'Dış mekan bitkilerini sulamana gerek yok.' };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: 'Yağmurlu', iconName: 'rainy', image: IMG.yagmurlu, onColor: '#FFFFFF', tip: 'Saksılarda su birikmesine dikkat et.' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: 'Karlı', iconName: 'snow', image: IMG.karli, onColor: '#FFFFFF', tip: 'Dış mekan bitkilerini soğuktan koru.' };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Fırtınalı', iconName: 'thunderstorm', image: IMG.yagmurlu, onColor: '#FFFFFF', tip: 'Balkondaki saksıları içeri al.' };
  }
  return { label: 'Hava Durumu', iconName: 'partly-sunny', image: IMG.parcali, onColor: '#FFFFFF', tip: '' };
}
