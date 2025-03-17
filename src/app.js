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
require("dotenv").config();

// สร้าง instance ของ Express application
const app = express();

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(cors());

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

app.get("/api/docs/swagger/:text", authAdminDoc, async (req, res) => {
  res.sendFile(__dirname + "/swagger.json");
});

// กำหนดตัวแปรสำหรับจัดการเส้นทางของ routes
const routesRootPath = path.join(__dirname, "routes");
const BASE_PATH = process.env.BASE_PATH || "akatApi";

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
        token: true,
        expires_at: true
      }
    });
    if (fetchAllTokenBlacklist.length === 0) {
        console.log('TokenBlacklistErrors : No tokens found in database');
    }

    for(const tokenBlacklist of fetchAllTokenBlacklist) {
      const expiresAtIso = tokenBlacklist.expires_at;
      const expiresAt = moment(expiresAtIso).format('YYYY-MM-DD HH:mm:ss');

      const date = new Date();
      const dateNow = moment(date).format('YYYY-MM-DD HH:mm:ss');
      
      if(dateNow === expiresAt || dateNow > expiresAt) {
        const deleteTokenBlacklist = await pm.token_blacklist.delete({
          where: {
            token: tokenBlacklist.token
          }
        });

        if (deleteTokenBlacklist.count > 0) {
          // ดึงค่า MAX(token_blacklist_id)
          const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(token_blacklist_id), 0) + 1 AS nextId FROM token_blacklist`;

          // รีเซ็ตค่า AUTO_INCREMENT
          await pm.$executeRawUnsafe(`ALTER TABLE token_blacklist AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
          console.log('Remove Token AuthTokens ที่หมดเวลาเสร็จสิ้น!!');
        }
      }
    }
  } catch (error) {
      console.error("Error checkBlackListTokensExpired: ", error.message);
      process.exit(1);
  }
}

// Function ในการตรวจสอบ is_active, expires_at บน Table auth_tokens
async function checkAuthTokensExpired() {
  try {
      const fetchAllAuthTokens = await pm.auth_tokens.findMany({
        select: {
          token: true,
          expires_at: true
        }
      });
      if (fetchAllAuthTokens.length === 0) {
          console.log('AuthTokenErrors : No tokens found in database');
      }

      for(const authTokens of fetchAllAuthTokens) {
        const expiresAtIso = authTokens.expires_at;
        const expiresAt = moment(expiresAtIso).format('YYYY-MM-DD HH:mm:ss');

        const date = new Date();
        const dateNow = moment(date).format('YYYY-MM-DD HH:mm:ss');
        
        if(dateNow === expiresAt || dateNow > expiresAt) {
          const deleteAuthToken = await pm.auth_tokens.delete({
            where: {
              token: authTokens.token
            }
          });

          if (deleteAuthToken.count > 0) {
            // ดึงค่า MAX(auth_token_id)
            const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(auth_token_id), 0) + 1 AS nextId FROM auth_tokens`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE auth_tokens AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
            console.log('Remove Token AuthTokens ที่หมดเวลาเสร็จสิ้น!!');
          }
        }
      }     
  } catch (error) {
      console.error("Error checkAuthTokensExpired: ", error.message);
      process.exit(1);
  }
}

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
}

startBlacklistScheduler();

app.use("*", (req, res) => {
  if (req.accepts("html")) {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  } else {
    msg(res, 404, "404 Not found!!!!");
  }
});

module.exports = app;
