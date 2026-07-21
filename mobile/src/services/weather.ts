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

// WMO hava durumu kodları -> Türkçe açıklama + ikon adı (Ionicons)
export function describeWeatherCode(code: number): { label: string; iconName: string } {
  if (code === 0) return { label: 'Açık', iconName: 'sunny' };
  if (code === 1 || code === 2) return { label: 'Parçalı Bulutlu', iconName: 'partly-sunny' };
  if (code === 3) return { label: 'Bulutlu', iconName: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Sisli', iconName: 'cloud-outline' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Çiseleme', iconName: 'rainy-outline' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Yağmurlu', iconName: 'rainy' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Karlı', iconName: 'snow' };
  if ([95, 96, 99].includes(code)) return { label: 'Fırtınalı', iconName: 'thunderstorm' };
  return { label: 'Hava Durumu', iconName: 'partly-sunny' };
}
