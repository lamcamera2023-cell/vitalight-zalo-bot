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
  maxRetries: 5, // Tự động thử lại khi bị rate limit (lỗi 429)
});

const PORT = process.env.PORT || 8080;

const ZALO_APP_ID = process.env.ZALO_APP_ID;
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET;
const TOKEN_FILE = "/data/tokens.json";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1MRdaubDM8sKgCcfmpUC4ElM1T1FoaUNR9SK8ZjvrH8w/export?format=csv";

/* ===== CẤU HÌNH LƯU DỮ LIỆU HỌC ĐƯỢC VÀO GOOGLE SHEET ===== */
// Dán link Web app (Apps Script) bạn lấy ở bước Deploy vào đây:
const LEARN_WEBAPP_URL =
  process.env.LEARN_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbzESvIPLe8I-UJXYKx09JD-RuNj-QidR4c50WyvKi0P4TbAriWsQibIrCz8vP0ytBglwg/exec";
// Mật khẩu phải GIỐNG với chuỗi "secret" trong Apps Script:
const LEARN_SECRET = process.env.LEARN_SECRET || "vitalight_secret_2025";
// Ký hiệu admin gõ ở đầu câu để bot lưu lại:
const SAVE_TRIGGER = "#luu";

// Dữ liệu Google Sheet (từng dòng)
let knowledgeRows = [];

// Lịch sử hội thoại theo từng người dùng (lưu trong bộ nhớ)
const conversationHistory = {};
const MAX_HISTORY = 6; // nhớ 6 tin gần nhất (3 lượt qua lại)

// Nhớ câu hỏi gần nhất của từng khách, để khi admin lưu thì gắn kèm ngữ cảnh
const lastUserQuestion = {};

/* ================= ĐỌC GOOGLE SHEET ================= */

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

