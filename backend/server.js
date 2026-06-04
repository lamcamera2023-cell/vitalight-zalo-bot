```javascript
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const PORT = process.env.PORT || 8080;
const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;

// Health Check
app.get("/", (req, res) => {
  res.send("VITALIGHT Camera AI Bot Running");
});

// Webhook Verification
app.get("/webhook", (req, res) => {
  res.status(200).send("Webhook OK");
});

// Nhận tin nhắn từ Zalo OA
app.post("/webhook", async (req, res) => {
  try {
    console.log(
      "Webhook Data:",
      JSON.stringify(req.body, null, 2)
    );

    const data = req.body;

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
    const claudeResponse =
      await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        temperature: 0.5,

        system: `
Bạn là AI CSKH của cửa hàng VITALIGHT CAMERA.

Nhiệm vụ:

1. Tư vấn camera IMOU
2. Tư vấn camera DAHUA
3. Tư vấn camera EZVIZ
4. Tư vấn camera TAPO
5. Hướng dẫn cài đặt camera
6. Hướng dẫn xem camera từ xa
7. Hỗ trợ bảo hành
8. Hỗ trợ kỹ thuật

Quy tắc:

- Trả lời bằng tiếng Việt.
- Trả lời ngắn gọn.
- Chuyên nghiệp.
- Không bịa thông tin.
- Nếu không biết hãy đề nghị nhân viên hỗ trợ.

Thông tin cửa hàng:

Tên:
VITALIGHT CAMERA

Hotline:
0764486555

Website:
https://vitalight.vn
        `,

        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

    const aiReply =
      claudeResponse.content[0].text;

    console.log("Claude:", aiReply);

    // Gửi trả lời về Zalo OA
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
          access_token: ZALO_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(
      "Webhook Error:",
      error.response?.data || error.message
    );

    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log(
    `VITALIGHT BOT running on port ${PORT}`
  );
});
```
