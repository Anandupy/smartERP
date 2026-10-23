/* eslint-disable no-console, @typescript-eslint/no-floating-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testTextBee() {
  const apiKey =
    process.env.TEXTBEE_API_KEY || 'txb_PhJ2bMAtTRRgnqvgDUhHdrTtpqcnfMmh';
  const targetNumber = process.argv[2] || '+919082807803';
  const formattedNumber = targetNumber.startsWith('+')
    ? targetNumber
    : `+91${targetNumber.replace(/\D/g, '').slice(-10)}`;

  console.log(`\n========================================`);
  console.log(`  TextBee Live SMS Testing Utility`);
  console.log(`========================================`);
  console.log(`Target Phone: ${formattedNumber}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`);

  // First, check devices
  try {
    const devRes = await fetch(
      'https://api.textbee.dev/api/v1/gateway/devices',
      {
        headers: { 'x-api-key': apiKey },
      },
    );
    const devData = await devRes.json();
    console.log(`\nLinked Devices:`, JSON.stringify(devData, null, 2));

    const message = `SSVHS Admission Update: Dear Parent, admission test notification for Shree Siddhi Vinayagar English High School. Status: CONFIRMED.`;

    console.log(`\nDispatching live SMS via TextBee Cloud API...`);
    const startTime = Date.now();
    const smsRes = await fetch(
      'https://api.textbee.dev/api/v1/gateway/send-sms',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [formattedNumber],
          message: message,
        }),
      },
    );

    const elapsed = Date.now() - startTime;
    const smsData = await smsRes.json();
    console.log(`HTTP Status: ${smsRes.status} (${elapsed}ms)`);
    console.log(`Response:`, JSON.stringify(smsData, null, 2));

    if (smsRes.ok) {
      console.log(
        `\n🎉 SUCCESS! Physical SMS queued on Android phone for delivery!`,
      );
    }
  } catch (err: any) {
    console.error(`\n❌ Error:`, err.message);
  }
}

testTextBee();
