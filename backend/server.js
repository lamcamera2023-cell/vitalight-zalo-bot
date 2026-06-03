import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// Gemini
const ai = new GoogleGenAI({
apiKey: process.env.GEMINI_API_KEY,
});

// Kiểm tra biến môi trường
console.log("GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);

// Trang chủ
app.get("/", (req, res) => {
res.status(200).send("Zalo AI Bot is running");
});

// Test webhook
app.get("/webhook/zalo", (req, res) => {
res.status(200).send("Webhook OK");
});

// Test Gemini
app.get("/test-gemini", async (req, res) => {
try {
const response = await ai.models.generateContent({
model: "gemini-2.5-flash",
contents: "Xin chào",
});

```
res.json({
  success: true,
  answer: response.text,
});
```

} catch (error) {
console.error(error);

```
res.status(500).json({
  success: false,
  error: error.message,
});
```

}
});

// WEBHOOK ZALO
app.post("/webhook/zalo", async (req, res) => {
// Trả về ngay để tránh timeout
res.status(200).send("OK");

try {
console.log("================================");
console.log("ZALO WEBHOOK RECEIVED");
console.log(JSON.stringify(req.body, null, 2));

```
const userId =
  req.body?.sender?.id ||
  req.body?.user_id ||
  req.body?.user_id_by_app;

const userMessage =
  req.body?.message?.text ||
  req.body?.text;

console.log("USER ID:", userId);
console.log("MESSAGE:", userMessage);

if (!userId || !userMessage) {
  console.log("Không có nội dung tin nhắn");
  return;
}

// Gọi Gemini
const geminiResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `
```

Bạn là trợ lý AI của Vitalight Camera.

Nhiệm vụ:

* Tư vấn camera Dahua
* Tư vấn camera Hikvision
* Tư vấn camera Wifi
* Đầu ghi hình
* Ổ cứng camera
* Thi công lắp đặt camera
* Hỗ trợ kỹ thuật camera

Trả lời ngắn gọn, chuyên nghiệp, dễ hiểu.

Câu hỏi khách hàng:
${userMessage}
`,
});

```
const answer =
  geminiResponse.text ||
  "Xin lỗi, hiện tại tôi chưa thể trả lời.";

console.log("AI ANSWER:");
console.log(answer);

// Gửi về Zalo
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

const result = await zaloResponse.text();

console.log("ZALO RESPONSE:");
console.log(result);
```

} catch (error) {
console.error("WEBHOOK ERROR:");
console.error(error);
}
});

app.listen(PORT, "0.0.0.0", () => {
console.log(`Server running on port ${PORT}`);
});
