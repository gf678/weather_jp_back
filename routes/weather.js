import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const API_KEY = process.env.API_KEY;

// /weather/nowWeather?city=마루마루 지금 날씨
router.get("/nowWeather", async (req, res) => {
  const city = req.query.city || "Nerima";

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric&lang=ja`;
    const response = await axios.get(url);
    const data = response.data;

    const result = {
      // 날씨
      weather: {
        description: data.weather[0].description, // 상세 설명
      },

      // 온도
      main: {
        temp: data.main.temp,              // 현재 온도
        feels_like: data.main.feels_like,  // 체감 온도
        temp_min: data.main.temp_min,      // 최저 기온
        temp_max: data.main.temp_max,      // 최고 기온
        pressure: data.main.pressure,      // 기압(hPa)
        sea_level: data.main.sea_level,    // 해수면 기압(hPa)
        grnd_level: data.main.grnd_level,  // 지상 기압(hPa)
        humidity: data.main.humidity       // 습도(%)
      },

      // 바람
      wind: {
        speed: data.wind.speed,            // 풍속 (m/s)
        deg: data.wind.deg,                // 풍향 (도)
        gust: data.wind.gust               // 돌풍 (m/s)
      },

      // 구름
      clouds: {
        all: data.clouds.all               // 운량(%)
      },

      // 강수
      rain: {
        "1h": data.rain?.["1h"] || 0       // 최근 1시간 강수량(mm), 없으면 0
      },
      snow: {
        "1h": data.snow?.["1h"] || 0       // 최근 1시간 적설량(mm), 없으면 0
      },

      // 시정
      visibility: data.visibility,          // 시정(m)

      // 시간 관련                       
      dt: new Date(data.dt * 1000).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false
      }),
      sys: {
        type: data.sys.type,
        id: data.sys.id,
        message: data.sys.message,
        sunrise: new Date(data.sys.sunrise * 1000).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour12: false
        }),
        sunset: new Date(data.sys.sunset * 1000).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour12: false
        })
      },
    };

    res.json(result);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});
// /weather/todayWeather?city=마루마루 시간별 날씨 jmt 적용
router.get("/hourWeather", async (req, res) => { 
  const city = req.query.city || "Nerima";

  try {
    const url = `https://pro.openweathermap.org/data/2.5/forecast/hourly?q=${city}&appid=${API_KEY}&units=metric&lang=ja`;
    const response = await axios.get(url);
    const data = response.data;

    // 그 다음에 list를 잘라서 map 실행
    const sliced = data.list.slice(8, 29);

    const result = sliced.map(item => ({
      temp: item.main.temp,
      feels_like: item.main.feels_like,
      humidity: item.main.humidity,
      wind_speed: item.wind.speed,
      weather: item.weather[0].description,
      cloudiness: item.clouds.all,
      datetime: item.dt_txt
    }));

    res.json(result);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});
// /weather/todayWeather?city=마루마루 오늘 날씨 jmt 적용
router.get("/todayWeather", async (req, res) => {
  const city = req.query.city || "Nerima";

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast/daily?q=${encodeURIComponent(
      city
    )}&cnt=1&appid=${API_KEY}&lang=ja&units=metric`;

    const { data } = await axios.get(url);

    const today = data.list?.[0]; // list 배열에서 오늘 날씨만

    if (!today) {
      return res.status(404).json({ error: "오늘 날씨 정보를 찾을 수 없습니다." });
    }

    const result = {
      date: new Date(today.dt * 1000).toISOString().split("T")[0],
      temp: today.temp.day,
      temp_min: today.temp.min,
      temp_max: today.temp.max,
      feels_like: today.feels_like.day,
      humidity: today.humidity,
      pressure: today.pressure,
      wind_speed: today.speed,
      wind_deg: today.deg,
      cloudiness: today.clouds,
      weather: today.weather?.[0]?.description || "情報なし",
      rain: today.rain ?? 0,
      sunrise: new Date(today.sunrise * 1000).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false
      }),
      sunset: new Date(today.sunset * 1000).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false
      })
    };

    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});
// /weather/todayWeather?city=마루마루 주간 날씨 jmt 적용
router.get("/dailyWeather", async (req, res) => {
  const city = req.query.city || "Nerima";

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast/daily?q=${encodeURIComponent(
      city
    )}&cnt=10&appid=${API_KEY}&lang=ja&units=metric`;

    const { data } = await axios.get(url);

    const list = data.list?.slice(1); // 오늘 제외, 2~10일차

    if (!list || list.length === 0) {
      return res.status(404).json({ error: "예보 정보를 찾을 수 없습니다." });
    }

    const formatJST = (unix) =>
      new Date(unix * 1000).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour12: false
      });

    const result = list.map((day) => ({
      date: new Date(day.dt * 1000).toISOString().split("T")[0],
      temp: day.temp.day,
      temp_min: day.temp.min,
      temp_max: day.temp.max,
      feels_like: day.feels_like.day,
      humidity: day.humidity,
      pressure: day.pressure,
      wind_speed: day.speed,
      wind_deg: day.deg,
      cloudiness: day.clouds,
      weather: day.weather?.[0]?.description || "情報なし",
      rain: day.rain ?? 0,
      sunrise: formatJST(day.sunrise),
      sunset: formatJST(day.sunset)
    }));

    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});



export default router;