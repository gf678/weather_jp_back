// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import weatherRouter from "./routes/weather.js"; // 라우터 import

dotenv.config();
const app = express();

// 미들웨어
app.use(cors());
app.use(express.json());

// 기본 라우트 (테스트용)
app.get("/", (req, res) => {
  res.send("✅ weather backend server is running!");
});

app.use("/weather", weatherRouter);

// 서버 실행
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
