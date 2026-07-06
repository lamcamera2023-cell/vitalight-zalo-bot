import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phep CORS de Mini App goi vao
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  maxRetries: 5, // Tu dong thu lai khi bi rate limit (loi 429)
});

const PORT = process.env.PORT || 8080;

const ZALO_APP_ID = process.env.ZALO_APP_ID;
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET;
const TOKEN_FILE = "/data/tokens.json";
// ===== ZALO CHECKOUT SDK =====
const MINIAPP_APP_ID = "1082547878176959903";
const MINIAPP_PRIVATE_KEY = process.env.ZALO_MINIAPP_PRIVATE_KEY;
const ZALO_ALLOWED_IPS = ["118.102.2.29", "49.213.78.2"];

// Tạo chữ ký MAC theo chuẩn Zalo (HmacSHA256)
function createMac(data, privateKey) {
  // Sắp xếp key theo thứ tự alphabet, nối kiểu key=value&key=value...
  const sortedKeys = Object.keys(data).sort();
  const rawString = sortedKeys
    .map((key) => `${key}=${data[key]}`)
    .join("&");
  return crypto
    .createHmac("sha256", privateKey)
    .update(rawString)
    .digest("hex");
}
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1MRdaubDM8sKgCcfmpUC4ElM1T1FoaUNR9SK8ZjvrH8w/export?format=csv";

/* ============================================================
   >>> DANH SACH USER_ID CUA ADMIN <<<
   Day la (cac) tai khoan Zalo duoc quyen "day" bot.
   Khi tai khoan nay nhan tin cho OA, bot se coi do la kien thuc
   va luu vao Google Sheet, thay vi tu van nhu khach.
   Nhieu admin thi them dong, cach nhau bang dau phay.
   ============================================================ */
const ADMIN_IDS = [
  "6800186335928158597",
];

/* ===== CAU HINH LUU DU LIEU HOC DUOC VAO GOOGLE SHEET ===== */
const LEARN_WEBAPP_URL =
  process.env.LEARN_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbwuxfWJQMaGgtRZmnR1HBuV8QnVozkcsnYbN_i3xmkyyy6V2FMlf_HVkv-v-M9TJo9Rrg/exec";
const LEARN_SECRET = process.env.LEARN_SECRET || "vitalight_secret_2025";

// Du lieu Google Sheet (tung dong)
let knowledgeRows = [];

// Lich su hoi thoai theo tung nguoi dung (luu trong bo nho)
const conversationHistory = {};
const MAX_HISTORY = 4; // nho 4 tin gan nhat (2 luot qua lai)

/* ================= DOC GOOGLE SHEET ================= */

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
    console.log("Da tai Google Sheet, so dong:", knowledgeRows.length);
  } catch (e) {
    console.error("Loi tai Google Sheet:", e.message);
  }
}

loadKnowledgeBase();
setInterval(loadKnowledgeBase, 5 * 60 * 1000);

// Bo dau tieng Viet + viet thuong de so khop
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Tim cac dong lien quan nhat toi cau hoi
function findRelevantRows(question, maxRows = 5) {
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
    dataText = "(Khong tim thay dong phu hop trong du lieu.)";
  }

  return `Ban la tro ly AI cua VITALIGHT CAMERA (chuyen camera IMOU, DAHUA, EZVIZ, TAPO). Hotline: 0937254555. Website: https://vitalight.vn

Quy tac:
- Tra loi tieng Viet, ngan gon, than thien. Xung "em/shop", goi khach "anh/chi".
- Hoi gia: de nghi lien he hotline 0937254555.
- Khong co thong tin phu hop: de nghi lien he hotline.
- Nho hang khach dang hoi tu cac tin nhan truoc va bam sat hang do (cai dat, tinh nang, loi). KHONG hoi lai hang, KHONG chuyen sang hang khac cho toi khi khach chu dong hoi hang khac.
- Chi hoi lai hang khi khach hoi van de chung ma chua nhac hang nao.
- Co link video phu hop thi gui cho khach.

DU LIEU THAM KHAO (cac cot cach nhau bang dau |):
${dataText}`;
}
async function saveToSheet(noiDung) {
  try {
    const res = await axios.post(
      LEARN_WEBAPP_URL,
      {
        secret: LEARN_SECRET,
        cau_hoi: "(admin day truc tiep)",
        tra_loi: noiDung || "",
      },
      { timeout: 10000 }
    );
    console.log("LUU SHEET:", res.data);
    return true;
  } catch (e) {
    console.error("Loi luu vao Sheet:", e.message);
    return false;
  }
}

