import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Kiểm tra biến môi trường
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);

// Trang chủ
app.get("/", (req, res) => {
  res.send("Zalo AI Bot is running");
});

// Test webhook bằng trình duyệt
app.get("/webhook/zalo", (req, res) => {
  res.status(200).send("Webhook OK");
});

// Webhook nhận tin nhắn từ Zalo OA
app.post("/webhook/zalo", async (req, res) => {
  // Trả 200 NGAY LẬP TỨC để Zalo không timeout
  res.status(200).send("OK");

  try {
    console.log("===============");
    console.log("Webhook nhận:");
    console.log(JSON.stringify(req.body, null, 2));

    const userId =
      req.body?.sender?.id ||
      req.body?.user_id;

    const userMessage =
      req.body?.message?.text ||
      req.body?.text;

    console.log("User ID:", userId);
    console.log("Message:", userMessage);

    if (!userId || !userMessage) {
      console.log("Không có nội dung tin nhắn");
      return;
    }

    // Gọi OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `
Bạn là trợ lý AI của Vitalight Camera.

Nhiệm vụ:
- Tư vấn camera Dahua
- Tư vấn camera Hikvision
- Camera Wifi
- Đầu ghi hình
- Ổ cứng lưu trữ
- Thi công lắp đặt camera
- Hỗ trợ kỹ thuật camera

Trả lời ngắn gọn, dễ hiểu và chuyên nghiệp.
`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const answer =
      completion.choices?.[0]?.message?.content ||
      "Xin lỗi, tôi chưa thể trả lời lúc này.";

    console.log("AI trả lời:", answer);

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

    const result = await zaloResponse.text();

    console.log("Zalo Response:");
    console.log(result);

  } catch (error) {
    console.error("WEBHOOK ERROR:");
    console.error(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});