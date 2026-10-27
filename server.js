// ============================================================================
// نظام منصة هايبر ماركت زايد (سيرفر متكامل يخدم موقع العملاء وبوابة الهايبر)
// يستخدم وحدات Node.js القياسية المدمجة لضمان العمل السريع والآمن
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const emailService = require('./emailService');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// قراءة قاعدة البيانات
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [], categories: [], products: [], orders: [], settings: {} };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return { users: [], categories: [], products: [], orders: [], settings: {} };
  }
}

// حفظ قاعدة البيانات
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// قراءة جسم الطلب (JSON Body Parser)
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// إرسال استجابة JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// تحديد أنواع MIME للملفات الثابتة
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// تخزين مؤقت لأكواد التحقق OTP للعملاء (مدة الصلاحية 10 دقائق)
const pendingOTPs = {};

// إنشاء السيرفر الرئيسي
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // دعم CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // ==========================================
  // مسارات الـ API
  // ==========================================

  // 1. الإعدادات والمدن والبيانات العامة
  if (pathname === '/api/settings' && method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, {
      settings: db.settings,
      categories: db.categories
    });
  }

  // ==========================================
  // مسارات حسابات العملاء (تسجيل، كود الإيميل، دخول، تحديث، طلبات)
  // ==========================================

  // إرسال كود التحقق OTP إلى الجيميل
  if (pathname === '/api/customer/send-otp' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);

    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim();
    const name = (body.name || '').trim();
    const password = (body.password || '').trim();

    if (!email || !email.includes('@') || !phone || !name || !password) {
      return sendJSON(res, 400, { error: 'يرجى إدخال جميع البيانات (الاسم، إيميل الجيميل، الهاتف، وكلمة المرور)' });
    }

    if (!db.customers) db.customers = [];

    // التحقق من عدم وجود الإيميل أو الهاتف مسبقاً
    if (db.customers.some(c => c.phone === phone)) {
      return sendJSON(res, 400, { error: 'رقم الهاتف مسجل مسبقاً، يمكنك تسجيل الدخول به مباشرة' });
    }
    if (db.customers.some(c => c.email && c.email.toLowerCase() === email)) {
      return sendJSON(res, 400, { error: 'إيميل الجيميل مسجل مسبقاً لحساب آخر، يرجى تسجيل الدخول' });
    }

    // توليد كود تحقق عشوائي من 6 أرقام
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // حفظ الكود والبيانات مؤقتاً لمدة 10 دقائق
    pendingOTPs[email] = {
      code: otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userData: {
        name,
        email,
        phone,
        password,
        city: body.city || 'نجع حمادي',
        area: body.area || '',
        street: body.street || ''
      }
    };

    // محاولة إرسال الكود فعلياً عبر خدمة الجيميل
    const emailResult = await emailService.sendOtpEmail(email, otpCode, name);

    if (emailResult.sent) {
      console.log(`[Gmail] تم إرسال كود التحقق بنجاح إلى إيميل العميل: ${email}`);
      return sendJSON(res, 200, {
        success: true,
        message: `تم إرسال كود التحقق بنجاح إلى بريدك الإلكتروني في Gmail (${email})`,
        email: email,
        realEmailSent: true
      });
    } else {
      // إما أن بيانات الجيميل لم تُسجل بعد في ملف التكست أو فشل الإرسال مؤقتاً
      console.log(`[Gmail Notice] الكود لإيميل (${email}) هو: ${otpCode} | السبب: ${emailResult.reason || emailResult.error}`);
      return sendJSON(res, 200, {
        success: true,
        message: emailResult.error
          ? `تم إنشاء الكود ولكن تعذر الإرسال عبر خوادم جوجل (${emailResult.error})`
          : `تم إنشاء كود التحقق (وضع التجربة - ملف إعدادات البريد بانتظار إدخال الإيميل)`,
        email: email,
        realEmailSent: false,
        devOtpCode: otpCode,
        devNotice: emailResult.error || 'يمكنك تفعيل الإرسال الحقيقي في أي وقت من ملف: إعدادات_البريد/بيانات_الجيميل.txt'
      });
    }
  }

  // الاستعلام عن حالة إعدادات إرسال الإيميلات
  if (pathname === '/api/admin/email-status' && method === 'GET') {
    const cfg = emailService.getEmailConfig();
    return sendJSON(res, 200, {
      isConfigured: cfg.isConfigured,
      email: cfg.email || '',
      senderName: cfg.senderName || '',
      configPath: 'إعدادات_البريد/بيانات_الجيميل.txt'
    });
  }

  // التحقق من كود الإيميل وتفعيل الحساب رسمياً
  if (pathname === '/api/customer/verify-otp' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);

    const email = (body.email || '').trim().toLowerCase();
    const inputCode = (body.code || '').trim();

    const pending = pendingOTPs[email];
    if (!pending) {
      return sendJSON(res, 400, { error: 'انتهت صلاحية الكود أو لم يتم طلب كود لهذا الإيميل، يرجى المحاولة مجدداً' });
    }

    if (Date.now() > pending.expiresAt) {
      delete pendingOTPs[email];
      return sendJSON(res, 400, { error: 'انتهت صلاحية الكود (أكثر من 10 دقائق)، يرجى طلب كود جديد' });
    }

    if (pending.code !== inputCode) {
      return sendJSON(res, 400, { error: 'كود التحقق غير صحيح، يرجى التأكد من الكود المرسل على الإيميل' });
    }

    // الكود صحيح 100% -> إنشاء الحساب في قاعدة البيانات
    const userData = pending.userData;
    delete pendingOTPs[email];

    if (!db.customers) db.customers = [];

    const defaultAddress = {
      id: 'addr_' + Date.now(),
      title: 'العنوان الرئيسي',
      city: userData.city,
      area: userData.area,
      street: userData.street,
      isDefault: true
    };

    const newCustomer = {
      id: 'cust_' + Date.now(),
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      password: userData.password,
      addresses: [defaultAddress],
      favorites: [],
      createdAt: new Date().toISOString()
    };

    db.customers.push(newCustomer);
    writeDB(db);

    const safeCust = { ...newCustomer };
    delete safeCust.password;

    return sendJSON(res, 201, {
      success: true,
      message: 'تم تأكيد الكود وتفعيل حسابك بنجاح!',
      customer: safeCust
    });
  }

  // تسجيل الدخول (يدعم الدخول بالهاتف أو بإيميل الجيميل)
  if (pathname === '/api/customer/login' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);
    const identifier = (body.phone || body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    const customer = (db.customers || []).find(
      c => (c.phone === identifier || (c.email && c.email.toLowerCase() === identifier)) && c.password === password
    );

    if (!customer) {
      return sendJSON(res, 401, { error: 'رقم الهاتف أو الإيميل أو كلمة المرور غير صحيحة' });
    }

    const safeCust = { ...customer };
    delete safeCust.password;
    return sendJSON(res, 200, { success: true, customer: safeCust });
  }

  if (pathname === '/api/customer/update' && method === 'PUT') {
    const db = readDB();
    const body = await parseBody(req);
    const index = (db.customers || []).findIndex(c => c.id === body.id);

    if (index === -1) {
      return sendJSON(res, 404, { error: 'حساب العميل غير موجود' });
    }

    const customer = db.customers[index];
    if (body.name) customer.name = body.name.trim();
    if (body.password) customer.password = body.password.trim();
    if (body.addresses) customer.addresses = body.addresses;
    if (body.favorites) customer.favorites = body.favorites;

    writeDB(db);
    const safeCust = { ...customer };
    delete safeCust.password;
    return sendJSON(res, 200, { success: true, customer: safeCust });
  }

  if (pathname === '/api/customer/orders' && method === 'GET') {
    const db = readDB();
    const phone = parsedUrl.query.phone;
    if (!phone) {
      return sendJSON(res, 400, { error: 'رقم الهاتف مطلوب لجلب الطلبات' });
    }
    const customerOrders = (db.orders || []).filter(o => o.customerPhone === phone);
    return sendJSON(res, 200, customerOrders);
  }

  // 2. فحص حالة النظام والمستخدمين (هل أول مرة؟)
  if (pathname === '/api/auth/status' && method === 'GET') {
    const db = readDB();
    const isFirstTime = !db.users || db.users.length === 0;
    return sendJSON(res, 200, {
      isFirstTime,
      totalUsers: db.users ? db.users.length : 0
    });
  }

  // 3. تسجيل المدير لأول مرة
  if (pathname === '/api/auth/register-manager' && method === 'POST') {
    const db = readDB();
    if (db.users && db.users.length > 0) {
      return sendJSON(res, 400, { error: 'تم إعداد المدير مسبقاً. يرجى تسجيل الدخول.' });
    }
    const body = await parseBody(req);
    if (!body.username || !body.password || !body.fullName) {
      return sendJSON(res, 400, { error: 'يرجى إدخال اسم المستخدم وكلمة المرور والاسم بالكامل' });
    }

    const newManager = {
      id: 'user_admin_1',
      username: body.username.trim(),
      password: body.password.trim(),
      fullName: body.fullName.trim(),
      role: 'admin',
      roleTitle: 'المدير العام',
      createdAt: new Date().toISOString()
    };

    db.users = [newManager];
    writeDB(db);
    return sendJSON(res, 200, { success: true, user: newManager });
  }

  // 4. تسجيل الدخول للموظفين والمدير
  if (pathname === '/api/auth/login' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);
    const user = (db.users || []).find(
      u => u.username === (body.username || '').trim() && u.password === (body.password || '').trim()
    );

    if (!user) {
      return sendJSON(res, 401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    return sendJSON(res, 200, {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        roleTitle: user.roleTitle
      }
    });
  }

  // 5. إدارة الموظفين وصلاحياتهم وكلمات السر (للمدير العام)
  if (pathname === '/api/users' && method === 'GET') {
    const db = readDB();
    const safeUsers = (db.users || []).map(u => ({
      id: u.id,
      username: u.username,
      password: u.password,
      fullName: u.fullName,
      role: u.role,
      roleTitle: u.roleTitle,
      createdAt: u.createdAt
    }));
    return sendJSON(res, 200, safeUsers);
  }

  // إضافة موظف جديد
  if (pathname === '/api/users' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);
    if (!body.username || !body.password || !body.role) {
      return sendJSON(res, 400, { error: 'بيانات الموظف غير مكتملة' });
    }

    // تحقق من عدم تكرار اسم المستخدم
    if (db.users.some(u => u.username === body.username.trim())) {
      return sendJSON(res, 400, { error: 'اسم المستخدم مسجل مسبقاً، اختر اسماً آخر' });
    }

    const roleTitles = {
      admin: 'المدير العام',
      stock_manager: 'مسؤول المنتجات والمخزن',
      cashier: 'الكاشير ومستقبل الطلبات'
    };

    const newUser = {
      id: 'user_' + Date.now(),
      username: body.username.trim(),
      password: body.password.trim(),
      fullName: body.fullName.trim() || body.username.trim(),
      role: body.role,
      roleTitle: roleTitles[body.role] || body.role,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);
    return sendJSON(res, 201, { success: true, user: newUser });
  }

  // تغيير أو تعيين كلمة سر جديدة لأي موظف بضغطة زر (حتى لو نسي القديمة)
  if (pathname.startsWith('/api/users/') && pathname.endsWith('/password') && method === 'PUT') {
    const userId = pathname.split('/')[3];
    const db = readDB();
    const body = await parseBody(req);
    const newPassword = (body.newPassword || '').trim();

    if (!newPassword || newPassword.length < 3) {
      return sendJSON(res, 400, { error: 'يرجى إدخال كلمة سر جديدة لا تقل عن 3 أحرف أو أرقام' });
    }

    const user = (db.users || []).find(u => u.id === userId);
    if (!user) {
      return sendJSON(res, 404, { error: 'الموظف غير موجود في النظام' });
    }

    user.password = newPassword;
    writeDB(db);

    return sendJSON(res, 200, {
      success: true,
      message: `تم تعيين كلمة السر الجديدة بنجاح للموظف "${user.fullName}"`,
      username: user.username,
      newPassword: newPassword
    });
  }

  // حذف موظف من النظام
  if (pathname.startsWith('/api/users/') && !pathname.includes('/password') && method === 'DELETE') {
    const userId = pathname.split('/')[3];
    const db = readDB();

    const userIndex = (db.users || []).findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return sendJSON(res, 404, { error: 'الموظف غير موجود' });
    }

    const user = db.users[userIndex];
    if (user.username === 'admin' && (db.users.filter(u => u.role === 'admin').length <= 1)) {
      return sendJSON(res, 400, { error: 'لا يمكن حذف حساب المدير العام الرئيسي لحماية النظام' });
    }

    db.users.splice(userIndex, 1);
    writeDB(db);

    return sendJSON(res, 200, { success: true, message: `تم حذف الموظف "${user.fullName}" بنجاح` });
  }

  // 6. المنتجات (عرض، تصفية عروض، إضافة، تعديل)
  if (pathname === '/api/products' && method === 'GET') {
    const db = readDB();
    let products = db.products || [];

    // فلتر العروض فقط (Offers Filter)
    if (parsedUrl.query.offersOnly === 'true') {
      products = products.filter(p => p.offerPrice && p.offerPrice < (p.price || p.pricePerKg));
    }

    // فلتر حسب القسم
    if (parsedUrl.query.category && parsedUrl.query.category !== 'all') {
      products = products.filter(p => p.category === parsedUrl.query.category);
    }

    return sendJSON(res, 200, products);
  }

  if (pathname === '/api/products' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);

    if (!body.name || !body.category || !body.saleType) {
      return sendJSON(res, 400, { error: 'يرجى إدخال اسم المنتج والقسم ونوع البيع' });
    }

    const newProduct = {
      id: 'prod_' + Date.now(),
      name: body.name.trim(),
      category: body.category,
      saleType: body.saleType, // "piece" أو "weight"
      price: body.saleType === 'piece' ? Number(body.price || 0) : null,
      pricePerKg: body.saleType === 'weight' ? Number(body.pricePerKg || 0) : null,
      offerPrice: body.offerPrice ? Number(body.offerPrice) : null,
      allowedWeights: body.saleType === 'weight' ? (body.allowedWeights || [0.25, 0.5, 1, 2]) : null,
      stock: Number(body.stock || 100),
      image: body.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      description: body.description || ''
    };

    db.products.unshift(newProduct);
    writeDB(db);
    return sendJSON(res, 201, { success: true, product: newProduct });
  }

  // تعديل منتج
  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    const prodId = pathname.replace('/api/products/', '');
    const db = readDB();
    const body = await parseBody(req);
    const index = db.products.findIndex(p => p.id === prodId);

    if (index === -1) {
      return sendJSON(res, 404, { error: 'المنتج غير موجود' });
    }

    db.products[index] = { ...db.products[index], ...body };
    writeDB(db);
    return sendJSON(res, 200, { success: true, product: db.products[index] });
  }

  // حذف منتج
  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    const prodId = pathname.replace('/api/products/', '');
    const db = readDB();
    db.products = db.products.filter(p => p.id !== prodId);
    writeDB(db);
    return sendJSON(res, 200, { success: true });
  }

  // 7. الأقسام والفئات (التفنيط والرسوم)
  if (pathname === '/api/categories' && method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, db.categories || []);
  }

  if (pathname === '/api/categories' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);
    if (!body.name) {
      return sendJSON(res, 400, { error: 'اسم الفئة / القسم مطلوب' });
    }
    const newCat = {
      id: body.id ? body.id.trim() : 'cat_' + Date.now(),
      name: body.name.trim(),
      icon: body.icon || '🛒',
      image: (body.image || '').trim(),
      description: (body.description || '').trim()
    };
    if (!db.categories) db.categories = [];
    db.categories.push(newCat);
    writeDB(db);
    return sendJSON(res, 201, { success: true, category: newCat });
  }

  if (pathname.startsWith('/api/categories/') && method === 'PUT') {
    const catId = pathname.split('/')[3];
    const db = readDB();
    const body = await parseBody(req);
    const cat = (db.categories || []).find(c => c.id === catId);
    if (!cat) {
      return sendJSON(res, 404, { error: 'القسم / الفئة غير موجودة' });
    }
    if (body.name) cat.name = body.name.trim();
    if (body.icon) cat.icon = body.icon.trim();
    if (body.image !== undefined) cat.image = body.image.trim();
    if (body.description !== undefined) cat.description = body.description.trim();
    writeDB(db);
    return sendJSON(res, 200, { success: true, category: cat });
  }

  if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
    const catId = pathname.split('/')[3];
    const db = readDB();
    if (!db.categories) db.categories = [];
    db.categories = db.categories.filter(c => c.id !== catId);
    writeDB(db);
    return sendJSON(res, 200, { success: true, message: 'تم حذف الفئة بنجاح' });
  }

  // 8. الطلبات (إنشاء من موقع العميل، عرض للكاشير، وتحديث الحالة)
  if (pathname === '/api/orders' && method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, db.orders || []);
  }

  // ==========================================
  // 8.1 رسائل واستفسارات تواصل معنا
  // ==========================================
  if (pathname === '/api/messages' && method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, db.messages || []);
  }

  if (pathname === '/api/messages' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);

    if (!body.name || !body.phone || !body.message) {
      return sendJSON(res, 400, { error: 'يرجى إدخال الاسم ورقم الهاتف والرسالة' });
    }

    const now = new Date();
    const dateFormatted = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

    const newMessage = {
      id: 'MSG-' + Math.floor(100 + Math.random() * 900),
      date: dateFormatted,
      name: body.name.trim(),
      phone: body.phone.trim(),
      subject: body.subject || 'استفسار عام',
      message: body.message.trim(),
      status: 'جديد' // جديد | تم الرد
    };

    if (!db.messages) db.messages = [];
    db.messages.unshift(newMessage);
    writeDB(db);

    return sendJSON(res, 201, {
      success: true,
      message: newMessage,
      whatsappLink: `https://wa.me/201003888449?text=${encodeURIComponent(
        `*رسالة جديدة عبر المتجر:*\n👤 الاسم: ${newMessage.name}\n📱 الهاتف: ${newMessage.phone}\n📋 الموضوع: ${newMessage.subject}\n💬 الرسالة:\n${newMessage.message}`
      )}`
    });
  }

  if (pathname.startsWith('/api/messages/') && pathname.endsWith('/status') && method === 'PUT') {
    const msgId = pathname.split('/')[3];
    const db = readDB();
    const body = await parseBody(req);
    const msg = (db.messages || []).find(m => m.id === msgId);

    if (!msg) {
      return sendJSON(res, 404, { error: 'الرسالة غير موجودة' });
    }

    msg.status = body.status || 'تم الرد';
    if (body.handledBy) msg.handledBy = body.handledBy;
    writeDB(db);
    return sendJSON(res, 200, { success: true, message: msg });
  }

  if (pathname === '/api/orders' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);

    if (!body.customerPhone || !body.items || body.items.length === 0) {
      return sendJSON(res, 400, { error: 'بيانات الطلب ورقم الهاتف والأصناف مطلوبة' });
    }

    const orderId = 'ORD-' + Math.floor(100 + Math.random() * 900);
    const now = new Date();
    const dateFormatted = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

    const newOrder = {
      id: orderId,
      date: dateFormatted,
      customerName: body.customerName || 'عميل هايبر زايد',
      customerPhone: body.customerPhone.trim(),
      city: body.city || 'فرشوط',
      area: body.area || '',
      street: body.street || '',
      serviceType: body.serviceType || 'delivery', // 'delivery' أو 'pickup'
      address: body.serviceType === 'pickup' ? 'استلام من فرع هايبر زايد (نجع حمادي - شارع المركز)' : (body.address || `${body.city} - ${body.area} - ${body.street}`),
      items: body.items,
      subtotal: Number(body.subtotal || 0),
      deliveryFee: 0,
      total: Number(body.subtotal || 0),
      paymentMethod: body.paymentMethod || 'الدفع عند الاستلام',
      paymentDetails: body.paymentDetails || '',
      status: 'جديد', // جديد -> قيد التجهيز -> تمت -> مرتجع
      returnReason: '',
      notes: body.notes || '',
      handledBy: ''
    };

    if (!db.orders) db.orders = [];
    db.orders.unshift(newOrder);
    writeDB(db);

    return sendJSON(res, 201, {
      success: true,
      order: newOrder,
      estimatedTime: body.serviceType === 'pickup' ? '30 دقيقة للاستلام من الفرع' : '45 - 60 دقيقة للتوصيل'
    });
  }

  // تحديث حالة الطلب وإصدار رسالة الواتساب
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PUT') {
    const orderId = pathname.split('/')[3];
    const db = readDB();
    const body = await parseBody(req);
    const order = (db.orders || []).find(o => o.id === orderId);

    if (!order) {
      return sendJSON(res, 404, { error: 'الطلب غير موجود' });
    }

    order.status = body.status || order.status;
    if (body.returnReason !== undefined) order.returnReason = body.returnReason;
    if (body.handledBy) order.handledBy = body.handledBy;

    writeDB(db);

    // تجهيز نص رسالة الواتساب الجاهزة متضمنة رسوم التوصيل
    let waMessage = '';
    if (order.status === 'قيد التجهيز' || order.status === 'تم التأكيد') {
      const delLine = order.serviceType === 'pickup'
        ? '🏬 استلام من الفرع الرئيسي (شارع المركز - بدون رسوم توصيل)'
        : '🛵 رسوم التوصيل: [اكتب هنا تكلفة التوصيل] جنيه';

      waMessage = `أهلاً بك يا ${order.customerName} 🛒\nتم تأكيد طلبك رقم (${order.id}) بنجاح من *هايبر زايد ماركت*.\n📍 العنوان: ${order.address}\n💵 قيمة المنتجات: ${order.subtotal} جنيه\n${delLine}\n💳 طريقة الدفع: ${order.paymentMethod}\n⏱️ الوقت المتوقع: خلال 45 دقيقة.\nشكراً لتسوقك معنا!`;
    } else if (order.status === 'تمت') {
      waMessage = `مرحباً ${order.customerName}، تم توصيل طلبك رقم (${order.id}) بنجاح! نسعد دائماً بخدمتك في *هايبر زايد ماركت* ❤️`;
    }

    return sendJSON(res, 200, {
      success: true,
      order,
      whatsappText: waMessage,
      whatsappLink: waMessage ? `https://wa.me/2${order.customerPhone.replace(/^0/, '')}?text=${encodeURIComponent(waMessage)}` : ''
    });
  }

  // ==========================================
  // 9. تصدير ملف الإكسيل الأسبوعي
  // ==========================================
  if (pathname === '/api/reports/excel' && method === 'GET') {
    const db = readDB();
    const orders = db.orders || [];

    // توليد ملف CSV بترميز UTF-8 مع BOM لفتحه مباشرة في Microsoft Excel باللغة العربية
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'رقم الطلب,تاريخ ووقت الطلب,اسم العميل,رقم الهاتف,المدينة,العنوان,الأصناف المطلوبة,قيمة المشتريات,رسوم التوصيل,المجموع الكلي,طريقة الدفع,حالة الأوردر,ملاحظات / سبب الإرجاع,الموظف المسؤول\n';

    orders.forEach(o => {
      const itemsText = (o.items || [])
        .map(i => `${i.name} (${i.unit} × ${i.quantity})`)
        .join(' - ')
        .replace(/,/g, ' ');

      const row = [
        `"${o.id}"`,
        `"${o.date}"`,
        `"${o.customerName}"`,
        `"${o.customerPhone}"`,
        `"${o.city || ''}"`,
        `"${(o.address || '').replace(/,/g, ' ')}"`,
        `"${itemsText}"`,
        `"${o.subtotal} ج.م"`,
        `"${o.deliveryFee} ج.م"`,
        `"${o.total} ج.م"`,
        `"${o.paymentMethod}"`,
        `"${o.status}"`,
        `"${(o.returnReason || o.notes || '').replace(/,/g, ' ')}"`,
        `"${o.handledBy || ''}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=Zayed_Hypermarket_Weekly_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(csv);
  }

  // ==========================================
  // 10. إدارة شرائح العروض والبانرات (Slideshow)
  // ==========================================
  if (pathname === '/api/banners' && method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, {
      success: true,
      banners: db.banners || [],
      settings: db.bannerSettings || { intervalSeconds: 3, autoplay: true }
    });
  }

  if (pathname === '/api/banners' && method === 'POST') {
    const db = readDB();
    const body = await parseBody(req);
    if (!body.image) {
      return sendJSON(res, 400, { error: 'يرجى إدخال رابط صورة البانر' });
    }

    const newBanner = {
      id: 'banner_' + Date.now(),
      title: (body.title || '').trim(),
      subtitle: (body.subtitle || '').trim(),
      badge: (body.badge || 'عرض خاص 🔥').trim(),
      image: body.image.trim(),
      linkCategory: body.linkCategory || 'all',
      createdAt: new Date().toISOString()
    };

    if (!db.banners) db.banners = [];
    db.banners.push(newBanner);
    writeDB(db);

    return sendJSON(res, 201, { success: true, banner: newBanner });
  }

  if (pathname === '/api/banners/settings' && method === 'PUT') {
    const db = readDB();
    const body = await parseBody(req);
    const intervalSec = parseInt(body.intervalSeconds, 10) || 3;

    if (!db.bannerSettings) db.bannerSettings = {};
    db.bannerSettings.intervalSeconds = Math.max(1, Math.min(60, intervalSec));
    if (body.autoplay !== undefined) db.bannerSettings.autoplay = !!body.autoplay;

    writeDB(db);
    return sendJSON(res, 200, { success: true, settings: db.bannerSettings });
  }

  if (pathname.startsWith('/api/banners/') && method === 'DELETE') {
    const bannerId = pathname.split('/')[3];
    const db = readDB();
    if (!db.banners) db.banners = [];

    const initialLen = db.banners.length;
    db.banners = db.banners.filter(b => b.id !== bannerId);

    if (db.banners.length === initialLen) {
      return sendJSON(res, 404, { error: 'البانر غير موجود' });
    }

    writeDB(db);
    return sendJSON(res, 200, { success: true, message: 'تم حذف البانر بنجاح' });
  }

  // ==========================================
  // تقديم واجهات الويب (Frontend Static Files)
  // ==========================================

  // إعادة التوجيه إلى /admin/ أو /hypermarket/ لضمان صحة المسارات النسبية للمتصفح
  if (pathname === '/admin' || pathname === '/hypermarket') {
    res.writeHead(301, { 'Location': pathname + '/' });
    return res.end();
  }

  // توجيه المسار الرئيسي لموقع العملاء وبوابة الإدارة
  let filePath = '';
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(PUBLIC_DIR, 'customer', 'index.html');
  } else if (
    pathname === '/admin/' || 
    pathname === '/hypermarket/' || 
    pathname === '/admin/index.html' || 
    pathname === '/hypermarket/index.html'
  ) {
    filePath = path.join(PUBLIC_DIR, 'hypermarket', 'index.html');
  } else if (pathname.startsWith('/admin/') || pathname.startsWith('/hypermarket/')) {
    const subPath = pathname.replace(/^\/(admin|hypermarket)\//, '');
    filePath = path.join(PUBLIC_DIR, 'hypermarket', subPath || 'index.html');
  } else {
    // ملفات العملاء أو ملفات عامة
    filePath = path.join(PUBLIC_DIR, 'customer', pathname.replace(/^\//, ''));
  }

  // فحص وجود الملف وتقديمه
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // محاولة البحث في المجلد الرئيسي للـ public
      const altPath = path.join(PUBLIC_DIR, pathname);
      return fs.stat(altPath, (altErr, altStats) => {
        if (altErr || !altStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('الصفحة غير موجودة 404');
        }
        serveFile(res, altPath);
      });
    }

    // إذا كان المسار مجلداً، ابحث عن index.html بداخله
    if (stats.isDirectory()) {
      const indexFile = path.join(filePath, 'index.html');
      return fs.stat(indexFile, (idxErr, idxStats) => {
        if (!idxErr && idxStats.isFile()) {
          return serveFile(res, indexFile);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('الصفحة غير موجودة 404');
      });
    }

    serveFile(res, filePath);
  });
});

function serveFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(file, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('خطأ في تحميل الملف');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

// بدء تشغيل السيرفر
server.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(`🚀 تم تشغيل سيرفر هايبر زايد بنجاح!`);
  console.log(`🛒 موقع العملاء والمتسوقين: http://localhost:${PORT}/`);
  console.log(`🏢 بوابة إدارة الهايبر ماركت: http://localhost:${PORT}/admin/`);
  console.log(`=====================================================`);
});