/* ================= QUAN LY TOKEN ZALO ================= */

function getRefreshToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (data.refresh_token) return data.refresh_token;
    }
  } catch (e) {
    console.error("Loi doc file token:", e.message);
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
    console.log("Da luu token moi vao file.");
  } catch (e) {
    console.error("Loi luu file token:", e.message);
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
      "Khong lay duoc access token: " + JSON.stringify(response.data)
    );
  }

  saveTokens(newAccessToken, newRefreshToken);
  return newAccessToken;
}

/* ===== GUI TIN NHAN VE ZALO ===== */
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

/* ===== XU LY SU KIEN TU ZALO ===== */
async function handleEvent(data) {
  try {
    console.log("====== WEBHOOK RECEIVED ======");
    console.log(JSON.stringify(data, null, 2));

    if (data.event_name !== "user_send_text") {
      console.log("Bo qua su kien:", data.event_name);
      return;
    }

    if (!data.sender || !data.message || !data.message.text) {
      return;
    }

    const userId = data.sender.id;
    const userMessage = data.message.text;

    // PHAN BIET ADMIN VOI KHACH
    if (ADMIN_IDS.includes(userId)) {
      // Day la ADMIN -> coi la kien thuc day bot
      await handleAdminTeaching(userId, userMessage);
    } else {
      // Day la KHACH -> tu van nhu binh thuong
      await handleUserMessage(userId, userMessage);
    }
  } catch (error) {
    console.error("WEBHOOK ERROR FULL:");
    console.error(JSON.stringify(error.response?.data, null, 2));
    console.error(error.message);
  }
}

/* ===== KHI ADMIN DAY BOT ===== */
async function handleAdminTeaching(adminId, message) {
  console.log("ADMIN DAY:", message);

  const noiDung = (message || "").trim();
  if (!noiDung) return;

  const ok = await saveToSheet(noiDung);

  if (ok) {
    // Nap lai du lieu Sheet ngay de dung duoc lien
    await loadKnowledgeBase();
    await sendZaloMessage(
      adminId,
      "Da hoc xong noi dung nay va luu vao du lieu. Bot se dung de tu van cho khach."
    );
  } else {
    await sendZaloMessage(
      adminId,
      "Luu du lieu that bai. Vui long kiem tra lai cau hinh Google Sheet (link Web app)."
    );
  }
}

