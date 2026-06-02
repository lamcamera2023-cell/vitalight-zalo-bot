import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Kiểm tra biến môi trường
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Thiếu OPENAI_API_KEY");
  process.exit(1);
}

if (!process.env.ZALO_OA_ACCESS_TOKEN) {
  console.error("❌ Thiếu ZALO_OA_ACCESS_TOKEN");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);

// ==================== HOME ====================

app.get("/", (req, res) => {
  res.send("Zalo AI Bot is running 🚀");
});

// ==================== HEALTH CHECK ====================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    server: "running",
    timestamp: new Date().toISOString(),
  });
});
app.get("/webhook/zalo", (req, res) => {
  res.status(200).send("Webhook OK");
});
// ==================== WEBHOOK ZALO ====================

app.post("/webhook/zalo", async (req, res) => {
  try {
    console.log(
      "📩 Webhook nhận:",
      JSON.stringify(req.body, null, 2)
    );

    const userId =
      req.body?.sender?.id ||
      req.body?.user_id;

    const userMessage =
      req.body?.message?.text ||
      req.body?.text;

    if (!userId || !userMessage) {
      console.log("⚠️ Không có nội dung tin nhắn");
      return res.status(200).send("No message");
    }

    console.log("👤 User:", userId);
    console.log("💬 Message:", userMessage);

    // Gọi OpenAI
    const completion =
      await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `
Bạn là trợ lý AI của Vitalight Camera.

Nhiệm vụ:
- Tư vấn camera Dahua, Hikvision
- Camera Wifi trong nhà, ngoài trời
- Đầu ghi hình
- Ổ cứng camera
- Thiết bị mạng
- Lắp đặt camera
- Hướng dẫn kỹ thuật
- Hỗ trợ khách hàng chuyên nghiệp

Luôn trả lời bằng tiếng Việt.
`,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

    const answer =
      completion.choices?.[0]?.message?.content ||
      "Xin lỗi, tôi chưa thể trả lời lúc này.";

    console.log("🤖 AI:", answer);

    // Gửi tin nhắn về Zalo OA
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

    console.log("📤 Zalo Response:", zaloResult);

    return res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return res.status(500).send("ERROR");
  }
});

// ==================== 404 ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});