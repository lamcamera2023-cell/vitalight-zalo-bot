import axios from "axios";

// ====== ĐIỀN 3 THÔNG TIN VÀO ĐÂY ======
const APP_ID = "2819509856756290285";
const APP_SECRET = "LKKD7p88fqW6B41SUJ57";
const CODE = "CFxqhZlAbp1do8oK88tmQscCjyjQgBeJ8upB_rkbznbXfeQt2QsO43V3szzl-g1zKTsefnMF-NbIllcWORg93G-maAPHoTjG7U6MoId6dnLQxERm4DEo9plfvuDHx_4e6_-1xqVFgKTow_QO0P-FT4FvdxrLXhDQPjdpg3UQbsv-kewL5itO32p_turynzz2Hywy_mtYfbX8j9IO5PNwIsFshy1zWOHUPFoRYbpvzYGmwlBy1iYYHoFipBbCb91tGkEwoLt3gci-WuQR0P-RF4R7yOWFchf9QE_YrKXTcG0vTDlX0WPQT6i2GjuiGpeTVGjbZqyuIM06BY2sDYjGkpuvE00EAXgJSCBdqyhAgK7C-C7lqidD7l3bgQ6YyRyMiUhSh9_DrWtLWBpDziVRUYOVwmiRHFd4Jm";
// =======================================

async function getToken() {
  try {
    const params = new URLSearchParams();
    params.append("app_id", APP_ID);
    params.append("code", CODE);
    params.append("grant_type", "authorization_code");

    const response = await axios.post(
      "https://oauth.zaloapp.com/v4/oa/access_token",
      params,
      {
        headers: {
          secret_key: APP_SECRET,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("===== KẾT QUẢ =====");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log("===== LỖI =====");
    console.log(JSON.stringify(error.response?.data, null, 2));
    console.log(error.message);
  }
}

getToken();