/* ===== KHI KHACH NHAN ===== */
async function handleUserMessage(userId, userMessage) {
  console.log("USER:", userMessage);

  // Lay lich su hoi thoai cua khach nay
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = [];
  }
  const history = conversationHistory[userId];

  // Them tin nhan moi cua khach
  history.push({ role: "user", content: userMessage });

  // Goi Claude kem lich su de bot nho ngu canh
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
    if (err.status === 429) {
      console.error("Van bi rate limit sau khi retry:", err.message);
      aiReply =
        "Da he thong dang hoi ban a, anh/chi vui long nhan lai sau it phut giup em, hoac goi hotline 0937254555 de duoc ho tro ngay nhe!";
      await sendZaloMessage(userId, aiReply);
      return;
    }
    throw err;
  }
  console.log("AI:", aiReply);

  // Luu cau tra loi cua bot vao lich su
  history.push({ role: "assistant", content: aiReply });

  // Chi giu MAX_HISTORY tin gan nhat de tiet kiem token
  if (history.length > MAX_HISTORY) {
    conversationHistory[userId] = history.slice(-MAX_HISTORY);
  }

  // Gui tin ve Zalo cho khach
  await sendZaloMessage(userId, aiReply);
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "VITALIGHT CAMERA BOT" });
});
// Webhook xử lý khi user rút lại đồng ý / xóa dữ liệu (yêu cầu của Zalo Mini App)
app.post("/zalo-userdata-webhook", (req, res) => {
  console.log("ZALO USER DATA WEBHOOK:", JSON.stringify(req.body));
  // Zalo chỉ cần phản hồi 200 để xác nhận đã nhận
  res.status(200).json({ result: "received" });
});
// ===== ENDPOINT 1: Tao MAC cho don hang tren Mini App =====
// Mini App gui len orderData -> server tra ve mac
app.post("/create-mac", (req, res) => {
  try {
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: "Thieu du lieu" });
    }

    // Sap xep key theo alphabet, JSON.stringify neu la object
    const dataMac = Object.keys(body)
      .sort()
      .map((key) => {
        const value = body[key];
        const strVal =
          typeof value === "object" ? JSON.stringify(value) : value;
        return `${key}=${strVal}`;
      })
      .join("&");

    const mac = crypto
      .createHmac("sha256", MINIAPP_PRIVATE_KEY)
      .update(dataMac)
      .digest("hex");

    console.log("CREATE MAC - dataMac:", dataMac);
    console.log("CREATE MAC - mac:", mac);

    return res.json({ mac });
  } catch (err) {
    console.error("CREATE MAC ERROR:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ===== ENDPOINT 2: Nhan thong bao tu Zalo khi don hang duoc tao =====
app.post("/zalo-checkout-notify", (req, res) => {
  try {
    const clientIp = (
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      ""
    )
      .toString()
      .split(",")[0]
      .trim()
      .replace("::ffff:", "");

    console.log("ZALO NOTIFY IP:", clientIp);
    console.log("ZALO NOTIFY BODY:", JSON.stringify(req.body));

    if (!ZALO_ALLOWED_IPS.includes(clientIp)) {
      console.warn("NOTIFY REJECTED - IP khong hop le:", clientIp);
      return res.status(403).json({
        returnCode: 0,
        returnMessage: "IP not allowed",
      });
    }

    const { data, mac } = req.body || {};

    if (!data || !mac) {
      return res.status(400).json({
        returnCode: 0,
        returnMessage: "Missing data or mac",
      });
    }

    const { method, orderId, appId } = data || {};

    if (!method || !orderId || !appId) {
      return res.status(400).json({
        returnCode: 0,
        returnMessage: "Missing method or orderId or appId",
      });
    }

    // Xac thuc MAC (theo dung chuan bai dev.to)
    const str = `appId=${appId}&orderId=${orderId}&method=${method}`;
    const expectedMac = crypto
      .createHmac("sha256", MINIAPP_PRIVATE_KEY)
      .update(str)
      .digest("hex");

    if (expectedMac !== mac) {
      console.warn("NOTIFY REJECTED - MAC khong khop");
      console.warn("Expected:", expectedMac);
      console.warn("Got:     ", mac);
      return res.status(200).json({
        returnCode: 0,
        returnMessage: "Fail",
      });
    }

    console.log("ZALO NOTIFY OK - don hang hop le:", data);
    // TODO: cap nhat trang thai don hang vao Google Sheet (lam sau)

    return res.status(200).json({
      returnCode: 1,
      returnMessage: "Success",
    });
  } catch (err) {
    console.error("NOTIFY ERROR:", err.message);
    return res.status(500).json({
      returnCode: 0,
      returnMessage: err.message,
    });
  }
});
// ===== ENDPOINT 3: Ghi don hang vao Google Sheet (thay Mini App goi truc tiep) =====
app.post("/save-order", async (req, res) => {
  try {
    const orderData = req.body;
    
    console.log("SAVE ORDER RECEIVED:", JSON.stringify(orderData));

    if (!orderData || !orderData.name || !orderData.phone) {
      return res.status(400).json({ error: "Thieu du lieu don hang" });
    }

    // URL Apps Script ghi don hang (thay bang URL cua ban)
    const ORDER_SHEET_URL = process.env.ORDER_SHEET_URL || "https://script.google.com/macros/s/AKfycbwuxfWJQMaGgtRZmnR1HBuV8QnVozkcsnYbN_i3xmkyyy6V2FMlf_HVkv-v-M9TJo9Rrg/exec";

    // Server goi Apps Script (khong bi whitelist chan nhu Mini App)
    const response = await axios.post(ORDER_SHEET_URL, orderData, {
      timeout: 15000,
    });

    console.log("SAVE ORDER OK:", response.data);
    return res.json({ success: true });
  } catch (err) {
    console.error("SAVE ORDER ERROR:", err.message);
    return res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});