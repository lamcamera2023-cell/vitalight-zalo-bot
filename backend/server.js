import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Kiểm tra biến môi trường
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("ZALO_OA_ACCESS_TOKEN:", !!process.env.ZALO_OA_ACCESS_TOKEN);

// Test
app.get("/", (req, res) => {
  res.send("Zalo AI Bot is running");
});

// Webhook nhận tin nhắn từ Zalo
app.post("/webhook/zalo", async (req, res) => {
  try {
    console.log("Webhook:", JSON.stringify(req.body));

    const userId = req.body?.sender?.id;
    const userMessage = req.body?.message?.text;

    if (!userId || !userMessage) {
      return res.status(200).send("No message");
    }

    // Gọi OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý AI của Vitalight Camera, tư vấn camera, đầu ghi, wifi, báo động và kỹ thuật lắp đặt."
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const answer = completion.choices[0].message.content;

    // Gửi trả lời về Zalo
    await fetch(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: process.env.ZALO_OA_ACCESS_TOKEN
        },
        body: JSON.stringify({
          recipient: {
            user_id: userId
          },
          message: {
            text: answer
          }
        })
      }
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});