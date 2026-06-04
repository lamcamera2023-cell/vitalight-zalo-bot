```javascript
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const PORT = process.env.PORT || 8080;

const ZALO_ACCESS_TOKEN =
  process.env.ZALO_ACCESS_TOKEN;

// Trang kiểm tra hoạt động
app.get("/", (req, res) => {
  res.send("VITALIGHT CAMERA AI BOT ONLINE");
});

// Webhook test
app.get("/webhook", (req, res) => {
  res.status(200).send("Webhook OK");
});

// Nhận tin nhắn từ Zalo OA
app.post("/webhook", async (req, res) => {
  try {
    console.log(
      JSON.stringify(req.body, null, 2)
    );

    const data = req.body;

    // Bỏ qua nếu không phải tin nhắn text
    if (
      !data.sender ||
      !data.message ||
      !data.message.text
    ) {
      return res.sendStatus(200);
    }

    const userId = data.sender.id;
    const userMessage = data.message.text;

    console.log("User:", userMessage);

    // Claude AI
    const response =
      await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        temperature: 0.4,

        system: `
Bạn là trợ lý AI của VITALIGHT CAMERA.

Thông tin doanh nghiệp:

- Chuyên camera IMOU
- Chuyên camera DAHUA
- Chuyên camera EZVIZ
- Chuyên camera TAPO

Hotline:
0764486555

Website:
https://vitalight.vn

Quy tắc:

- Luôn trả lời tiếng Việt.
- Trả lời ngắn gọn.
- Tư vấn nhiệt tình.
- Nếu khách hỏi giá hãy tư vấn liên hệ hotline.
- Nếu không biết hãy đề nghị nhân viên hỗ trợ.
        `,

        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

    const aiReply =
      response.content[0].text;

    console.log("AI:", aiReply);

    // Gửi tin nhắn về Zalo
    await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        recipient: {
          user_id: userId,
        },
        message: {
          text: aiReply,
        },
      },
      {
        headers: {
          access_token:
            ZALO_ACCESS_TOKEN,
          "Content-Type":
            "application/json",
        },
      }
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error(
      "ERROR:",
      error.response?.data ||
        error.message ||
        error
    );

    return res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(
    `SERVER RUNNING ON PORT ${PORT}`
  );
});
```
