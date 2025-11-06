import express from "express";
import axios from "axios";
import cache from "memory-cache";
import https from "https";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const agent = new https.Agent({ keepAlive: true });
const CACHE_TIME = 60 * 1000;

const API_KEY = process.env.API_KEY;

// ✅ 기본 좌표 (도쿄도 치요다구)
const DEFAULT_LAT = 35.6938403;
const DEFAULT_LON = 139.753369;
const DEFAULT_PREF = "東京都";
const DEFAULT_CITY = "千代田区";
const DEFAULT_COUNTRY = "日本";

// ✅ 날씨 요청
const fetchWeather = async (city, lat, lon) => {
  let url;

  if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ja`;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${API_KEY}&units=metric&lang=ja`;
  }

  console.log(`🌐 [OpenWeather 요청] ${url}`);
  const { data } = await axios.get(url, { httpsAgent: agent });
  return data;
};

// ✅ 역지오코딩
const reverseGeocode = async (lat, lon) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`;
  console.log(`🗾 [Geocode 요청] ${url}`);
  const { data } = await axios.get(url, { httpsAgent: agent });
  return {
    country: data.countryName,
    prefecture: data.principalSubdivision,
    city: data.locality,
  };
};

// ✅ 메인 엔드포인트
router.get("/nowWeather", async (req, res) => {
  try {
    let { city, lat, lon } = req.query;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    let cacheKey = `${ip}_${city || `${lat}_${lon}`}`;

    // 캐시 확인
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`🟢 [CACHE HIT] ${cacheKey}`);
      return res.json(cached);
    }

    // 1️⃣ IP 기반 위치 감지
    if (!lat || !lon) {
      try {
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0] ||
          req.socket.remoteAddress;

        console.log(`🌏 클라이언트 IP: ${ip}`);
        const ipUrl = `https://ipwho.is/${ip}`;
        console.log(`🌐 [ipwho.is 요청] ${ipUrl}`);

        const ipInfo = await axios.get(ipUrl, { httpsAgent: agent });

        if (ipInfo.data.success) {
          lat = ipInfo.data.latitude;
          lon = ipInfo.data.longitude;
          console.log(
            `📍 ipwho.is 위치: ${ipInfo.data.country}, ${ipInfo.data.region}, ${ipInfo.data.city}`
          );
        } else {
          throw new Error("IP 위치 감지 실패");
        }
      } catch (err) {
        console.warn("⚠️ IP 감지 실패, 기본 위치(東京都 千代田区) 사용");
        lat = DEFAULT_LAT;
        lon = DEFAULT_LON;
      }
    }

    // 2️⃣ BigDataCloud 역지오코딩
    let geo = await reverseGeocode(lat, lon);

    // 결과가 없거나 undefined일 경우 기본값으로 대체
    if (!geo.city || !geo.prefecture) {
      console.warn("⚠️ 역지오코딩 결과 없음, 기본 지역 사용");
      geo = {
        country: DEFAULT_COUNTRY,
        prefecture: DEFAULT_PREF,
        city: DEFAULT_CITY,
      };
    }

    console.log(
      `🗾 역지오코딩 결과: ${geo.prefecture} ${geo.city} (${geo.country})`
    );

    const cityForWeather = geo.city || geo.prefecture || "Tokyo";
    const weather = await fetchWeather(cityForWeather, lat, lon);

    const result = {
      ip_debug: { lat, lon, cityFromIP: geo.city },
      location: {
        prefecture: geo.prefecture,
        city: geo.city,
        country: geo.country,
      },
      weather: {
        main: weather.weather[0].main,
        description: weather.weather[0].description,
        icon: weather.weather[0].icon,
        iconUrl: `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`,
      },
      main: weather.main,
      wind: weather.wind,
      clouds: weather.clouds,
      visibility: weather.visibility,
      sys: {
        sunrise: new Date(weather.sys.sunrise * 1000).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour12: false,
        }),
        sunset: new Date(weather.sys.sunset * 1000).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour12: false,
        }),
      },
      updatedAt: new Date().toISOString(),
    };

    cache.put(cacheKey, result, CACHE_TIME);
    console.log(`🟡 [API FETCH 완료] ${cityForWeather}`);
    res.json(result);
  } catch (err) {
    console.error("❌ nowWeather Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
