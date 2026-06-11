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

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1MRdaubDM8sKgCcfmpUC4ElM1T1FoaUNR9SK8ZjvrH8w/export?format=csv";

// Lưu dữ liệu Sheet dưới dạng từng dòng
let knowledgeRows = [];

// Tách CSV thành các dòng (xử lý cơ bản dấu phẩy trong ngoặc kép)
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const cells = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}

async function loadKnowledgeBase() {
  try {
    const res = await axios.get(SHEET_CSV_URL, { timeout: 10000 });
    knowledgeRows = parseCSV(res.data);
    console.log("Đã tải Google Sheet, số dòng:", knowledgeRows.length);
  } catch (e) {
    console.error("Lỗi tải Google Sheet:", e.message);
  }
}

loadKnowledgeBase();
setInterval(loadKnowledgeBase, 5 * 60 * 1000);

// Bỏ dấu tiếng Việt + viết thường để so khớp dễ hơn
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Tìm các dòng liên quan nhất tới câu hỏi của khách
function findRelevantRows(question, maxRows = 8) {
  if (knowledgeRows.length === 0) return [];

  const qWords = normalize(question)
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const header = knowledgeRows[0];
  const dataRows = knowledgeRows.slice(1);

  // Tính điểm cho mỗi dòng theo số từ khóa khớp
  const scored = dataRows.map((row) => {
    const rowText = normalize(row.join(" "));
    let score = 0;
    for (const w of qWords) {
      if (rowText.includes(w)) score++;
    }
    return { row, score };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRows)
    .map((s) => s.row);

  if (matched.length === 0) return [];

  // Trả về kèm dòng tiêu đề để Claude hiểu cấu trúc
  return [header, ...matched];
}

function buildSystemPrompt(question) {
  const relevant = findRelevantRows(question);
  let dataText = "";
  if (relevant.length > 0) {
    dataText = relevant.map((r) => r.join(" | ")).join("\n");
  } else {
    dataText = "(Không tìm thấy dòng phù hợp trong dữ liệu.)";
  }

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
- Nếu khách hỏi giá: tư vấn liên hệ hotline 0937254555.
- Nếu không có thông tin phù hợp: đề nghị anh/chị liên hệ hotline.
- Nếu khách chưa nói rõ dùng camera hãng nào mà cần gửi video, hãy hỏi lại hãng trước.
- Khi khách đang hỏi về sản phẩm hay tính năng hoặc lỗi nào đó hãy bám sát theo đúng mẫu sản phẩm đó bằng việc ghi nhớ câu hỏi trước đó
DỮ LIỆU THAM KHẢO (các dòng liên quan tới câu hỏi, định dạng: các cột cách nhau bằng dấu |):
${dataText}

Hãy dựa vào dữ liệu trên để trả lời. Nếu có link video phù hợp thì gửi cho khách.
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
      model: "claude-haiku-4-5",
      max_tokens: 500,
      temperature: 0.4,
      system: buildSystemPrompt(userMessage),
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