// Bỏ dấu tiếng Việt + viết thường để so khớp
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Tìm các dòng liên quan nhất tới câu hỏi
function findRelevantRows(question, maxRows = 8) {
  if (knowledgeRows.length === 0) return [];

  const qWords = normalize(question)
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const header = knowledgeRows[0];
  const dataRows = knowledgeRows.slice(1);

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
- Khi khách đang hỏi về sản phẩm, tính năng hoặc lỗi của một hãng, hãy NHỚ hãng đó từ các tin nhắn trước và bám sát, KHÔNG hỏi lại khách dùng camera hãng nào.
- Ví dụ: khi khách đã hỏi về camera IMOU, hãy tư vấn mọi thứ về IMOU (cài đặt, tính năng, lỗi thường gặp) và KHÔNG chuyển sang hãng khác cho tới khi khách chủ động hỏi về hãng khác.
- Chỉ hỏi lại hãng khi khách hỏi vấn đề chung mà chưa từng nhắc tới hãng nào trong cả cuộc trò chuyện.

DỮ LIỆU THAM KHẢO (các dòng liên quan tới câu hỏi, định dạng: các cột cách nhau bằng dấu |):
${dataText}

Hãy dựa vào dữ liệu trên để trả lời. Nếu có link video phù hợp thì gửi cho khách.
`;
}

/* ===== LƯU DỮ LIỆU HỌC ĐƯỢC VÀO GOOGLE SHEET ===== */
async function saveToSheet(cauHoi, traLoi) {
  try {
    const res = await axios.post(
      LEARN_WEBAPP_URL,
      {
        secret: LEARN_SECRET,
        cau_hoi: cauHoi || "",
        tra_loi: traLoi || "",
      },
      { timeout: 10000 }
    );
    console.log("LƯU SHEET:", res.data);
    return true;
  } catch (e) {
    console.error("Lỗi lưu vào Sheet:", e.message);
    return false;
  }
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

/* ===== GỬI TIN NHẮN VỀ ZALO ===== */
async function sendZaloMessage(userId, text) {
  const accessToken = await refreshAccessToken();
  const zaloResponse = await axios.post(
    "https://openapi.zalo.me/v3.0/oa/message/cs",
    {
      recipient: { user_id: userId },
      message: { text },
    },
    {
      headers: {
        access_token: accessToken,
        "Content-Type": "application/json",
      },
    }
  );
  console.log("ZALO SEND:", JSON.stringify(zaloResponse.data));
  return zaloResponse.data;
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
  handleEvent(req.body);
});

/* ===== XỬ LÝ TẤT CẢ SỰ KIỆN TỪ ZALO ===== */
async function handleEvent(data) {
  try {
    console.log("====== WEBHOOK RECEIVED ======");
    console.log(JSON.stringify(data, null, 2));

    const eventName = data.event_name;

    // 1) KHÁCH gửi tin -> bot tư vấn
    if (eventName === "user_send_text") {
      await handleUserMessage(data);
      return;
    }

    // 2) ADMIN/OA gửi tin -> nếu có #luu thì lưu vào Sheet
    // Tùy cấu hình, sự kiện admin gửi có thể là 'oa_send_text' hoặc 'anonymous_send_text'
    if (eventName === "oa_send_text" || eventName === "anonymous_send_text") {
      await handleAdminMessage(data);
      return;
    }

    console.log("Bỏ qua sự kiện:", eventName);
  } catch (error) {
    console.error("WEBHOOK ERROR FULL:");
    console.error(JSON.stringify(error.response?.data, null, 2));
    console.error(error.message);
  }
}

/* ===== KHI KHÁCH NHẮN ===== */
async function handleUserMessage(data) {
  if (!data.sender || !data.message || !data.message.text) {
    return;
  }

  const userId = data.sender.id;
  const userMessage = data.message.text;
  console.log("USER:", userMessage);

  // Ghi nhớ câu hỏi gần nhất của khách (để admin lưu kèm ngữ cảnh)
  lastUserQuestion[userId] = userMessage;

  // Lấy lịch sử hội thoại của khách này
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [];
  }
  const history = conversationHistory[userId];

  // Thêm tin nhắn mới của khách
  history.push({ role: "user", content: userMessage });

  // Gọi Claude kèm lịch sử để bot nhớ ngữ cảnh
  let aiReply;
  try {
    const claudeResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      temperature: 0.4,
      system: buildSystemPrompt(userMessage),
      messages: history,
    });
    aiReply = claudeResponse.content[0].text;
  } catch (err) {
    // Sau khi SDK đã tự thử lại mà vẫn lỗi (vd quá tải)
    if (err.status === 429) {
      console.error("Vẫn bị rate limit sau khi retry:", err.message);
      aiReply =
        "Dạ hệ thống đang hơi bận ạ, anh/chị vui lòng nhắn lại sau ít phút giúp em, hoặc gọi hotline 0937254555 để được hỗ trợ ngay nhé!";
      await sendZaloMessage(userId, aiReply);
      return; // không lưu câu xin lỗi vào lịch sử
    }
    throw err;
  }
  console.log("AI:", aiReply);

  // Lưu câu trả lời của bot vào lịch sử
  history.push({ role: "assistant", content: aiReply });

  // Chỉ giữ MAX_HISTORY tin gần nhất để tiết kiệm token
  if (history.length > MAX_HISTORY) {
    conversationHistory[userId] = history.slice(-MAX_HISTORY);
  }

  // Gửi tin về Zalo cho khách
  await sendZaloMessage(userId, aiReply);
}

/* ===== KHI ADMIN NHẮN (học dữ liệu) ===== */
async function handleAdminMessage(data) {
  // Lấy nội dung admin gõ
  const adminText =
    (data.message && data.message.text) ? data.message.text.trim() : "";
  if (!adminText) return;

  // Người nhận (khách) - dùng để lấy câu hỏi gần nhất của họ
  const recipientId =
    (data.recipient && data.recipient.id) ? data.recipient.id : null;

  console.log("ADMIN:", adminText);

  // Chỉ lưu khi admin gõ #luu ở đầu câu
  if (!normalize(adminText).startsWith(normalize(SAVE_TRIGGER))) {
    console.log("Admin không gõ #luu -> bỏ qua, không lưu.");
    return;
  }

  // Bỏ ký hiệu #luu ở đầu, lấy phần nội dung thật
  const noiDung = adminText.slice(SAVE_TRIGGER.length).trim();
  if (!noiDung) {
    console.log("Sau #luu không có nội dung -> bỏ qua.");
    return;
  }

  // Câu hỏi gần nhất của khách tương ứng (nếu có)
  const cauHoi = recipientId ? lastUserQuestion[recipientId] || "" : "";

  const ok = await saveToSheet(cauHoi, noiDung);

  // Sau khi lưu xong, cập nhật lại dữ liệu Sheet ngay để dùng được luôn
  if (ok) {
    await loadKnowledgeBase();
  }
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "VITALIGHT CAMERA BOT" });
});

app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});