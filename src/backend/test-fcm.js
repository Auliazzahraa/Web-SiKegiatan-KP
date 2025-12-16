import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function testFCM() {
  const testToken = "f_fBmu4LrMlABYfuE26OSC:APA91bHGP4QJm3ZqSz8suSsfHuznePv3BPsviM29FWzU0iRLPtfgUop-rjmcFT4KH9TJIpLCaKX59MJsW3yfm29HrkeJMrnCqRy7uoqiTwBJ7JmnBMGJYJM";

  const message = {
    token: testToken,
    notification: {
      title: "Test FCM",
      body: "Ini test notif"
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ FCM berhasil:", response);
  } catch (err) {
    console.error("❌ FCM gagal:", err);
  }
}

testFCM();