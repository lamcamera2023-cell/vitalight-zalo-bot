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

/*
===================================
WEBHOOK ZALO
===================================
*/

app.get("/webhook/zalo", (req, res) => {
  console.log("Webhook GET OK");
  return res.status(200).send("Webhook OK");
});

app.post("/webhook/zalo", async (req, res) => {
  try {
    console.log("====== WEBHOOK RECEIVED ======");
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
        model: "claude-haiku-4-5",
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

    const zaloResponse = await axios.post(
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
            process.env.ZALO_OA_ACCESS_TOKEN,
          "Content-Type":
            "application/json",
        },
      }
    );

    console.log(
      "ZALO SEND:",
      JSON.stringify(zaloResponse.data)
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR FULL:");
console.error(JSON.stringify(error.response?.data, null, 2));
console.error(error.message);

    return res.sendStatus(200);
  }
});

/*
===================================
HEALTH CHECK
===================================
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "VITALIGHT CAMERA BOT",
  });
});

app.listen(PORT, () => {
  console.log(
    `SERVER RUNNING ON PORT ${PORT}`
  );
});