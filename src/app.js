// การนำเข้าโมดูลที่จำเป็นสำหรับการทำงานของแอปพลิเคชัน
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const schedule = require("node-schedule");
const { readdirSync } = require("fs");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const { authAdminDoc } = require("./middleware/auth/authAdmin");
const { msg } = require("../src/utils/message");
const pm = require('../src/config/prisma');
const bodyParser = require('body-parser');
const listEndpoints = require('express-list-endpoints');
require("dotenv").config();

// สร้าง instance ของ Express application
const app = express();

// Middleware
app.use(morgan("dev"));
const allow = ['https://akathos.moph.go.th', 'http://localhost:5173']
app.use(
  cors({
    origin: (o, cb) => cb(null, allow.includes(o) || !o),
    credentials: true
  })
)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// โหลด apiReference แบบ dynamic import
app.get(
  "/api/apiDoc/nurse/doctor/carpentor/dentist/fireman/finance/pharmacist/IT/:text",
  authAdminDoc,
  async (req, res, next) => {
    const { apiReference } = await import("@scalar/express-api-reference");
    apiReference({
      theme: "deepSpace",
      spec: {
        url: "/api/docs/swagger/" + process.env.PARAMS_DOC, // U2FsdGVkX18yXsyuwevtvG6gmcXVZGTJ6PiExmJnkBMtHwxubGWbNQ0BIS0oVhfe
      },
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })(req, res, next);
  }
);

app.get("/api/docs/swagger/:text", authAdminDoc, async (req, res) => { res.sendFile(__dirname + "/swagger.json"); });

// กำหนดตัวแปรสำหรับจัดการเส้นทางของ routes
const routesRootPath = path.join(__dirname, "routes");
const BASE_PATH = process.env.BASE_PATH || "api";

if (fs.existsSync(routesRootPath)) {
  readdirSync(routesRootPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .forEach((dirent) => {
      const folderPath = path.join(routesRootPath, dirent.name);
      readdirSync(folderPath)
        .filter((file) => file.endsWith(".js"))
        .forEach((routeFile) => {
          console.log(`Loading route: ${folderPath}/${routeFile}`);
          app.use(
            `/${BASE_PATH}/${dirent.name}`,
            require(`${folderPath}/${routeFile}`)
          );
        });
    });
} else {
  console.error(`Routes folder not found at path: ${routesRootPath}`);
}

// Function ในการตรวจสอบ expires_at บน Table token_blacklist
async function checkBlackListTokensExpired() {
  try {
    const fetchAllTokenBlacklist = await pm.token_blacklist.findMany({
      select: {
        token_blacklist_id: true,  // เพิ่ม ID เพื่อใช้ในการคำนวณค่า MAX
        token: true,
        expires_at: true
      }
    });

    if (fetchAllTokenBlacklist.length === 0) {
      console.log('TokenBlacklistErrors: No tokens found in database');
      return;
    }

    for (const tokenBlacklist of fetchAllTokenBlacklist) {
      const expiresAt = moment(tokenBlacklist.expires_at).format('YYYY-MM-DD HH:mm:ss');
      const dateNow = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

      if (dateNow >= expiresAt) {
        // ลบ Token ที่หมดอายุ
        await pm.token_blacklist.delete({
          where: { token: tokenBlacklist.token }
        });

        console.log(`Removed expired token: ${tokenBlacklist.token}`);
      }
    }

    // หาค่า MAX(token_blacklist_id) ที่เหลืออยู่
    const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(token_blacklist_id), 0) + 1 AS nextId FROM token_blacklist`;

    const nextId = maxIdResult[0].nextId || 1; // ตั้งเป็น 1 ถ้าตารางว่าง

    // รีเซ็ต AUTO_INCREMENT
    await pm.$executeRawUnsafe(`ALTER TABLE token_blacklist AUTO_INCREMENT = ${nextId}`);
    console.log(`AUTO_INCREMENT has been reset to ${nextId}`);

  } catch (error) {
    console.error("Error checkBlackListTokensExpired: ", error.message);
    process.exit(1);
  }
};

// Function ในการตรวจสอบ is_active, expires_at บน Table auth_tokens
async function checkAuthTokensExpired() {
  try {
    const fetchAllAuthTokens = await pm.auth_tokens.findMany({
      select: {
        auth_token_id: true,  // เพิ่ม auth_token_id เพื่อใช้ในการหา MAX ID
        token: true,
        expires_at: true
      }
    });

    if (fetchAllAuthTokens.length === 0) {
      console.log('AuthTokenErrors: No tokens found in database');
      return;
    }

    for (const authTokens of fetchAllAuthTokens) {
      const expiresAt = moment(authTokens.expires_at).format('YYYY-MM-DD HH:mm:ss');
      const dateNow = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

      if (dateNow >= expiresAt) {
        // ลบ Token ที่หมดอายุ
        await pm.auth_tokens.delete({
          where: { token: authTokens.token }
        });

        console.log(`Removed expired token: ${authTokens.token}`);
      }
    }

    // หาค่า MAX(auth_token_id) ที่เหลืออยู่
    const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(auth_token_id), 0) + 1 AS nextId FROM auth_tokens`;

    const nextId = maxIdResult[0].nextId || 1; // ตั้งเป็น 1 ถ้าตารางว่าง

    // รีเซ็ต AUTO_INCREMENT
    await pm.$executeRawUnsafe(`ALTER TABLE auth_tokens AUTO_INCREMENT = ${nextId}`);
    console.log(`AUTO_INCREMENT has been reset to ${nextId}`);

  } catch (error) {
    console.error("Error checkAuthTokensExpired: ", error.message);
    process.exit(1);
  }
};

// เริ่มการตรวจสอบ
function startBlacklistScheduler() {
  // เรียกครั้งแรก
  checkAuthTokensExpired();
  checkBlackListTokensExpired();

  schedule.scheduleJob('0 * * * *', async () => {
    console.log('Scheduled blacklist update starting...');
    await checkAuthTokensExpired();
    await checkBlackListTokensExpired();
  });
};

startBlacklistScheduler();

// const endpoints = listEndpoints(app);
// for (const i of endpoints) {
//   console.log(i.path + ' || ' + i.methods);
// }

app.use('*', (req, res) => { msg(res, 404, "404 Not found!!!!"); });

module.exports = app;