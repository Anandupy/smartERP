/* eslint-disable no-console, @typescript-eslint/no-floating-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testFast2Sms() {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const targetNumber = process.argv[2] || '9082807803';
  const cleanNumber = targetNumber.replace(/\D/g, '').slice(-10);

  console.log(`\n========================================`);
  console.log(`  Fast2SMS Live Testing Utility`);
  console.log(`========================================`);
  console.log(`Target Phone: +91 ${cleanNumber}`);

  if (!apiKey || !apiKey.trim() || apiKey === 'YOUR_FAST2SMS_API_KEY') {
    console.log(`\n❌ ERROR: FAST2SMS_API_KEY is not set in backend/.env!`);
    console.log(
      `Please sign up at https://www.fast2sms.com (free 1-min signup)`,
    );
    console.log(
      `Copy your Dev API key from: https://www.fast2sms.com/dashboard/dev-api`,
    );
    console.log(
      `Paste it into backend/.env as FAST2SMS_API_KEY=your_key_here\n`,
    );
    process.exit(1);
  }

  console.log(
    `API Key Detected: ${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`,
  );
  console.log(`Sending live SMS via Fast2SMS Quick Route...`);

  const message = `SSVHS Admission Update: Dear Parent, admission test notification for Shree Siddhi Vinayagar English High School. Status: CONFIRMED.`;

  try {
    const startTime = Date.now();
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanNumber,
      }),
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json().catch(() => null);

    console.log(`Response HTTP Status: ${response.status} (${elapsed}ms)`);
    console.log(`Response Payload:`, JSON.stringify(data, null, 2));

    if (response.ok && data?.return === true) {
      console.log(
        `\n🎉 SUCCESS! Physical SMS has been dispatched to ${cleanNumber}!`,
      );
      console.log(`Request ID: ${data.request_id}`);
      console.log(`Aapke mobile par SMS kuch hi seconds me ring karega!`);
    } else {
      console.log(
        `\n⚠️ Fast2SMS Error:`,
        data?.message || 'Check balance or API key',
      );
    }
  } catch (error: any) {
    console.error(`\n❌ Network Error:`, error.message);
  }
}

testFast2Sms();
