import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

console.log("================================");
console.log("SERVER STARTING...");
console.log("GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);
console.log("================================");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Zalo AI Bot is running");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    server: "running",
    time: new Date(),
  });
});

app.get("/webhook/zalo", (req, res) => {
  res.send("Webhook OK");
});

app.get("/test-gemini", async (req, res) => {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Xin chào",
    });

    res.json({
      success: true,
      answer: result.text,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/webhook/zalo", async (req, res) => {
  res.status(200).send("OK");

  try {
    console.log("ZALO WEBHOOK:");
    console.log(JSON.stringify(req.body, null, 2));

    const userId =
      req.body?.sender?.id ||
      req.body?.user_id ||
      req.body?.user_id_by_app;

    const userMessage =
      req.body?.message?.text ||
      req.body?.text;

    if (!userId || !userMessage) {
      console.log("NO MESSAGE");
      return;
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `
Bạn là trợ lý AI của Vitalight Camera.

Chuyên:
- Camera Dahua
- Camera Hikvision
- Camera Wifi
- Đầu ghi hình
- Ổ cứng camera
- Thi công lắp đặt
- Hỗ trợ kỹ thuật

Khách hỏi:

${userMessage}
`,
    });

    const answer =
      result.text ||
      "Xin lỗi, tôi chưa thể trả lời lúc này.";

    const zaloResponse = await fetch(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: process.env.ZALO_OA_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          recipient: {
            user_id: userId,
          },
          message: {
            text: answer,
          },
        }),
      }
    );

    const zaloResult = await zaloResponse.text();

    console.log("ZALO RESPONSE:");
    console.log(zaloResult);
  } catch (error) {
    console.error("WEBHOOK ERROR:");
    console.error(error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});