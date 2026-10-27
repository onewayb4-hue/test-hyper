/**
 * ==============================================================================
 * خدمة إرسال البريد الإلكتروني عبر خوادم جوجل (Gmail SMTP TLS)
 * بدون أي مكاتب خارجية (Pure Node.js TLS Standard Library)
 * منصة هايبر زايد ماركت - نجع حمادي وفرشوط
 * ==============================================================================
 */

const tls = require('tls');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE_PATH = path.join(__dirname, 'إعدادات_البريد', 'بيانات_الجيميل.txt');

/**
 * قراءة إعدادات الجيميل من ملف التكست المخصص
 */
function getEmailConfig() {
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    return { isConfigured: false, reason: 'الملف غير موجود' };
  }

  try {
    const rawContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const lines = rawContent.split(/\r?\n/);
    const config = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim().toUpperCase();
        const val = line.slice(eqIdx + 1).trim();
        config[key] = val;
      }
    }

    const email = (config.EMAIL || '').trim().toLowerCase();
    // إزالة المسافات التي تضعها جوجل بين الحروف (abcd efgh ijkl mnop -> abcdefghijklmnop)
    const appPassword = (config.APP_PASSWORD || '').replace(/\s+/g, '');
    const senderName = config.SENDER_NAME || 'هايبر زايد ماركت';

    const isPlaceholderEmail = email.includes('your_hyper_email') || !email.includes('@');
    const isPlaceholderPass = appPassword.toLowerCase().includes('xxxx') || appPassword.length < 16;

    const isConfigured = !isPlaceholderEmail && !isPlaceholderPass;

    return {
      isConfigured,
      email,
      appPassword,
      senderName,
      filePath: CONFIG_FILE_PATH
    };
  } catch (err) {
    return { isConfigured: false, error: err.message };
  }
}

/**
 * إنشاء قالب الإيميل بصيغة HTML شيك ومتوافقة مع الهواتف وتطبيق Gmail
 */
