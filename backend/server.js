import express from "express";

const app = express();

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.get("/", (req, res) => {
  res.status(200).send("Zalo AI Bot is running");
});

app.get("/webhook/zalo", (req, res) => {
  res.status(200).send("Webhook OK");
});

app.post("/webhook/zalo", (req, res) => {
  console.log("HEADERS:", req.headers);
  console.log("BODY:", req.body);

  return res.status(200).json({
    success: true
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});