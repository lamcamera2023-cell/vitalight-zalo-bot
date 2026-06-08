import axios from "axios";

// ====== ĐIỀN 3 THÔNG TIN VÀO ĐÂY ======
const APP_ID = "2819509856756290285";
const APP_SECRET = "LKKD7p88fqW6B41SUJ57";
const CODE = "S_K1zIEiIqmamtdFEEii5og7Gf12pcPlO8S-f4F3AseYhNFZ4SH1PpwVARyymtywKOXMmdhwTZrKgLVBFCu8KIwIFz0pgLC00UaKjbUbC4ztu6YDRBv7Bmh19OCohnKDBu0GvYpGJpLBdMYQQDXkM7gE6Bu2p3zhUVjMiptF04m_Ya-k2vex26wMUxGHqbD2Rxq2s4xp65fVqrlpMu8LPaUCTSCmf71JKAaTkZN5G2u7hMMoQVvIUHRN6Umdm6905VXdqLNpLpT6n4_YAlzbPplTA9PBc1ecHOTiZYMHh4uEz9NwNfk_d5hsZHn6rDdjnV6lMAolgf2-rEfXrRopIeQ0_zRj_lHYo8IzFlBXsekllfi2wkA-r9EZyqoQsipSqgo6GQVcfSUsnkOWpkoei2P4XY8yN9yOCm";
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