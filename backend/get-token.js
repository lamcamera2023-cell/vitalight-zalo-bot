import axios from "axios";

// ====== ĐIỀN 3 THÔNG TIN VÀO ĐÂY ======
const APP_ID = "2819509856756290285";
const APP_SECRET = "LKKD7p88fqW6B41SUJ57";
const CODE = "5AgLuKXNGoP3dEtRKn0aVKtOreGfDMu51zYgi2Wu8mz5ykVuUZ162nENk9mRTafJVvt-qMm66bPy_g_M63rl92BnmTOhGJzvCA37kLDEUpnthRU0QbjM3XQejlChPnK1DhxGdpr7JMvVggVeUnThNMwupiql3bTpIvYYs4qISqTJ-z_bR4Ky9G6-Zlq6JpjhQe_jZtTgGd5bzSNeRnqUOawt_h072M1tIRtA-YPn4WqTgwECV416RWwjdSas77HURwBhkITBJa8JmjVhUnT_5Mk6eFXr4bvWHQwpfJBLVIaKDOgHU8w-NKP34wvMozuqK4eq_pMmhKahRt76JAEqaXC3Td1qsU6wNHyH8rtUwkWC9JSVHTsEjp0uNr4rvVo_SJSgN0ZPbQGLNKezOTEOqoP88hv2DsGGMG";
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