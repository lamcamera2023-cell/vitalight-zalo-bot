import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const PORT = process.env.PORT || 8080;

const ZALO_APP_ID = process.env.ZALO_APP_ID;
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET;
const TOKEN_FILE = "/data/tokens.json";

// Link CSV của Google Sheet
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1MRdaubDM8sKgCcfmpUC4ElM1T1FoaUNR9SK8ZjvrH8w/edit?usp=sharing";

// Bộ nhớ tạm chứa nội dung Sheet
let knowledgeBase = "";

// Tải nội dung Google Sheet về
async function loadKnowledgeBase() {
  try {
    const res = await axios.get(SHEET_CSV_URL, { timeout: 10000 });
    knowledgeBase = res.data;
    console.log("Đã tải dữ liệu từ Google Sheet, độ dài:", knowledgeBase.length);
  } catch (e) {
    console.error("Lỗi tải Google Sheet:", e.message);
  }
}

// Tải lúc khởi động và làm mới mỗi 5 phút
loadKnowledgeBase();
setInterval(loadKnowledgeBase, 5 * 60 * 1000);

function buildSystemPrompt() {
  return `
Bạn là trợ lý AI của VITALIGHT CAMERA.

Thông tin doanh nghiệp:
- Chuyên camera IMOU, DAHUA, EZVIZ, TAPO
Hotline: 0937254555
Website: https://vitalight.vn

Quy tắc trả lời:
- Luôn trả lời tiếng Việt.
- Xưng "em" hoặc "shop", gọi khách là "anh/chị".
- Trả lời ngắn gọn, thân thiện, nhiệt tình.
- Nếu khách hỏi giá: tư vấn anh/chị liên hệ hotline 0937254555.
- Nếu không biết hoặc vấn đề phức tạp: đề nghị anh/chị liên hệ hotline.
- Khi khách đang hỏi về sản phẩm hay tính năng hoặc lỗi nào đó hãy bám sát theo đúng mẫu sản phẩm đó bằng việc ghi nhớ câu hỏi trước đó

DỮ LIỆU CÂU HỎI - TRẢ LỜI (tham khảo bảng dưới để trả lời khách):
Bảng dưới ở định dạng CSV, mỗi dòng là một tình huống. Hãy tìm dòng phù hợp nhất với câu hỏi của khách và trả lời theo nội dung + gửi link video nếu có. Nếu khách chưa nói rõ dùng camera hãng nào, hãy hỏi lại trước khi gửi link.

${knowledgeBase}
`;
}

/* ================= QUẢN LÝ TOKEN ZALO ================= */

function getRefreshToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (data.refresh_token) return data.refresh_token;
    }
  } catch (e) {
    console.error("Lỗi đọc file token:", e.message);
  }
  return process.env.ZALO_OA_REFRESH_TOKEN;
}

function saveTokens(accessToken, refreshToken) {
  try {
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify(
        { access_token: accessToken, refresh_token: refreshToken },
        null,
        2
      )
    );
    console.log("Đã lưu token mới vào file.");
  } catch (e) {
    console.error("Lỗi lưu file token:", e.message);
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  const params = new URLSearchParams();
  params.append("refresh_token", refreshToken);
  params.append("app_id", ZALO_APP_ID);
  params.append("grant_type", "refresh_token");

  const response = await axios.post(
    "https://oauth.zaloapp.com/v4/oa/access_token",
    params,
    {
      headers: {
        secret_key: ZALO_APP_SECRET,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const newAccessToken = response.data.access_token;
  const newRefreshToken = response.data.refresh_token;

  if (!newAccessToken) {
    throw new Error(
      "Không lấy được access token: " + JSON.stringify(response.data)
    );
  }

  saveTokens(newAccessToken, newRefreshToken);
  return newAccessToken;
}

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.send("VITALIGHT CAMERA AI BOT ONLINE");
});

app.get("/webhook/zalo", (req, res) => {
  console.log("Webhook GET OK");
  return res.status(200).send("Webhook OK");
});

app.post("/webhook/zalo", (req, res) => {
  res.sendStatus(200);
  handleMessage(req.body);
});

async function handleMessage(data) {
  try {
    console.log("====== WEBHOOK RECEIVED ======");
    console.log(JSON.stringify(data, null, 2));

    if (data.event_name !== "user_send_text") {
      console.log("Bỏ qua sự kiện:", data.event_name);
      return;
    }

    if (!data.sender || !data.message || !data.message.text) {
      return;
    }

    const userId = data.sender.id;
    const userMessage = data.message.text;
    console.log("USER:", userMessage);

    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      temperature: 0.4,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: userMessage }],
    });

    const aiReply = claudeResponse.content[0].text;
    console.log("AI:", aiReply);

    const accessToken = await refreshAccessToken();

    const zaloResponse = await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        recipient: { user_id: userId },
        message: { text: aiReply },
      },
      {
        headers: {
          access_token: accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("ZALO SEND:", JSON.stringify(zaloResponse.data));
  } catch (error) {
    console.error("WEBHOOK ERROR FULL:");
    console.error(JSON.stringify(error.response?.data, null, 2));
    console.error(error.message);
  }
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "VITALIGHT CAMERA BOT" });
});

app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
