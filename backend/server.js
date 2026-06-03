import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// Trang chủ
app.get("/", (req, res) => {
  res.status(200).send("Zalo AI Bot is running");
});

// Kiểm tra webhook bằng trình duyệt
app.get("/webhook/zalo", (req, res) => {
  res.status(200).send("Webhook OK");
});

// Webhook Zalo
app.post("/webhook/zalo", (req, res) => {
  console.log("========== ZALO WEBHOOK ==========");
  console.log("Headers:");
  console.log(JSON.stringify(req.headers, null, 2));

  console.log("Body:");
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).json({
    error: 0,
    message: "success"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});