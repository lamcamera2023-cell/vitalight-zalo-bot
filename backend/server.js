import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

const PORT = process.env.PORT || 8080;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);

// Trang chủ
app.get("/", (req, res) => {
  res.status(200).send("Zalo AI Bot is running");
});

// Kiểm tra webhook bằng trình duyệt
app.get("/webhook/zalo", (req, res) => {
  res.status(200).send("Webhook OK");
});

// Webhook nhận sự kiện từ Zalo
app.post("/webhook/zalo", async (req, res) => {
  // Trả về 200 ngay lập tức
  res.status(200).send("OK");

  try {
    console.log("==================================");
    console.log("WEBHOOK RECEIVED");
    console.log(JSON.stringify(req.body, null, 2));

    const senderId = req.body?.sender?.id;

    const userMessage =
      req.body?.message?.text ||
      req.body?.message?.content ||
      "";

    if (!senderId) {
      console.log("Không tìm thấy sender id");
      return;
    }

    if (!userMessage) {
      console.log("Không có nội dung tin nhắn");
      return;
    }

    console.log("User ID:", senderId);
    console.log("Message:", userMessage);

    // Gọi OpenAI
    console.log("Calling OpenAI...");

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `
Bạn là trợ lý AI của Vitalight Camera.

Chuyên hỗ trợ:
- Camera Dahua
- Camera Hikvision
- Camera Wifi
- Đầu ghi hình
- Ổ cứng camera
- Lắp đặt camera
- Hỗ trợ kỹ thuật camera

Trả lời ngắn gọn, lịch sự, dễ hiểu.
`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const answer =
      completion?.choices?.[0]?.message?.content ||
      "Xin lỗi, tôi chưa thể trả lời lúc này.";

    console.log("AI trả lời:");
    console.log(answer);

    // Gửi lại cho Zalo
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
            user_id: senderId,
          },
          message: {
            text: answer,
          },
        }),
      }
    );

    const zaloResult = await zaloResponse.text();

    console.log("===== ZALO RESPONSE =====");
    console.log(zaloResult);
  } catch (error) {
    console.error("===== WEBHOOK ERROR =====");
    console.error(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});