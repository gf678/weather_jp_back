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

// ✅ デフォルト座標（東京都 千代田区）
const DEFAULT_LAT = 35.6938403;
const DEFAULT_LON = 139.753369;
const DEFAULT_PREF = "東京都";
const DEFAULT_CITY = "千代田区";
const DEFAULT_COUNTRY = "日本";

// ✅ 天気取得
const fetchWeather = async (city, lat, lon) => {
  let url;

  if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ja`;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${API_KEY}&units=metric&lang=ja`;
  }

  console.log(`🌐 [OpenWeather リクエスト] ${url}`);
  const { data } = await axios.get(url, { httpsAgent: agent });
  return data;
};

// ✅ 逆ジオコーディング
const reverseGeocode = async (lat, lon) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`;
  console.log(`🗾 [逆ジオコーディング リクエスト] ${url}`);
  const { data } = await axios.get(url, { httpsAgent: agent });

  return {
    country: data.countryName,
    prefecture: data.principalSubdivision,
    city: data.locality,
  };
};

// ✅ IP 正規化処理
const normalizeIp = (ip) => {
  if (!ip) return ip;
  return ip.replace(/^::ffff:/, "");
};

// ✅ メインエンドポイント
router.get("/nowWeather", async (req, res) => {
  try {
    let { city, lat, lon } = req.query;
    let ipRaw =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const ip = '218.219.126.34'; /* normalizeIp(ipRaw) */
    let cacheKey = `${ip}_${city || `${lat}_${lon}`}`;

    // ✅ キャッシュ確認
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`🟢 [キャッシュヒット] ${cacheKey}`);
      return res.json(cached);
    }

    // 1️⃣ IP ベース位置取得
    if (!lat || !lon) {
      try {
        console.log(`🌏 クライアントIP: ${ip}`);
        const ipUrl = `https://ipwho.is/${ip}`;
        console.log(`🌐 [ipwho.is リクエスト] ${ipUrl}`);

        const ipInfo = await axios.get(ipUrl, { httpsAgent: agent });

        if (ipInfo.data.success) {
          lat = ipInfo.data.latitude;
          lon = ipInfo.data.longitude;

          console.log(
            `📍 IP位置情報: ${ipInfo.data.country}, ${ipInfo.data.region}, ${ipInfo.data.city}`
          );
        } else {
          throw new Error("IP 位置取得に失敗");
        }
      } catch (err) {
        console.warn("⚠️ IP取得失敗、デフォルト位置（東京都 千代田区）を使用");
        lat = DEFAULT_LAT;
        lon = DEFAULT_LON;
      }
    }

    // 2️⃣ BigDataCloud 逆ジオコーディング
    let geo = await reverseGeocode(lat, lon);

    if (!geo.city || !geo.prefecture) {
      console.warn("⚠️ 逆ジオコーディング結果なし、デフォルト地域を使用");
      geo = {
        country: DEFAULT_COUNTRY,
        prefecture: DEFAULT_PREF,
        city: DEFAULT_CITY,
      };
    }

    console.log(
      `🗾 逆ジオコーディング結果: ${geo.prefecture} ${geo.city} (${geo.country})`
    );

    const cityForWeather = geo.city || geo.prefecture || "Tokyo";
    const weather = await fetchWeather(cityForWeather, lat, lon);

    // ✅ レスポンスデータ構築
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
    console.log(`🟡 [API 取得完了] ${cityForWeather}`);
    res.json(result);
  } catch (err) {
    console.error("❌ nowWeather エラー:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
