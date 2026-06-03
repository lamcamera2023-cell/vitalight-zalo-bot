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

// Home
app.get("/", (req, res) => {
res.send("Zalo AI Bot is running");
});

// Health Check
app.get("/health", (req, res) => {
res.json({
success: true,
server: "running",
time: new Date(),
});
});

// Webhook Test
app.get("/webhook/zalo", (req, res) => {
res.send("Webhook OK");
});

// Gemini Test
app.get("/test-gemini", async (req, res) => {
try {
console.log("TEST GEMINI START");

```
const result = await Promise.race([
  ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Xin chào",
  }),

  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout")), 30000)
  ),
]);

console.log("TEST GEMINI SUCCESS");

res.json({
  success: true,
  answer: result.text,
});
```

} catch (error) {
console.error("TEST GEMINI ERROR");
console.error(error);

```
res.status(500).json({
  success: false,
  error: error.message,
});
```

}
});

// ZALO WEBHOOK
app.post("/webhook/zalo", async (req, res) => {
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
  console.log("NO MESSAGE FOUND");
  return;
}

console.log("CALL GEMINI...");

const result = await Promise.race([
  ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `
```

Bạn là trợ lý AI của Vitalight Camera.

Nhiệm vụ:

* Tư vấn camera Dahua
* Tư vấn camera Hikvision
* Camera Wifi
* Đầu ghi hình
* Ổ cứng camera
* Thi công camera
* Hỗ trợ kỹ thuật

Khách hỏi:

${userMessage}
`,
}),

```
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout")), 30000)
  ),
]);

const answer =
  result?.text ||
  "Xin lỗi, hiện tại tôi chưa thể trả lời.";

console.log("AI ANSWER:");
console.log(answer);

console.log("SEND TO ZALO...");

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
```

} catch (error) {
console.error("WEBHOOK ERROR:");
console.error(error);
}
});

app.listen(PORT, "0.0.0.0", () => {
console.log(`Server running on port ${PORT}`);
});