function buildVerificationEmailHtml({ name, otpCode }) {
  const safeName = name ? name.split(' ')[0] : 'عميلنا العزيز';
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كود تأكيد حسابك في هايبر زايد</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- الحاوية الرئيسية -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          
          <!-- الهيدر الأخضر -->
          <tr>
            <td style="background: linear-gradient(135deg, #15803d, #16a34a); padding: 35px 25px; text-align: center; color: #ffffff;">
              <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">هايبر زايد ماركت</h1>
              <p style="margin: 6px 0 0 0; font-size: 15px; color: #dcfce7; font-weight: 600;">«خيره زايد» • نجع حمادي وفرشوط</p>
            </td>
          </tr>

          <!-- محتوى الرسالة -->
          <tr>
            <td style="padding: 35px 30px; color: #1f2937;">
              <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #111827; font-weight: 700;">
                أهلاً بك يا ${safeName}، 👋
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: #4b5563;">
                شكراً لانضمامك إلى منصة <strong>هايبر زايد ماركت</strong>. لتأكيد حسابك وتفعيله للبدء في التسوق والطلب، استخدم كود التحقق السري التالي:
              </p>

              <!-- بطاقة الكود -->
              <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 22px; text-align: center; margin: 25px 0;">
                <span style="display: block; font-size: 13px; color: #15803d; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">
                  كود تفعيل الحساب
                </span>
                <span style="font-family: monospace, 'Courier New', Courier; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #166534; display: inline-block;">
                  ${otpCode}
                </span>
              </div>

              <!-- تنبيه الصلاحية -->
              <div style="background-color: #fef3c7; border-right: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 25px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  ⏱️ <strong>تنبيه هام:</strong> هذا الكود صالح لمدة <strong>10 دقائق</strong> فقط، وهو مخصص لك شخصياً، لا تشاركه مع أي شخص للحفاظ على سرية حسابك.
                </p>
              </div>

              <!-- مميزات الحساب -->
              <div style="border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 10px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #374151;">من مميزات حسابك في هايبر زايد:</p>
                <ul style="margin: 0; padding-right: 20px; font-size: 13px; color: #6b7280; line-height: 1.8;">
                  <li>🛵 توصيل سريع للمنازل في فرشوط وجميع مناطق نجع حمادي.</li>
                  <li>🔥 متابعة العروض والتخفيضات اليومية والأسبوعية أولاً بأول.</li>
                  <li>❤️ حفظ منتجاتك المفضلة وعناوينك المتعددة للشراء بضغطة زر.</li>
                  <li>🕒 خدمة 24 ساعة يومياً على مدار الأسبوع.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- الفوتر -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #6b7280;">
                الفرع الرئيسي: نجع حمادي - شارع المركز بجوار مركز الشرطة
              </p>
              <p style="margin: 0;">
                هذه الرسالة تم إرسالها آلياً لتأكيد فتح حسابك. إذا لم تكن أنت من قام بهذا الطلب، يمكنك تجاهل هذه الرسالة بأمان.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * إرسال بريد إلكتروني فعلي عبر بروتوكول TLS المباشر لخوادم جوجل (smtp.gmail.com:465)
 */
function sendMailViaGmail({ to, subject, htmlBody }) {
  return new Promise((resolve, reject) => {
    const cfg = getEmailConfig();
    if (!cfg.isConfigured) {
      return reject(new Error('إعدادات الجيميل غير مكتملة في ملف (بيانات_الجيميل.txt)'));
    }

    const socket = tls.connect({
      host: 'smtp.gmail.com',
      port: 465,
      rejectUnauthorized: true,
      timeout: 12000
    }, () => {
      // تم فتح الاتصال المشفر بنجاح مع سيرفرات جوجل
    });

    let step = 0;
    let buffer = '';

    socket.setEncoding('utf8');

    const sendLine = (line) => {
      socket.write(line + '\r\n');
    };

    socket.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // الاحتفاظ بالسطر الأخير غير المكتمل

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const isMultiLine = line.charAt(3) === '-';
        if (isMultiLine) continue; // السيرفر يرسل سطوراً متعددة، ننتظر السطر النهائي

        handleSmtpStep(code, line);
      }
    });

    function handleSmtpStep(code, line) {
      try {
        if (step === 0 && code === 220) {
          step = 1;
          sendLine('EHLO localhost');
        } else if (step === 1 && code === 250) {
          step = 2;
          sendLine('AUTH LOGIN');
        } else if (step === 2 && code === 334) {
          step = 3;
          // إرسال الإيميل مشفراً Base64
          sendLine(Buffer.from(cfg.email).toString('base64'));
        } else if (step === 3 && code === 334) {
          step = 4;
          // إرسال كلمة سر التطبيقات مشفرة Base64
          sendLine(Buffer.from(cfg.appPassword).toString('base64'));
        } else if (step === 4 && code === 235) {
          // تم التحقق من كلمة السر بنجاح من قبل جوجل
          step = 5;
          sendLine(`MAIL FROM:<${cfg.email}>`);
        } else if (step === 5 && code === 250) {
          step = 6;
          sendLine(`RCPT TO:<${to}>`);
        } else if (step === 6 && code === 250) {
          step = 7;
          sendLine('DATA');
        } else if (step === 7 && code === 354) {
          step = 8;
          // تجهيز رسالة الـ MIME بصيغة UTF-8 المتوافقة مع اللغة العربية تماماً
          const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
          const encodedSender = `=?UTF-8?B?${Buffer.from(cfg.senderName, 'utf8').toString('base64')}?=`;
          const base64Body = Buffer.from(htmlBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

          const mimeHeaders = [
            `From: ${encodedSender} <${cfg.email}>`,
            `To: <${to}>`,
            `Subject: ${encodedSubject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            `Content-Transfer-Encoding: base64`,
            ``,
            base64Body,
            `.`
          ].join('\r\n');

          sendLine(mimeHeaders);
        } else if (step === 8 && code === 250) {
          step = 9;
          sendLine('QUIT');
          socket.end();
          resolve({ success: true, message: 'تم إرسال الإيميل بنجاح عبر خوادم جوجل' });
        } else if (code >= 400) {
          socket.destroy();
          let customErr = `خطأ في خادم جوجل (${code}): ${line}`;
          if (code === 535) {
            customErr = 'فشل تسجيل الدخول في جوجل: كلمة مرور التطبيقات (App Password) غير صحيحة، يرجى مراجعة ملف (بيانات_الجيميل.txt)';
          }
          reject(new Error(customErr));
        }
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    }

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('انتهت مهلة الاتصال بخوادم جوجل (تأكد من وجود اتصال إنترنت)'));
    });

    socket.on('error', (err) => {
      reject(new Error(`تعذر الاتصال بخوادم بريد جوجل: ${err.message}`));
    });
  });
}

/**
 * الدالة الرئيسية المخصصة لإرسال كود التحقق
 */
async function sendOtpEmail(toEmail, otpCode, customerName) {
  const cfg = getEmailConfig();
  const subject = `كود تأكيد حسابك في هايبر زايد ماركت: ${otpCode}`;
  const htmlBody = buildVerificationEmailHtml({ name: customerName, otpCode });

  if (!cfg.isConfigured) {
    return {
      sent: false,
      isConfigured: false,
      reason: 'بيانات الجيميل لم تُسجل بعد في ملف إعدادات البريد'
    };
  }

  try {
    await sendMailViaGmail({
      to: toEmail,
      subject,
      htmlBody
    });
    return {
      sent: true,
      isConfigured: true,
      to: toEmail
    };
  } catch (err) {
    return {
      sent: false,
      isConfigured: true,
      error: err.message
    };
  }
}

module.exports = {
  getEmailConfig,
  sendOtpEmail
};
