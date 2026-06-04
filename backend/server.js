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

const SYSTEM_PROMPT = `
Bạn là trợ lý AI của VITALIGHT CAMERA.

Thông tin doanh nghiệp:

- Chuyên camera IMOU
- Chuyên camera DAHUA
- Chuyên camera EZVIZ
- Chuyên camera TAPO

Hotline: 0937254555

Website: https://vitalight.vn

Quy tắc:
- Luôn trả lời tiếng Việt.
- Trả lời ngắn gọn.
- Tư vấn nhiệt tình.
- Nếu khách hỏi giá hãy tư vấn liên hệ hotline.
- Nếu không biết hãy đề nghị nhân viên hỗ trợ.
`;

app.get("/", (req, res) => {
  res.send("VITALIGHT CAMERA AI BOT ONLINE");
});

app.get("/webhook", (req, res) => {
  res.status(200).send("Webhook OK");
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook data:");
    console.log(JSON.stringify(req.body, null, 2));

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

    console.log("USER:", userMessage);

    const claudeResponse =
      await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

    const aiReply =
      claudeResponse.content[0].text;

    console.log("AI:", aiReply);

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
            process.env.ZALO_ACCESS_TOKEN,
          "Content-Type":
            "application/json",
        },
      }
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error(
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