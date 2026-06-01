// server.js

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.post("/webhook", async (req, res) => {

    const event = req.body;

    const userId = event.sender.id;

    const text = event.message.text;

    await axios.post(
        "https://openapi.zalo.me/v3.0/oa/message/cs",
        {
            recipient: {
                user_id: userId
            },
            message: {
                text: "Bạn vừa gửi: " + text
            }
        },
        {
            headers: {
                access_token: process.env.ZALO_TOKEN
            }
        }
    );

    res.sendStatus(200);
});

app.listen(8080);